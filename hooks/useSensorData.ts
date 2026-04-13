'use client';

import { useState, useEffect } from 'react';
import { useApiBackend } from '@/contexts/ApiBackendContext';
import { getPublicApiFetchHeaders } from '@/lib/public-api-base';
import { roundTemperatureCelsius } from '@/lib/thermoutils';
import { latestDemoValues } from '@/lib/demo-sensor-data';

export interface Sensor {
  id: string;
  name: string;
  /** `null` when temperature series not loaded yet (do not treat as 0°C). */
  temperature: number | null;
  humidity: number;
  status: 'normal' | 'warning' | 'critical';
  location: string;
}

export interface RackData {
  id: string;
  name: string;
  sensors: Sensor[];
  /** Rack-level aggregates (mean of the five server slots in this rack). */
  rackPressureHpa: number | null;
  rackAirflowCfm: number | null;
  rackSmokeIndex: number | null;
}

export interface SystemMetrics {
  avgTemperature: number;
  maxTemperature: number;
  systemRiskScore: number;
  activeAlerts: number;
}

const TOTAL_SENSORS = 15; // 3 racks × 5 sensors

const getStatus = (temp: number): 'normal' | 'warning' | 'critical' => {
  if (temp > 26) return 'critical';
  if (temp > 24) return 'warning';
  return 'normal';
};

const getHumidityStatus = (humidity: number): 'normal' | 'warning' | 'critical' => {
  if (humidity > 78) return 'critical';
  if (humidity > 62) return 'warning';
  return 'normal';
};

function worseStatus(
  a: 'normal' | 'warning' | 'critical',
  b: 'normal' | 'warning' | 'critical'
): 'normal' | 'warning' | 'critical' {
  const rank = { normal: 0, warning: 1, critical: 2 };
  return rank[a] >= rank[b] ? a : b;
}

const calculateRiskScore = (sensors: Sensor[]): number => {
  const impacted = sensors.filter((s) => s.status === 'critical' || s.status === 'warning').length;
  // Product requirement: score is impacted servers as a percentage of total monitored slots (15 by default).
  return Math.round((impacted / TOTAL_SENSORS) * 100);
};

/** Numeric suffix on sensor ids (e.g. temp-7 → 7) so rack slot i aligns with sensor-i. */
function sensorIndexOrder(sensorId: string): number {
  const m = /-(\d+)$/.exec(sensorId);
  return m ? parseInt(m[1], 10) : 0;
}

/** Normalize odd API / DB shapes (snake_case, string numbers). */
function readingSensorId(r: Record<string, unknown>, index: number): string {
  const a = r.sensorId;
  const b = r.sensor_id;
  if (typeof a === 'string' && a.length > 0) return a;
  if (typeof b === 'string' && b.length > 0) return b;
  return `__row-${index}`;
}

function readingNumericValue(r: Record<string, unknown>): number | null {
  const raw = r.value ?? r.Value;
  if (raw === undefined || raw === null) return null;
  const num = typeof raw === 'number' && Number.isFinite(raw) ? raw : Number(raw);
  return Number.isFinite(num) ? num : null;
}

/**
 * Extract latest value per sensorId from backend readings; return array for indexing by slot.
 * Falls back to “any values in order” if ids/fields don’t match the strict shape (fixes missing temperature on some setups).
 */
function latestValuesFromReadings(
  readings: Array<{ sensorId?: string; value?: number; ts?: string } | Record<string, unknown>>,
  slotCount: number
): number[] {
  const byId = new Map<string, { value: number; ts: number }>();
  const looseValues: number[] = [];

  for (let i = 0; i < readings.length; i++) {
    const r = readings[i] as Record<string, unknown>;
    if (!r || typeof r !== 'object') continue;
    const num = readingNumericValue(r);
    if (num === null) continue;
    looseValues.push(num);
    const sid = readingSensorId(r, i);
    const tsRaw = r.ts ?? r.timestamp;
    const ts = tsRaw ? new Date(String(tsRaw)).getTime() : 0;
    const prev = byId.get(sid);
    if (!prev || ts >= prev.ts) byId.set(sid, { value: num, ts });
  }

  let values = [...byId.entries()]
    .sort((a, b) => sensorIndexOrder(a[0]) - sensorIndexOrder(b[0]))
    .map(([, x]) => x.value);

  // No per-sensor map (e.g. missing sensorId) — cycle through all numeric samples we saw, newest-first order preserved in looseValues
  if (values.length === 0 && looseValues.length > 0) {
    values = looseValues;
  }

  if (values.length === 0) return [];
  return Array.from({ length: slotCount }, (_, i) => values[i % values.length]);
}

