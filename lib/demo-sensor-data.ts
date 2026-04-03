import type { SensorType } from '@/shared/schema/types';

type DemoReading = {
  sensorId: string;
  sensorType: SensorType;
  ts: string;
  value: number;
  unit: string;
  location: string;
};

const SENSOR_IDS: Record<SensorType, string[]> = {
  temperature: ['temp-a1', 'temp-a2', 'temp-b1', 'temp-b2', 'temp-c1'],
  humidity: ['hum-a1', 'hum-a2', 'hum-b1', 'hum-b2', 'hum-c1'],
  pressure: ['prs-a1', 'prs-a2', 'prs-b1', 'prs-b2', 'prs-c1'],
  airflow: ['air-a1', 'air-a2', 'air-b1', 'air-b2', 'air-c1'],
  smoke: ['smk-a1', 'smk-a2', 'smk-b1', 'smk-b2', 'smk-c1'],
};

function baseForType(type: SensorType): number {
  if (type === 'temperature') return 22.8;
  if (type === 'humidity') return 47;
  if (type === 'pressure') return 1012;
  if (type === 'airflow') return 560;
  return 0.03;
}

function amplitudeForType(type: SensorType): number {
  if (type === 'temperature') return 1.8;
  if (type === 'humidity') return 8;
  if (type === 'pressure') return 3.5;
  if (type === 'airflow') return 80;
  return 0.12;
}

function unitForType(type: SensorType): string {
  if (type === 'temperature') return 'C';
  if (type === 'humidity') return '%';
  if (type === 'pressure') return 'hPa';
  if (type === 'airflow') return 'cfm';
  return 'index';
}

function clamp(type: SensorType, value: number): number {
  if (type === 'temperature') return Math.max(18, Math.min(31, value));
  if (type === 'humidity') return Math.max(25, Math.min(85, value));
  if (type === 'pressure') return Math.max(990, Math.min(1030, value));
  if (type === 'airflow') return Math.max(250, Math.min(900, value));
  return Math.max(0, Math.min(100, value));
}

export function generateDemoReadings(type: SensorType, limit = 50): DemoReading[] {
  const ids = SENSOR_IDS[type];
  const now = Date.now();
  const base = baseForType(type);
  const amp = amplitudeForType(type);
  const unit = unitForType(type);

  return Array.from({ length: limit }, (_, i) => {
    const sensorIdx = i % ids.length;
    const phase = (now / 1000 - i * 2 + sensorIdx * 7) / 18;
    const value = clamp(type, base + Math.sin(phase) * amp + Math.cos(phase * 0.7) * amp * 0.18);
    return {
      sensorId: ids[sensorIdx],
      sensorType: type,
      ts: new Date(now - i * 2000).toISOString(),
      value: Number(value.toFixed(type === 'smoke' ? 2 : 1)),
      unit,
      location: `Row ${String.fromCharCode(65 + sensorIdx)}, Position ${sensorIdx + 1}`,
    };
  });
}

/**
 * Live-feel demo values: varies over time so dashboard metrics (alerts, risk, health) move.
 * Temperature spreads across slots and oscillates so some sensors cross warning/critical bands.
 */
export function latestDemoValues(type: SensorType, count: number): number[] {
  const t = Date.now() / 1000;

  if (type === 'temperature') {
    return Array.from({ length: count }, (_, i) => {
      const spread = 20.5 + (i % 15) * 0.62;
      const wave =
        Math.sin(t / 22 + i * 0.35) * 3.2 + Math.sin(t / 9 + i * 0.2) * 1.4 + Math.sin(t / 41) * 0.8;
      return clamp('temperature', spread + wave);
    });
  }

  if (type === 'humidity') {
    return Array.from({ length: count }, (_, i) => {
      const base = 38 + (i % 12) * 2.2;
      const wave = Math.sin(t / 35 + i * 0.3) * 10 + Math.cos(t / 17) * 4;
      return clamp('humidity', base + wave);
    });
  }

  const list = generateDemoReadings(type, Math.max(count, 5));
  return Array.from({ length: count }, (_, i) => {
    const base = list[i % list.length].value;
    const wobble =
      type === 'pressure'
        ? Math.sin(t / 28 + i * 0.2) * 2
        : type === 'airflow'
          ? Math.sin(t / 19 + i * 0.25) * 45
          : Math.sin(t / 14 + i * 0.4) * 0.08;
    return clamp(type, base + wobble);
  });
}

