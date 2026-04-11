/**
 * Basic validation and range checks for sensor readings (fog layer).
 */

import type { SensorReading, SensorType } from '../../shared/schema/types.js';

const RANGES: Record<string, { min: number; max: number }> = {
  temperature: { min: -10, max: 60 },
  humidity: { min: 0, max: 100 },
  pressure: { min: 900, max: 1100 },
  airflow: { min: 0, max: 5000 },
  smoke: { min: 0, max: 100 },
};

function hasRequiredFields(r: unknown): r is Record<string, unknown> {
  return typeof r === 'object' && r !== null && 'sensorId' in r && 'sensorType' in r && 'ts' in r;
}

function isValidSensorType(t: string): t is SensorType {
  return ['temperature', 'humidity', 'pressure', 'airflow', 'smoke'].includes(t);
}

export function validateReading(r: unknown): SensorReading | null {
  if (!hasRequiredFields(r)) return null;
  const { sensorId, sensorType, ts } = r;
  if (typeof sensorId !== 'string' || !isValidSensorType(String(sensorType)) || typeof ts !== 'string')
    return null;

  const type = sensorType as SensorType;

  if (type === 'temperature') {
    const value = Number((r as { value?: unknown }).value);
    if (!Number.isFinite(value) || value < RANGES.temperature.min || value > RANGES.temperature.max)
      return null;
    return { ...r, sensorId, sensorType: 'temperature', ts, value, unit: 'celsius', location: (r as { location?: string }).location } as SensorReading;
  }

  if (type === 'humidity') {
    const value = Number((r as { value?: unknown }).value);
    if (!Number.isFinite(value) || value < RANGES.humidity.min || value > RANGES.humidity.max)
      return null;
    return { ...r, sensorId, sensorType: 'humidity', ts, value, unit: 'percent', location: (r as { location?: string }).location } as SensorReading;
  }

  if (type === 'pressure') {
    const value = Number((r as { value?: unknown }).value);
    if (!Number.isFinite(value) || value < RANGES.pressure.min || value > RANGES.pressure.max)
      return null;
    return { ...r, sensorId, sensorType: 'pressure', ts, value, unit: 'hpa', location: (r as { location?: string }).location } as SensorReading;
  }

  if (type === 'airflow') {
    const value = Number((r as { value?: unknown }).value);
    if (!Number.isFinite(value) || value < RANGES.airflow.min || value > RANGES.airflow.max)
      return null;
    return { ...r, sensorId, sensorType: 'airflow', ts, value, unit: 'cfm', location: (r as { location?: string }).location } as SensorReading;
  }

  if (type === 'smoke') {
    const value = Number((r as { value?: unknown }).value);
    if (!Number.isFinite(value) || value < RANGES.smoke.min || value > RANGES.smoke.max)
      return null;
    return { ...r, sensorId, sensorType: 'smoke', ts, value, unit: 'index', location: (r as { location?: string }).location } as SensorReading;
  }

  return null;
}

export function validateBody(body: unknown): { readings: SensorReading[] } | null {
  if (typeof body !== 'object' || body === null) return null;
  const r = (body as { readings?: unknown }).readings;
  if (!Array.isArray(r)) return null;
  const readings: SensorReading[] = [];
  for (const item of r) {
    const valid = validateReading(item);
    if (valid) readings.push(valid);
  }
  return readings.length > 0 ? { readings } : null;
}

/**
 * MQTT payload shapes from edge:
 * - single `SensorReading` JSON object
 * - `{ "readings": [ ... ] }` (AWS IoT tutorial / batch)
 * - JSON array of readings
 */
export function parseReadingsFromMqttPayload(payloadUtf8: string): SensorReading[] | null {
  const raw = payloadUtf8.replace(/^\uFEFF/, '').trim();
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (Array.isArray(parsed)) {
    const v = validateBody({ readings: parsed });
    return v?.readings ?? null;
  }
  if (typeof parsed === 'object' && parsed !== null && 'readings' in parsed) {
    const v = validateBody(parsed);
    return v?.readings ?? null;
  }
  const one = validateReading(parsed);
  return one ? [one] : null;
}
