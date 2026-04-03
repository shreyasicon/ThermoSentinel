#!/usr/bin/env node
/**
 * Sensor simulator: generates data for 3–5 sensor types with configurable
 * sample frequency and dispatch interval; sends batches to the fog node.
 */

import { connect } from 'mqtt';
import { getEffectiveConfig, FOG_URL, MQTT_BROKER_URL, MQTT_TOPIC_ROOT, SENSOR_TRANSPORT } from './config.js';
import { generateReadings } from './generators.js';
import type { SensorReading } from '../../shared/schema/types';

const config = getEffectiveConfig();

/** Per-type buffer of readings to send on next dispatch */
const buffers = new Map<string, SensorReading[]>();

/** Last dispatch time per type */
const lastDispatch = new Map<string, number>();
let mqttClient: ReturnType<typeof connect> | null = null;

/** Throttle connection-error logs to avoid spam when fog is down */
let lastFogUnreachableLog = 0;
const FOG_UNREACHABLE_LOG_INTERVAL_MS = 30_000;
let mqttDisconnected = false;
let lastMqttUnavailableLog = 0;
const MQTT_UNAVAILABLE_LOG_INTERVAL_MS = 300_000;

async function sendToFog(readings: SensorReading[]): Promise<void> {
  if (readings.length === 0) return;
  if (SENSOR_TRANSPORT === 'mqtt') {
    await publishToMqtt(readings);
    return;
  }
  try {
    const res = await fetch(FOG_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ readings }),
    });
    if (!res.ok) {
      console.error(`Fog POST failed: ${res.status} ${res.statusText}`);
    }
  } catch (err) {
    const cause = err instanceof Error ? (err as { cause?: { code?: string; errors?: Array<{ code?: string }> } }).cause : undefined;
    const code = cause?.code ?? cause?.errors?.[0]?.code ?? '';
    const errStr = String(err);
    const isUnreachable =
      code === 'ECONNREFUSED' || code === 'ECONNRESET' ||
      errStr.includes('ECONNREFUSED') || errStr.includes('ECONNRESET');
    if (isUnreachable) {
      const now = Date.now();
      if (now - lastFogUnreachableLog >= FOG_UNREACHABLE_LOG_INTERVAL_MS) {
        lastFogUnreachableLog = now;
        console.error(
          `Fog node unreachable at ${FOG_URL}. Run "npm run dev:all" to start app + fog + simulator together.`
        );
      }
    } else {
      console.error('Fog POST error:', err);
    }
  }
}

function normalizeRoom(location?: string): string {
  return (location ?? 'room-unknown').toLowerCase().replace(/[^a-z0-9-]/g, '-');
}

function topicForReading(r: SensorReading): string {
  return `${MQTT_TOPIC_ROOT}/${normalizeRoom(r.location)}/${r.sensorType}`;
}

async function publishToMqtt(readings: SensorReading[]): Promise<void> {
  if (!mqttClient || !mqttClient.connected) {
    mqttDisconnected = true;
    const now = Date.now();
    if (now - lastMqttUnavailableLog >= MQTT_UNAVAILABLE_LOG_INTERVAL_MS) {
      lastMqttUnavailableLog = now;
      console.error(
        `MQTT client not connected to ${MQTT_BROKER_URL}. Start a broker on that URL or run \"npm run simulator:http\".`
      );
    }
    return;
  }
  for (const r of readings) {
    const topic = topicForReading(r);
    const payload = JSON.stringify(r);
    await new Promise<void>((resolve, reject) => {
      mqttClient!.publish(topic, payload, { qos: 1 }, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
}

function initMqttPublisher() {
  mqttClient = connect(MQTT_BROKER_URL, {
    reconnectPeriod: 3000,
    clientId: `sim-${Math.random().toString(16).slice(2, 10)}`,
  });
  mqttClient.on('connect', () => {
    if (mqttDisconnected) {
      console.log(`Simulator MQTT reconnected: ${MQTT_BROKER_URL}`);
      mqttDisconnected = false;
    }
    console.log(`Simulator MQTT connected: ${MQTT_BROKER_URL}`);
  });
  mqttClient.on('reconnect', () => {
    mqttDisconnected = true;
  });
  mqttClient.on('error', () => {
    mqttDisconnected = true;
  });
}

function run() {
  console.log('Sensor simulator starting');
  console.log('SENSOR_TRANSPORT:', SENSOR_TRANSPORT);
  if (SENSOR_TRANSPORT === 'mqtt') {
    console.log('MQTT_BROKER_URL:', MQTT_BROKER_URL);
    console.log('MQTT_TOPIC_ROOT:', MQTT_TOPIC_ROOT);
    initMqttPublisher();
  } else {
    console.log('FOG_URL:', FOG_URL);
  }
  console.log(
    'Config:',
    config.map((c) => ({
      type: c.sensorType,
      sampleMs: c.sampleFrequencyMs,
      dispatchMs: c.dispatchIntervalMs,
      count: c.sensorCount,
    }))
  );

  config.forEach((c) => {
    buffers.set(c.sensorType, []);
    lastDispatch.set(c.sensorType, Date.now());

    // Sample at configured frequency
    setInterval(() => {
      const readings = generateReadings(c.sensorType, c.sensorCount);
      const buf = buffers.get(c.sensorType)!;
      buf.push(...readings);
    }, c.sampleFrequencyMs);

    // Dispatch at configured interval
    setInterval(() => {
      const buf = buffers.get(c.sensorType)!;
      if (buf.length === 0) return;
      const toSend = buf.splice(0, buf.length);
      sendToFog(toSend);
      lastDispatch.set(c.sensorType, Date.now());
    }, c.dispatchIntervalMs);
  });
}

run();
