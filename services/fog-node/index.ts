/**
 * Fog node: edge → MQTT (Mosquitto / IoT Core) or HTTP → validate → cloud (HTTP + optional SQS + optional MQTT publish).
 */

import '../../lib/load-env.js';
import http from 'node:http';
import { connect, type MqttClient } from 'mqtt';
import type { FogEnvelope } from '../../shared/schema/types.js';
import {
  PORT,
  CLOUD_URL,
  FOG_NODE_ID,
  FOG_INPUT_MODE,
  MQTT_BROKER_URL,
  MQTT_TOPIC_FILTER,
  MQTT_FLUSH_MS,
  FOG_MQTT_PUBLISH,
  MQTT_PUBLISH_BROKER_URL,
  MQTT_TO_CLOUD_TOPIC,
  FOG_SQS_QUEUE_URL,
  FOG_CORS_ORIGIN,
} from './config.js';
import mqttConnect from '../../lib/mqtt-connect-options.js';

const { applyMqttTlsProfile, extraMqttTlsOptions } = mqttConnect;
import { parseSqsQueueMeta, sendEnvelopeToSqs } from './sqs-dispatch.js';
import * as stats from './stats.js';
import { validateBody, parseReadingsFromMqttPayload } from './validate.js';

let lastCloudErrorLog = 0;
const CLOUD_ERROR_LOG_INTERVAL_MS = 30_000;
let mqttDisconnected = false;
let lastMqttErrorLog = 0;
const MQTT_ERROR_LOG_INTERVAL_MS = 300_000;

let mqttPublisher: MqttClient | null = null;