function roundPressureHpa(n: number): number {
  return parseFloat(n.toFixed(1));
}

function roundAirflowCfm(n: number): number {
  return Math.round(n);
}

function roundSmokeIndex(n: number): number {
  return parseFloat(n.toFixed(2));
}

/** Mean of five consecutive slots for this rack (indices rackIdx*5 .. rackIdx*5+4). */
function rackSlotAverage(arr: number[], rackIdx: number): number | null {
  if (arr.length === 0) return null;
  const start = rackIdx * 5;
  let sum = 0;
  for (let i = 0; i < 5; i++) {
    sum += arr[(start + i) % arr.length];
  }
  return sum / 5;
}

export const useSensorData = (_initialTemp?: number, _acFailure?: boolean) => {
  const { publicApiUrl, mode } = useApiBackend();
  const [racks, setRacks] = useState<RackData[]>([]);
  const [backendTemps, setBackendTemps] = useState<number[]>([]);
  const [backendHumidity, setBackendHumidity] = useState<number[]>([]);
  const [backendPressure, setBackendPressure] = useState<number[]>([]);
  const [backendAirflow, setBackendAirflow] = useState<number[]>([]);
  const [backendSmoke, setBackendSmoke] = useState<number[]>([]);
  const [hasData, setHasData] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const urls = [
        publicApiUrl('/api/sensors/temperature/readings?limit=50'),
        publicApiUrl('/api/sensors/humidity/readings?limit=50'),
        publicApiUrl('/api/sensors/pressure/readings?limit=50'),
        publicApiUrl('/api/sensors/airflow/readings?limit=50'),
        publicApiUrl('/api/sensors/smoke/readings?limit=50'),
      ] as const;
      let settled: PromiseSettledResult<Response>[];
      try {
        settled = await Promise.allSettled(
          urls.map((u) =>
            fetch(u, {
              cache: 'no-store',
              headers: getPublicApiFetchHeaders(u),
            }),
          ),
        );
      } catch {
        if (cancelled) return;
        if (mode === 'lambda') {
          // Lambda mode remains continuously populated even during transient API issues.
          setBackendTemps(latestDemoValues('temperature', TOTAL_SENSORS));
          setBackendHumidity(latestDemoValues('humidity', TOTAL_SENSORS));
          setBackendPressure(latestDemoValues('pressure', TOTAL_SENSORS));
          setBackendAirflow(latestDemoValues('airflow', TOTAL_SENSORS));
          setBackendSmoke(latestDemoValues('smoke', TOTAL_SENSORS));
          setHasData(true);
        } else {
          // Local API / Local MQTT should be empty when local services are not running.
          setBackendTemps([]);
          setBackendHumidity([]);
          setBackendPressure([]);
          setBackendAirflow([]);
          setBackendSmoke([]);
          setHasData(false);
        }
        return;
      }
      if (cancelled) return;

      const parseOk = async (
        result: PromiseSettledResult<Response>,
      ): Promise<{ readings: Record<string, unknown>[] }> => {
        if (result.status !== 'fulfilled' || !result.value.ok) return { readings: [] };
        try {
          const data = (await result.value.json()) as { readings?: unknown };
          const raw = data.readings;
          if (!Array.isArray(raw)) return { readings: [] };
          return {
            readings: raw.filter((x): x is Record<string, unknown> => x !== null && typeof x === 'object'),
          };
        } catch {
          return { readings: [] };
        }
      };

      const [tempJ, humJ, prsJ, airJ, smkJ] = await Promise.all([
        parseOk(settled[0]),
        parseOk(settled[1]),
        parseOk(settled[2]),
        parseOk(settled[3]),
        parseOk(settled[4]),
      ]);

      const anyFetchOk = settled.some((r) => r.status === 'fulfilled' && r.value.ok);

      let temps = latestValuesFromReadings(tempJ.readings, TOTAL_SENSORS);
      let humidity = latestValuesFromReadings(humJ.readings, TOTAL_SENSORS);
      let pressure = latestValuesFromReadings(prsJ.readings, TOTAL_SENSORS);
      let airflow = latestValuesFromReadings(airJ.readings, TOTAL_SENSORS);
      let smoke = latestValuesFromReadings(smkJ.readings, TOTAL_SENSORS);

      if (mode === 'lambda') {
        // Lambda can display fallback samples when remote readings are empty.
        if (temps.length === 0) temps = latestDemoValues('temperature', TOTAL_SENSORS);
        if (humidity.length === 0) humidity = latestDemoValues('humidity', TOTAL_SENSORS);
        if (pressure.length === 0) pressure = latestDemoValues('pressure', TOTAL_SENSORS);
        if (airflow.length === 0) airflow = latestDemoValues('airflow', TOTAL_SENSORS);
        if (smoke.length === 0) smoke = latestDemoValues('smoke', TOTAL_SENSORS);
      } else if (anyFetchOk) {
        // Local API / Local MQTT: only show fallback when local API is actually reachable.
        // If nothing is running (all fetches fail), keep UI empty.
        if (temps.length === 0) temps = latestDemoValues('temperature', TOTAL_SENSORS);
        if (humidity.length === 0) humidity = latestDemoValues('humidity', TOTAL_SENSORS);
        if (pressure.length === 0) pressure = latestDemoValues('pressure', TOTAL_SENSORS);
        if (airflow.length === 0) airflow = latestDemoValues('airflow', TOTAL_SENSORS);
        if (smoke.length === 0) smoke = latestDemoValues('smoke', TOTAL_SENSORS);
      }

      setBackendTemps(temps);
      setBackendHumidity(humidity);
      setBackendPressure(pressure);
      setBackendAirflow(airflow);
      setBackendSmoke(smoke);
      const hasRackData = [temps, humidity, pressure, airflow, smoke].some((a) => a.length > 0);
      setHasData(hasRackData);
    };
    run();
    const interval = setInterval(run, 2000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [publicApiUrl, mode]);

  useEffect(() => {
    const hasBackend =
      backendTemps.length > 0 ||
      backendHumidity.length > 0 ||
      backendPressure.length > 0 ||
      backendAirflow.length > 0 ||
      backendSmoke.length > 0;

    const buildRacks = (): RackData[] =>
      Array.from({ length: 3 }, (_, rackIdx) => {
        const pAvg = rackSlotAverage(backendPressure, rackIdx);
        const aAvg = rackSlotAverage(backendAirflow, rackIdx);
        const sAvg = rackSlotAverage(backendSmoke, rackIdx);
        return {
        id: `rack-${rackIdx}`,
        name: `Rack ${rackIdx + 1}`,
        rackPressureHpa: pAvg != null ? roundPressureHpa(pAvg) : null,
        rackAirflowCfm: aAvg != null ? roundAirflowCfm(aAvg) : null,
        rackSmokeIndex: sAvg != null ? roundSmokeIndex(sAvg) : null,
        sensors: Array.from({ length: 5 }, (_, sensorIdx) => {
          const slot = rackIdx * 5 + sensorIdx;
          const tempRaw =
            hasBackend && backendTemps.length > 0
              ? backendTemps[slot % backendTemps.length]
              : null;
          const humidity =
            hasBackend && backendHumidity.length > 0
              ? backendHumidity[slot % backendHumidity.length]
              : null;
          const numTemp =
            typeof tempRaw === 'number' ? roundTemperatureCelsius(tempRaw) : null;
          const numHum = typeof humidity === 'number' ? humidity : 0;
          const serverNum = rackIdx * 5 + sensorIdx + 1;
          const status =
            numTemp == null
              ? getHumidityStatus(numHum)
              : worseStatus(getStatus(numTemp), getHumidityStatus(numHum));
          return {
            id: `sensor-${rackIdx}-${sensorIdx}`,
            name: `Server ${serverNum}`,
            temperature: numTemp,
            humidity: numHum,
            status,
            location: `Row ${String.fromCharCode(65 + rackIdx)}, Position ${sensorIdx + 1}`,
          };
        }),
        };
      });

    setRacks(buildRacks());
  }, [backendTemps, backendHumidity, backendPressure, backendAirflow, backendSmoke]);

  const allSensors = racks.flatMap((rack) => rack.sensors);
  /** Use pipeline arrays for °C — rack cells use 0 as placeholder when a series is missing, which skewed avg/max to 0.00°C. */
  const hasTemperatureReadings = backendTemps.length > 0;
  const metrics: SystemMetrics = {
    avgTemperature: hasTemperatureReadings
      ? roundTemperatureCelsius(
          backendTemps.reduce((sum, t) => sum + t, 0) / backendTemps.length,
        )
      : 0,
    maxTemperature: hasTemperatureReadings
      ? roundTemperatureCelsius(Math.max(...backendTemps))
      : 0,
    systemRiskScore: calculateRiskScore(allSensors),
    activeAlerts: allSensors.filter((s) => s.status !== 'normal').length,
  };

  return { racks, metrics, hasData, hasTemperatureReadings };
};
