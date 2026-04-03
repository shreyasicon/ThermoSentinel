/**
 * Fog node: receives sensor data, validates, processes, dispatches to cloud.
 */

import http from 'node:http';
import { connect } from 'mqtt';
import type { FogEnvelope } from '../../shared/schema/types.js';
import {
  PORT,
  CLOUD_URL,
  FOG_NODE_ID,
  FOG_INPUT_MODE,
  MQTT_BROKER_URL,
  MQTT_TOPIC_FILTER,
  MQTT_FLUSH_MS,
} from './config.js';
import { validateBody } from './validate.js';

let lastCloudErrorLog = 0;
const CLOUD_ERROR_LOG_INTERVAL_MS = 30_000;
let mqttDisconnected = false;
let lastMqttErrorLog = 0;
const MQTT_ERROR_LOG_INTERVAL_MS = 300_000;

async function dispatchToCloud(envelope: FogEnvelope): Promise<void> {
  try {
    const res = await fetch(CLOUD_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(envelope),
    });
    if (!res.ok) {
      const now = Date.now();
      if (now - lastCloudErrorLog >= CLOUD_ERROR_LOG_INTERVAL_MS) {
        lastCloudErrorLog = now;
        if (res.status === 404) {
          console.error(
            `Cloud POST 404 at ${CLOUD_URL}. Start the Next.js app in another terminal: npm run dev`
          );
        } else {
          console.error(`Cloud POST failed: ${res.status} ${res.statusText}`);
        }
      }
    }
  } catch {
    const now = Date.now();
    if (now - lastCloudErrorLog >= CLOUD_ERROR_LOG_INTERVAL_MS) {
      lastCloudErrorLog = now;
      console.error(
        `Cloud unreachable at ${CLOUD_URL}. Is the app running? Start it with: npm run dev`
      );
    }
  }
}

const mqttBuffer: FogEnvelope['readings'] = [];

function enqueueMqttReading(reading: FogEnvelope['readings'][number]) {
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
  const client = connect(MQTT_BROKER_URL, {
    reconnectPeriod: 3000,
    clientId: `fog-${Math.random().toString(16).slice(2, 10)}`,
  });

  client.on('connect', () => {
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

  client.on('message', (_topic, payload) => {
    try {
      const parsed = JSON.parse(payload.toString());
      const validated = validateBody({ readings: [parsed] });
      if (!validated || validated.readings.length === 0) return;
      enqueueMqttReading(validated.readings[0]);
    } catch {
      // Ignore invalid payloads from broker
    }
  });

  client.on('reconnect', () => {
    mqttDisconnected = true;
    const now = Date.now();
    if (now - lastMqttErrorLog >= MQTT_ERROR_LOG_INTERVAL_MS) {
      lastMqttErrorLog = now;
      console.error(
        `Fog MQTT reconnecting to ${MQTT_BROKER_URL}. Start broker or switch to HTTP mode with: npm run fog:http`
      );
    }
  });
  client.on('error', (err) => {
    mqttDisconnected = true;
    const now = Date.now();
    if (now - lastMqttErrorLog >= MQTT_ERROR_LOG_INTERVAL_MS) {
      lastMqttErrorLog = now;
      const message = err?.message?.trim() || '(no error message)';
      console.error(`Fog MQTT error at ${MQTT_BROKER_URL}: ${message}`);
    }
  });

  setInterval(() => {
    flushMqttBuffer().catch((err) => console.error('Fog MQTT flush error:', err));
  }, Math.max(500, MQTT_FLUSH_MS));
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'GET' && (req.url === '/' || req.url === '/health')) {
    res.writeHead(200);
    res.end(JSON.stringify({ status: 'ok', fogNodeId: FOG_NODE_ID }));
    return;
  }

  if ((FOG_INPUT_MODE === 'http' || FOG_INPUT_MODE === 'both') && req.method === 'POST' && req.url === '/ingest') {
    let body = '';
    for await (const chunk of req) body += chunk;
    let parsed: unknown;
    try {
      parsed = JSON.parse(body || '{}');
    } catch {
      res.writeHead(400);
      res.end(JSON.stringify({ error: 'Invalid JSON' }));
      return;
    }

    const validated = validateBody(parsed);
    if (!validated) {
      res.writeHead(400);
      res.end(JSON.stringify({ error: 'Invalid or empty readings' }));
      return;
    }

    const envelope: FogEnvelope = {
      fogNodeId: FOG_NODE_ID,
      receivedAt: new Date().toISOString(),
      readings: validated.readings,
    };

    await dispatchToCloud(envelope);
    res.writeHead(202);
    res.end(JSON.stringify({ accepted: validated.readings.length }));
    return;
  }

  res.writeHead(404);
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
  if (FOG_INPUT_MODE === 'mqtt' || FOG_INPUT_MODE === 'both') {
    console.log('MQTT_BROKER_URL:', MQTT_BROKER_URL);
    console.log('MQTT_TOPIC_FILTER:', MQTT_TOPIC_FILTER);
    initMqttSubscriber();
  }
});
