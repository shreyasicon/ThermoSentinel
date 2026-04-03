'use client';

import { useState, useEffect, useCallback } from 'react';
import { useApiBackend } from '@/contexts/ApiBackendContext';

type BackendAverages = {
  avgPressure: number | null;
  avgHumidity: number | null;
  avgAirflow: number | null;
  avgSmoke: number | null;
};

export default function BackendAveragesCards() {
  const { publicApiUrl } = useApiBackend();
  const [data, setData] = useState<BackendAverages>({
    avgPressure: null,
    avgHumidity: null,
    avgAirflow: null,
    avgSmoke: null,
  });
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const fetchReadings = async (type: string, limit: number) => {
      const res = await fetch(publicApiUrl(`/api/sensors/${type}/readings?limit=${limit}`), {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' },
      });
      if (!res.ok) return [];
      const data = await res.json();
      return data.readings ?? [];
    };
    try {
      const [pressureR, humidityR, airflowR, smokeR] = await Promise.all([
        fetchReadings('pressure', 50),
        fetchReadings('humidity', 50),
        fetchReadings('airflow', 50),
        fetchReadings('smoke', 50),
      ]);
      const pressureValues = pressureR.map((r: { value?: number }) => r.value).filter((v: unknown) => typeof v === 'number');
      const humidityValues = humidityR.map((r: { value?: number }) => r.value).filter((v: unknown) => typeof v === 'number');
      const airflowValues = airflowR.map((r: { value?: number }) => r.value).filter((v: unknown) => typeof v === 'number');
      const smokeValues = smokeR.map((r: { value?: number }) => r.value).filter((v: unknown) => typeof v === 'number');
      setData({
        avgPressure: pressureValues.length ? pressureValues.reduce((a: number, b: number) => a + b, 0) / pressureValues.length : null,
        avgHumidity: humidityValues.length ? humidityValues.reduce((a: number, b: number) => a + b, 0) / humidityValues.length : null,
        avgAirflow: airflowValues.length ? airflowValues.reduce((a: number, b: number) => a + b, 0) / airflowValues.length : null,
        avgSmoke: smokeValues.length ? smokeValues.reduce((a: number, b: number) => a + b, 0) / smokeValues.length : null,
      });
    } catch {
      setData({ avgPressure: null, avgHumidity: null, avgAirflow: null, avgSmoke: null });
    } finally {
      setLoading(false);
    }
  }, [publicApiUrl]);

  useEffect(() => {
    load();
    const interval = setInterval(load, 3000);
    return () => clearInterval(interval);
  }, [load]);

  const cardClass =
    'border border-white/10 rounded-lg p-4 backdrop-blur-sm flex flex-col h-full min-h-[140px]';

  if (loading && data.avgPressure === null && data.avgHumidity === null && data.avgAirflow === null && data.avgSmoke === null) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6 items-stretch">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="border border-white/10 rounded-lg p-4 backdrop-blur-sm animate-pulse min-h-[140px] bg-white/5"
          />
        ))}
      </div>
    );
  }

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
