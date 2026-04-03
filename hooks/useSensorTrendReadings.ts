'use client';

import { useState, useEffect, useCallback } from 'react';
import { useApiBackend } from '@/contexts/ApiBackendContext';
import type { SensorType } from '@/shared/schema/types';

export type TrendPoint = {
  time: string;
  rawTs: number;
  value: number;
};

export function useSensorTrendReadings(
  type: SensorType,
  options: { limit?: number; pollIntervalMs?: number } = {}
) {
  const { publicApiUrl } = useApiBackend();
  const limit = options.limit ?? 60;
  const pollIntervalMs = options.pollIntervalMs ?? 30_000;

  const fetchReadings = useCallback(async (): Promise<TrendPoint[]> => {
    try {
      const res = await fetch(publicApiUrl(`/api/sensors/${type}/readings?limit=${limit}`), {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' },
      });
      if (!res.ok) return [];
      const json = await res.json();
      const readings = json.readings;
      if (!Array.isArray(readings)) return [];
      const points: TrendPoint[] = [];
      for (const r of readings) {
        if (r?.ts == null || typeof r.value !== 'number') continue;
        const d = new Date(r.ts as string);
        points.push({
          time: `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`,
          rawTs: d.getTime(),
          value: Math.round(r.value * 1000) / 1000,
        });
      }
      points.sort((a, b) => a.rawTs - b.rawTs);
      return points;
    } catch {
      return [];
    }
  }, [type, limit, publicApiUrl]);

  const [data, setData] = useState<TrendPoint[]>([]);
  const [hasData, setHasData] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const pts = await fetchReadings();
      if (cancelled) return;
      setData(pts);
      setHasData(pts.length > 0);
    };
    run();
    const id = setInterval(run, pollIntervalMs);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [fetchReadings, pollIntervalMs]);

  return { data, hasData };
}
