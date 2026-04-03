/**
 * Shared payload schema for Fog & Edge pipeline.
 * Used by: sensor simulator, fog node, cloud backend, dashboard.
 */

/** Sensor type identifiers (3–5 types per assignment) */
export type SensorType = 'temperature' | 'humidity' | 'pressure' | 'airflow' | 'smoke';

/** ISO8601 timestamp string */
export type Timestamp = string;

/** Base fields present on every sensor reading */
export interface BaseSensorReading {
  sensorId: string;
  sensorType: SensorType;
  ts: Timestamp;
  location?: string;
}

/** Temperature: value in Celsius */
export interface TemperatureReading extends BaseSensorReading {
  sensorType: 'temperature';
  value: number;
  unit: 'celsius';
}

/** Humidity: value in % */
export interface HumidityReading extends BaseSensorReading {
  sensorType: 'humidity';
  value: number;
  unit: 'percent';
}

/** Pressure: value in hPa */
export interface PressureReading extends BaseSensorReading {
  sensorType: 'pressure';
  value: number;
  unit: 'hpa';
}

/** Airflow: datacenter cooling airflow in CFM (cubic feet per minute) */
export interface AirflowReading extends BaseSensorReading {
  sensorType: 'airflow';
  value: number;
  unit: 'cfm';
}

/** Smoke/Fire: detector level 0–100 (index); datacenter safety */
export interface SmokeReading extends BaseSensorReading {
  sensorType: 'smoke';
  value: number;
  unit: 'index';
}

/** Union of all sensor readings (edge → fog) */
export type SensorReading =
  | TemperatureReading
  | HumidityReading
  | PressureReading
  | AirflowReading
  | SmokeReading;

/** Fog node adds metadata when forwarding to cloud */
export interface FogEnvelope {
  fogNodeId: string;
  receivedAt: Timestamp;
  readings: SensorReading[];
}

/** Single reading as stored/returned by backend (e.g. for dashboards) */
export interface StoredReading {
  id?: string;
  sensorId: string;
  sensorType: SensorType;
  ts: Timestamp;
  /** Type-specific value for querying/display */
  value: number;
  unit?: string;
  location?: string;
  fogNodeId?: string;
}

/** Config for sensor simulator: frequency (ms) and dispatch interval (ms) */
export interface SensorTypeConfig {
  sensorType: SensorType;
  /** How often to sample (milliseconds) */
  sampleFrequencyMs: number;
  /** How often to send batch to fog (milliseconds) */
  dispatchIntervalMs: number;
  /** Number of virtual sensors of this type */
  sensorCount?: number;
}
