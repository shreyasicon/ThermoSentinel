'use client';

import { useState, useEffect } from 'react';
import { useApiBackend } from '@/contexts/ApiBackendContext';
import { roundTemperatureCelsius } from '@/lib/thermoutils';
import { latestDemoValues } from '@/lib/demo-sensor-data';

export interface Sensor {
  id: string;
  name: string;
  temperature: number;
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

/** Extract latest value per sensorId from backend readings; return array for indexing by slot */
function latestValuesFromReadings(
  readings: Array<{ sensorId: string; value?: number; ts?: string }>,
  slotCount: number
): number[] {
  const byId = new Map<string, { value: number; ts: number }>();
  for (const r of readings) {
    if (r.value == null || typeof r.value !== 'number') continue;
    const ts = r.ts ? new Date(r.ts).getTime() : 0;
    const prev = byId.get(r.sensorId);
    if (!prev || ts >= prev.ts) byId.set(r.sensorId, { value: r.value, ts });
  }
  const values = [...byId.values()].map((x) => x.value);
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
      let tempRes: Response;
      let humRes: Response;
      let prsRes: Response;
      let airRes: Response;
      let smkRes: Response;
      try {
        [tempRes, humRes, prsRes, airRes, smkRes] = await Promise.all([
          fetch(publicApiUrl('/api/sensors/temperature/readings?limit=50'), {
            cache: 'no-store',
          }),
          fetch(publicApiUrl('/api/sensors/humidity/readings?limit=50'), {
            cache: 'no-store',
          }),
          fetch(publicApiUrl('/api/sensors/pressure/readings?limit=50'), {
            cache: 'no-store',
          }),
          fetch(publicApiUrl('/api/sensors/airflow/readings?limit=50'), {
            cache: 'no-store',
          }),
          fetch(publicApiUrl('/api/sensors/smoke/readings?limit=50'), {
            cache: 'no-store',
          }),
        ]);
      } catch {
        if (cancelled) return;
        if (mode === 'lambda') {
          setBackendTemps(latestDemoValues('temperature', TOTAL_SENSORS));
          setBackendHumidity(latestDemoValues('humidity', TOTAL_SENSORS));
          setBackendPressure(latestDemoValues('pressure', TOTAL_SENSORS));
          setBackendAirflow(latestDemoValues('airflow', TOTAL_SENSORS));
          setBackendSmoke(latestDemoValues('smoke', TOTAL_SENSORS));
          setHasData(true);
        }
        return;
      }
      if (cancelled) return;
      let temps: number[] = [];
      let humidity: number[] = [];
      let pressure: number[] = [];
      let airflow: number[] = [];
      let smoke: number[] = [];
      let gotReal = false;
      if (tempRes.ok) {
        const { readings } = await tempRes.json();
        const t = latestValuesFromReadings(readings ?? [], TOTAL_SENSORS);
        if (t.length > 0) {
          temps = t;
          gotReal = true;
        }
      }
      if (humRes.ok) {
        const { readings } = await humRes.json();
        const h = latestValuesFromReadings(readings ?? [], TOTAL_SENSORS);
        if (h.length > 0) {
          humidity = h;
          gotReal = true;
        }
      }
      if (prsRes.ok) {
        const { readings } = await prsRes.json();
        const p = latestValuesFromReadings(readings ?? [], TOTAL_SENSORS);
        if (p.length > 0) {
          pressure = p;
          gotReal = true;
        }
      }
      if (airRes.ok) {
        const { readings } = await airRes.json();
        const a = latestValuesFromReadings(readings ?? [], TOTAL_SENSORS);
        if (a.length > 0) {
          airflow = a;
          gotReal = true;
        }
      }
      if (smkRes.ok) {
        const { readings } = await smkRes.json();
        const s = latestValuesFromReadings(readings ?? [], TOTAL_SENSORS);
        if (s.length > 0) {
          smoke = s;
          gotReal = true;
        }
      }
      // Demo values only when using hosted Lambda API and readings are empty (no fake “live” data on local PC).
      if (mode === 'lambda') {
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
      setHasData(gotReal || mode === 'lambda');
    };
    run();
    const interval = setInterval(run, 2000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [publicApiUrl, mode]);

  useEffect(() => {
    const hasBackend = backendTemps.length > 0 || backendHumidity.length > 0;

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
          const temp =
            hasBackend && backendTemps.length > 0
              ? backendTemps[slot % backendTemps.length]
              : null;
          const humidity =
            hasBackend && backendHumidity.length > 0
              ? backendHumidity[slot % backendHumidity.length]
              : null;
          const numTemp = typeof temp === 'number' ? roundTemperatureCelsius(temp) : 0;
          const numHum = typeof humidity === 'number' ? humidity : 0;
          const serverNum = rackIdx * 5 + sensorIdx + 1;
          return {
            id: `sensor-${rackIdx}-${sensorIdx}`,
            name: `Server ${serverNum}`,
            temperature: numTemp,
            humidity: numHum,
            status: worseStatus(getStatus(numTemp), getHumidityStatus(numHum)),
            location: `Row ${String.fromCharCode(65 + rackIdx)}, Position ${sensorIdx + 1}`,
          };
        }),
        };
      });

    setRacks(buildRacks());
  }, [backendTemps, backendHumidity, backendPressure, backendAirflow, backendSmoke]);

  const allSensors = racks.flatMap((rack) => rack.sensors);
  const metrics: SystemMetrics = {
    avgTemperature: roundTemperatureCelsius(
      allSensors.reduce((sum, s) => sum + s.temperature, 0) / allSensors.length || 0,
    ),
    maxTemperature: roundTemperatureCelsius(
      Math.max(...allSensors.map((s) => s.temperature), 0),
    ),
    systemRiskScore: calculateRiskScore(allSensors),
    activeAlerts: allSensors.filter((s) => s.status !== 'normal').length,
  };

  return { racks, metrics, hasData };
};
