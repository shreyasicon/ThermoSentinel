'use client';

import { useState, useEffect } from 'react';
import { useApiBackend } from '@/contexts/ApiBackendContext';
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
  let riskScore = 0;
  sensors.forEach((sensor) => {
    if (sensor.status === 'critical') riskScore += 40;
    else if (sensor.status === 'warning') riskScore += 15;
  });
  return Math.min(100, riskScore);
};

/** Extract latest value per sensorId from backend readings; return array for indexing by slot */
function latestValuesFromReadings(
  readings: Array<{ sensorId: string; value?: number }>,
  slotCount: number
): number[] {
  const byId = new Map<string, number>();
  for (const r of readings) {
    if (r.value != null && typeof r.value === 'number' && !byId.has(r.sensorId))
      byId.set(r.sensorId, r.value);
  }
  const values = [...byId.values()];
  if (values.length === 0) return [];
  return Array.from({ length: slotCount }, (_, i) => values[i % values.length]);
}

export const useSensorData = (_initialTemp?: number, _acFailure?: boolean) => {
  const { publicApiUrl, mode } = useApiBackend();
  const [racks, setRacks] = useState<RackData[]>([]);
  const [backendTemps, setBackendTemps] = useState<number[]>([]);
  const [backendHumidity, setBackendHumidity] = useState<number[]>([]);
  const [hasData, setHasData] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const [tempRes, humRes] = await Promise.all([
        fetch(publicApiUrl('/api/sensors/temperature/readings?limit=50'), {
          cache: 'no-store',
        }),
        fetch(publicApiUrl('/api/sensors/humidity/readings?limit=50'), {
          cache: 'no-store',
        }),
      ]);
      if (cancelled) return;
      let temps: number[] = [];
      let humidity: number[] = [];
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
      // Demo values only in Lambda mode — Local must stay empty/zeros when the PC API is down.
      if (mode === 'lambda') {
        if (temps.length === 0) temps = latestDemoValues('temperature', TOTAL_SENSORS);
        if (humidity.length === 0) humidity = latestDemoValues('humidity', TOTAL_SENSORS);
      }
      setBackendTemps(temps);
      setBackendHumidity(humidity);
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
      Array.from({ length: 3 }, (_, rackIdx) => ({
        id: `rack-${rackIdx}`,
        name: `Rack ${rackIdx + 1}`,
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
          const numTemp = typeof temp === 'number' ? temp : 0;
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
      }));

    setRacks(buildRacks());
  }, [backendTemps, backendHumidity]);

  const allSensors = racks.flatMap((rack) => rack.sensors);
  const metrics: SystemMetrics = {
    avgTemperature: parseFloat(
      (allSensors.reduce((sum, s) => sum + s.temperature, 0) / allSensors.length || 0).toFixed(1)
    ),
    maxTemperature: Math.max(...allSensors.map((s) => s.temperature), 0),
    systemRiskScore: calculateRiskScore(allSensors),
    activeAlerts: allSensors.filter((s) => s.status !== 'normal').length,
  };

  return { racks, metrics, hasData };
};