function corsHeaders(): Record<string, string> {
  if (!FOG_CORS_ORIGIN) return {};
  return {
    'Access-Control-Allow-Origin': FOG_CORS_ORIGIN,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

function initMqttPublisher(): void {
  if (!FOG_MQTT_PUBLISH) return;
  applyMqttTlsProfile('FOG');
  const tls = extraMqttTlsOptions();
  const pubId =
    process.env.FOG_MQTT_PUBLISHER_CLIENT_ID ||
    `fog-pub-${FOG_NODE_ID.replace(/[^a-zA-Z0-9_-]/g, '-')}`;
  mqttPublisher = connect(MQTT_PUBLISH_BROKER_URL, {
    reconnectPeriod: 3000,
    clientId: pubId,
    ...tls,
  });
  mqttPublisher.on('connect', () => {
    stats.fogStats.mqttPublisherConnected = true;
    console.log(`Fog MQTT publisher connected: ${MQTT_PUBLISH_BROKER_URL} → ${MQTT_TO_CLOUD_TOPIC}`);
  });
  mqttPublisher.on('error', () => {
    stats.fogStats.mqttPublisherConnected = false;
  });
  mqttPublisher.on('close', () => {
    stats.fogStats.mqttPublisherConnected = false;
  });
}

function publishEnvelopeToBrokerTopic(envelope: FogEnvelope): void {
  if (!FOG_MQTT_PUBLISH || !mqttPublisher) return;
  const payload = JSON.stringify(envelope);
  mqttPublisher.publish(MQTT_TO_CLOUD_TOPIC, payload, { qos: 1 }, (err) => {
    stats.noteMqttPublish(!err);
    if (err) console.error('[fog] MQTT publish to cloud topic failed:', err.message);
  });
}

async function dispatchToCloud(envelope: FogEnvelope): Promise<void> {
  const body = JSON.stringify(envelope);
  stats.noteEnvelope(envelope.receivedAt);

  let httpOk = false;
  try {
    const res = await fetch(CLOUD_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });
    httpOk = res.ok;
    stats.noteCloudHttp(res.ok);
    if (!res.ok) {
      const now = Date.now();
      if (now - lastCloudErrorLog >= CLOUD_ERROR_LOG_INTERVAL_MS) {
        lastCloudErrorLog = now;
        if (res.status === 404) {
          console.error(
            `Cloud POST 404 at ${CLOUD_URL}. Start the Next app (npm run dev:next) or full stack (npm run dev).`,
          );
        } else {
          console.error(`Cloud POST failed: ${res.status} ${res.statusText}`);
        }
      }
      stats.setLastError(`HTTP ${res.status}`);
    } else {
      stats.setLastError(null);
    }
  } catch {
    stats.noteCloudHttp(false);
    const now = Date.now();
    if (now - lastCloudErrorLog >= CLOUD_ERROR_LOG_INTERVAL_MS) {
      lastCloudErrorLog = now;
      console.error(
        `Cloud unreachable at ${CLOUD_URL}. Is the app running? Start with: npm run dev:next (Next only) or npm run dev (Next + fog + simulator).`,
      );
    }
    stats.setLastError('cloud_unreachable');
  }

  if (FOG_SQS_QUEUE_URL) {
    const ok = await sendEnvelopeToSqs(FOG_SQS_QUEUE_URL, body);
    stats.noteSqs(ok);
  }

  publishEnvelopeToBrokerTopic(envelope);
}

const mqttBuffer: FogEnvelope['readings'] = [];

function enqueueMqttReading(reading: FogEnvelope['readings'][number]) {
  stats.bumpMqttMessage();
  mqttBuffer.push(reading);
  if (mqttBuffer.length >= 100) flushMqttBuffer().catch(() => {});
}

async function flushMqttBuffer(): Promise<void> {
  if (mqttBuffer.length === 0) return;
  const readings = mqttBuffer.splice(0, mqttBuffer.length);
  const envelope: FogEnvelope = {
    fogNodeId: FOG_NODE_ID,
    receivedAt: new Date().toISOString(),
    readings,
  };
  await dispatchToCloud(envelope);
}

function initMqttSubscriber() {
  applyMqttTlsProfile('FOG');
  const tls = extraMqttTlsOptions();
  if (MQTT_BROKER_URL.startsWith('mqtts') && (!tls?.cert || !tls?.key)) {
    console.error(
      '[fog] mqtts:// (AWS IoT Core) requires mutual TLS — set FOG_AWS_IOT_CA_PATH, FOG_AWS_IOT_CERT_PATH, FOG_AWS_IOT_KEY_PATH ' +
        '(or unprefixed AWS_IOT_*). Subscriber not started. See docs/AWS_IOT_CORE.md',
    );
    return;
  }
  const subId =
    process.env.FOG_MQTT_CLIENT_ID ||
    process.env.MQTT_CLIENT_ID ||
    `fog-${FOG_NODE_ID.replace(/[^a-zA-Z0-9_-]/g, '-')}`;
  const client = connect(MQTT_BROKER_URL, {
    reconnectPeriod: 3000,
    clientId: subId,
    ...tls,
  });

  client.on('connect', () => {
    stats.fogStats.mqttSubscriberConnected = true;
    if (mqttDisconnected) {
      console.log(`Fog MQTT reconnected: ${MQTT_BROKER_URL}`);
      mqttDisconnected = false;
    }
    console.log(`Fog MQTT connected: ${MQTT_BROKER_URL}`);
    client.subscribe(MQTT_TOPIC_FILTER, { qos: 1 }, (err) => {
      if (err) console.error('Fog MQTT subscribe failed:', err.message);
      else console.log(`Fog MQTT subscribed: ${MQTT_TOPIC_FILTER}`);
    });
  });

  let lastInvalidMqttLog = 0;
  client.on('message', (topic, payload) => {
    try {
      const text = payload.toString();
      const readings = parseReadingsFromMqttPayload(text);
      if (!readings?.length) {
        const now = Date.now();
        if (now - lastInvalidMqttLog >= 15_000) {
          lastInvalidMqttLog = now;
          console.warn(
            `[fog] MQTT message on ${topic} produced no valid readings (check JSON + ranges). Payload preview: ${text.slice(0, 160)}`,
          );
        }
        return;
      }
      for (const reading of readings) enqueueMqttReading(reading);
    } catch (e) {
      console.error('[fog] MQTT message handler error:', e instanceof Error ? e.message : e);
    }
  });

  client.on('reconnect', () => {
    mqttDisconnected = true;
    stats.fogStats.mqttSubscriberConnected = false;
    const now = Date.now();
    if (now - lastMqttErrorLog >= MQTT_ERROR_LOG_INTERVAL_MS) {
      lastMqttErrorLog = now;
      console.error(
        `Fog MQTT reconnecting to ${MQTT_BROKER_URL}. Start broker or switch to HTTP mode with: npm run fog:http`,
      );
    }
  });
  client.on('error', (err) => {
    mqttDisconnected = true;
    stats.fogStats.mqttSubscriberConnected = false;
    const now = Date.now();
    if (now - lastMqttErrorLog >= MQTT_ERROR_LOG_INTERVAL_MS) {
      lastMqttErrorLog = now;
      const message = err?.message?.trim() || '(no error message)';
      console.error(`Fog MQTT error at ${MQTT_BROKER_URL}: ${message}`);
    }
  });
  client.on('close', () => {
    stats.fogStats.mqttSubscriberConnected = false;
  });

  setInterval(() => {
    flushMqttBuffer().catch((err) => console.error('Fog MQTT flush error:', err));
  }, Math.max(500, MQTT_FLUSH_MS));
}

const server = http.createServer(async (req, res) => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...corsHeaders(),
  };

  if (req.method === 'OPTIONS') {
    res.writeHead(204, headers);
    res.end();
    return;
  }

  if (req.method === 'GET' && req.url === '/status') {
    const sqsMeta = FOG_SQS_QUEUE_URL ? parseSqsQueueMeta(FOG_SQS_QUEUE_URL) : {};
    res.writeHead(200, headers);
    res.end(
      JSON.stringify({
        service: 'fog-node',
        fogNodeId: FOG_NODE_ID,
        fogInputMode: FOG_INPUT_MODE,
        cloudUrl: CLOUD_URL,
        mqttBrokerUrl: MQTT_BROKER_URL,
        mqttTopicFilter: MQTT_TOPIC_FILTER,
        mqttFlushMs: MQTT_FLUSH_MS,
        mqttToCloudTopic: FOG_MQTT_PUBLISH ? MQTT_TO_CLOUD_TOPIC : null,
        mqttPublishBrokerUrl: FOG_MQTT_PUBLISH ? MQTT_PUBLISH_BROKER_URL : null,
        sqsQueueConfigured: Boolean(FOG_SQS_QUEUE_URL),
        sqsRegion: sqsMeta.region ?? null,
        sqsQueueName: sqsMeta.queueName ?? null,
        pipeline:
          'sensor/edge (MQTT or HTTP) → broker optional → fog subscribe/ingest → HTTP cloud + optional SQS + optional MQTT publish',
        stats: { ...stats.fogStats },
      }),
    );
    return;
  }

  if (req.method === 'GET' && (req.url === '/' || req.url === '/health')) {
    res.writeHead(200, headers);
    res.end(JSON.stringify({ status: 'ok', fogNodeId: FOG_NODE_ID }));
    return;
  }

  if (
    (FOG_INPUT_MODE === 'http' || FOG_INPUT_MODE === 'both') &&
    req.method === 'POST' &&
    req.url === '/ingest'
  ) {
    let body = '';
    for await (const chunk of req) body += chunk;
    let parsed: unknown;
    try {
      parsed = JSON.parse(body || '{}');
    } catch {
      res.writeHead(400, headers);
      res.end(JSON.stringify({ error: 'Invalid JSON' }));
      return;
    }

    const validated = validateBody(parsed);
    if (!validated) {
      res.writeHead(400, headers);
      res.end(JSON.stringify({ error: 'Invalid or empty readings' }));
      return;
    }

    stats.bumpHttpIngest(validated.readings.length);

    const envelope: FogEnvelope = {
      fogNodeId: FOG_NODE_ID,
      receivedAt: new Date().toISOString(),
      readings: validated.readings,
    };

    await dispatchToCloud(envelope);
    res.writeHead(202, headers);
    res.end(JSON.stringify({ accepted: validated.readings.length }));
    return;
  }

  res.writeHead(404, headers);
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    console.error(
      `Port ${PORT} is already in use. Run \`node scripts/free-dev-ports.mjs\` or stop the other process.`,
    );
    process.exit(1);
  }
  throw err;
});

