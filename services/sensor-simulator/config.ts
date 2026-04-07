/**
 * Sensor simulator config. Override via env or config file.
 */

import type { SensorType } from '../../shared/schema/types';

export interface SensorTypeConfig {
  sensorType: SensorType;
  sampleFrequencyMs: number;
  dispatchIntervalMs: number;
  sensorCount: number;
}

function envNum(key: string, defaultVal: number): number {
  const v = process.env[key];
  if (v === undefined || v === '') return defaultVal;
  const n = Number(v);
  return Number.isFinite(n) ? n : defaultVal;
}

function envStr(key: string, defaultVal: string): string {
  return process.env[key] ?? defaultVal;
}

/** Default config for each sensor type (frequency & dispatch in ms) */
export const DEFAULT_SENSOR_CONFIG: SensorTypeConfig[] = [
  { sensorType: 'temperature', sampleFrequencyMs: 5_000, dispatchIntervalMs: 15_000, sensorCount: 3 },
  { sensorType: 'humidity', sampleFrequencyMs: 30_000, dispatchIntervalMs: 60_000, sensorCount: 2 },
  { sensorType: 'pressure', sampleFrequencyMs: 30_000, dispatchIntervalMs: 60_000, sensorCount: 2 },
  { sensorType: 'airflow', sampleFrequencyMs: 30_000, dispatchIntervalMs: 45_000, sensorCount: 2 },
  { sensorType: 'smoke', sampleFrequencyMs: 5_000, dispatchIntervalMs: 10_000, sensorCount: 2 },
];

/** Fog node URL to POST readings (sensor layer sends raw readings; fog batches if needed) */
export const FOG_URL = envStr('FOG_URL', 'http://localhost:4000/ingest');
/** Sensor transport mode: `http` (default, matches `npm run simulator`) or `mqtt` for IoT Core. */
export const SENSOR_TRANSPORT = envStr('SENSOR_TRANSPORT', 'http').toLowerCase();
/** MQTT broker URL — AWS IoT Core endpoint (mqtts://…:8883). Required for MQTT mode; set in .env. */
export const MQTT_BROKER_URL = (process.env.MQTT_BROKER_URL || '').trim();
/** MQTT topic root when MQTT_TOPIC_MODE=library. Full topic: <root>/<room>/<sensorType> */
export const MQTT_TOPIC_ROOT = envStr('MQTT_TOPIC_ROOT', 'library/sensors');

/**
 * `iot` — default: AWS IoT–style single data topic + JSON `{ "readings": [...] }`.
 * `library` — one message per reading, hierarchical topics under MQTT_TOPIC_ROOT.
 */
export const MQTT_TOPIC_MODE = envStr('MQTT_TOPIC_MODE', 'iot').toLowerCase() === 'library' ? 'library' : 'iot';

/** Used when MQTT_TOPIC_MODE=iot (default aligns with Thing name mock-sensor-001) */
export const MQTT_DATA_TOPIC = envStr('MQTT_DATA_TOPIC', 'sensors/mock-sensor-001/data');

/** Optional: only enable these sensor types (comma-separated). Empty = all. */
export const ENABLED_SENSOR_TYPES = envStr('ENABLED_SENSOR_TYPES', '')
  .split(',')
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean) as SensorType[];

export function getEffectiveConfig(): SensorTypeConfig[] {
  const types = ENABLED_SENSOR_TYPES.length > 0 ? ENABLED_SENSOR_TYPES : null;
  return DEFAULT_SENSOR_CONFIG.filter((c) => !types || types.includes(c.sensorType)).map((c) => ({
    ...c,
    sampleFrequencyMs: envNum(`${c.sensorType.toUpperCase()}_SAMPLE_MS`, c.sampleFrequencyMs),
    dispatchIntervalMs: envNum(`${c.sensorType.toUpperCase()}_DISPATCH_MS`, c.dispatchIntervalMs),
    sensorCount: envNum(`${c.sensorType.toUpperCase()}_COUNT`, c.sensorCount) || 1,
  }));
}
