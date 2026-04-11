'use client';

import { useState, useEffect, useCallback } from 'react';
import { useApiBackend } from '@/contexts/ApiBackendContext';
import { latestDemoValues } from '@/lib/demo-sensor-data';
import { isLocalApiMode, type ApiBackendMode } from '@/lib/public-api-base';
import type { SensorType } from '@/shared/schema/types';

function averageFromReadingsOrDemo(
  readings: { value?: number }[],
  type: SensorType,
  mode: ApiBackendMode,
): number | null {
  const values = readings.map((r) => r.value).filter((v): v is number => typeof v === 'number');
  if (values.length > 0) {
    return values.reduce((a, b) => a + b, 0) / values.length;
  }
  // Only synthesize demo averages when viewing the hosted Lambda API — not for “This PC”, or HTTPS→HTTP failures look “live”.
  if (isLocalApiMode(mode)) return null;
  const demo = latestDemoValues(type, 50);
  return demo.reduce((a, b) => a + b, 0) / demo.length;
}

type BackendAverages = {
  avgPressure: number | null;
  avgHumidity: number | null;
  avgAirflow: number | null;
  avgSmoke: number | null;
};

export default function BackendAveragesCards() {
  const { publicApiUrl, mode } = useApiBackend();
  const [data, setData] = useState<BackendAverages>({
    avgPressure: null,
    avgHumidity: null,
    avgAirflow: null,
    avgSmoke: null,
  });

  const load = useCallback(async () => {
    const fetchReadings = async (type: string, limit: number) => {
      try {
        const res = await fetch(publicApiUrl(`/api/sensors/${type}/readings?limit=${limit}`), {
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache' },
        });
        if (!res.ok) return [];
        const data = await res.json();
        return data.readings ?? [];
      } catch {
        return [];
      }
    };
    const [pressureR, humidityR, airflowR, smokeR] = await Promise.all([
      fetchReadings('pressure', 50),
      fetchReadings('humidity', 50),
      fetchReadings('airflow', 50),
      fetchReadings('smoke', 50),
    ]);
    setData({
      avgPressure: averageFromReadingsOrDemo(pressureR, 'pressure', mode),
      avgHumidity: averageFromReadingsOrDemo(humidityR, 'humidity', mode),
      avgAirflow: averageFromReadingsOrDemo(airflowR, 'airflow', mode),
      avgSmoke: averageFromReadingsOrDemo(smokeR, 'smoke', mode),
    });
  }, [publicApiUrl, mode]);

  useEffect(() => {
    load();
    const interval = setInterval(load, 3000);
    return () => clearInterval(interval);
  }, [load]);

  const cardClass =
    'border border-white/10 rounded-lg p-4 backdrop-blur-sm flex flex-col h-full min-h-[140px]';

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6 items-stretch">
      <div className={cardClass}>
        <p className="text-sm text-white/60 mb-2">Avg Pressure</p>
        <p className="text-3xl font-bold text-cyan-400 tabular-nums mt-auto">
          {data.avgPressure != null ? `${data.avgPressure.toFixed(1)} hPa` : '—'}
        </p>
      </div>
      <div className={cardClass}>
        <p className="text-sm text-white/60 mb-2">Avg Humidity</p>
        <p className="text-3xl font-bold text-cyan-400 tabular-nums mt-auto">
          {data.avgHumidity != null ? `${data.avgHumidity.toFixed(1)}%` : '—'}
        </p>
      </div>
      <div className={cardClass}>
        <p className="text-sm text-white/60 mb-2">Avg Airflow</p>
        <p className="text-3xl font-bold text-cyan-400 tabular-nums mt-auto">
          {data.avgAirflow != null ? `${data.avgAirflow.toFixed(0)} cfm` : '—'}
        </p>
      </div>
      <div className={cardClass}>
        <p className="text-sm text-white/60 mb-2">Smoke / Fire</p>
        <p className="text-3xl font-bold text-cyan-400 tabular-nums mt-auto">
          {data.avgSmoke != null ? `${data.avgSmoke.toFixed(1)} index` : '—'}
        </p>
      </div>
    </div>
  );
}