server.listen(PORT, () => {
  console.log(`Fog node ${FOG_NODE_ID} listening on port ${PORT}`);
  console.log('FOG_INPUT_MODE:', FOG_INPUT_MODE);
  console.log('CLOUD_URL:', CLOUD_URL);
  if (FOG_SQS_QUEUE_URL) console.log('FOG_SQS_QUEUE_URL:', FOG_SQS_QUEUE_URL);
  if (FOG_MQTT_PUBLISH) {
    console.log('FOG_MQTT_PUBLISH: true →', MQTT_PUBLISH_BROKER_URL, 'topic', MQTT_TO_CLOUD_TOPIC);
    initMqttPublisher();
  }
  if (FOG_INPUT_MODE === 'mqtt' || FOG_INPUT_MODE === 'both') {
    if (!MQTT_BROKER_URL) {
      console.error(
        '[fog] MQTT_BROKER_URL is not set — MQTT subscriber not started. HTTP ingest on port ' +
          PORT +
          ' still works. For AWS IoT set mqtts://…-ats.iot.REGION.amazonaws.com:8883 and PEM paths (docs/AWS_IOT_CORE.md).',
      );
    } else {
      console.log('MQTT_BROKER_URL:', MQTT_BROKER_URL);
      console.log('MQTT_TOPIC_FILTER:', MQTT_TOPIC_FILTER);
      initMqttSubscriber();
    }
  }
});
