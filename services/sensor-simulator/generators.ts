/**
 * Generate mock readings for each sensor type (shared schema types).
 */

import type {
  SensorReading,
  TemperatureReading,
  HumidityReading,
  PressureReading,
  AirflowReading,
  SmokeReading,
} from '../../shared/schema/types';

function ts(): string {
  return new Date().toISOString();
}

export function generateTemperature(sensorIndex: number, location?: string): TemperatureReading {
  const base = 20 + (Math.random() - 0.5) * 6;
  return {
    sensorId: `temp-${sensorIndex}`,
    sensorType: 'temperature',
    ts: ts(),
    value: Math.round(base * 10) / 10,
    unit: 'celsius',
    location: location ?? `zone-${sensorIndex}`,
  };
}

export function generateHumidity(sensorIndex: number, location?: string): HumidityReading {
  const value = 35 + Math.random() * 45;
  return {
    sensorId: `hum-${sensorIndex}`,
    sensorType: 'humidity',
    ts: ts(),
    value: Math.round(value * 10) / 10,
    unit: 'percent',
    location: location ?? `zone-${sensorIndex}`,
  };
}

export function generatePressure(sensorIndex: number, location?: string): PressureReading {
  const value = 1000 + (Math.random() - 0.5) * 40;
  return {
    sensorId: `press-${sensorIndex}`,
    sensorType: 'pressure',
    ts: ts(),
    value: Math.round(value * 10) / 10,
    unit: 'hpa',
    location: location ?? `zone-${sensorIndex}`,
  };
}

export function generateAirflow(sensorIndex: number, location?: string): AirflowReading {
  const value = 800 + Math.random() * 1200;
  return {
    sensorId: `airflow-${sensorIndex}`,
    sensorType: 'airflow',
    ts: ts(),
    value: Math.round(value),
    unit: 'cfm',
    location: location ?? `zone-${sensorIndex}`,
  };
}

export function generateSmoke(sensorIndex: number, location?: string): SmokeReading {
  const base = Math.random() * 8;
  const value = base < 0.5 ? Math.min(100, 15 + Math.random() * 25) : Math.min(100, base * 12);
  return {
    sensorId: `smoke-${sensorIndex}`,
    sensorType: 'smoke',
    ts: ts(),
    value: Math.round(value * 10) / 10,
    unit: 'index',
    location: location ?? `zone-${sensorIndex}`,
  };
}

const generators: Record<string, (i: number, loc?: string) => SensorReading> = {
  temperature: generateTemperature,
  humidity: generateHumidity,
  pressure: generatePressure,
  airflow: generateAirflow,
  smoke: generateSmoke,
};

export function generateReadings(
  sensorType: string,
  sensorCount: number
): SensorReading[] {
  const gen = generators[sensorType];
  if (!gen) return [];
  return Array.from({ length: sensorCount }, (_, i) => gen(i));
}
