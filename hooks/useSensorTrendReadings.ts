'use client';

import { useState, useEffect, useCallback } from 'react';
import { useApiBackend } from '@/contexts/ApiBackendContext';
import { generateDemoReadings } from '@/lib/demo-sensor-data';
import { getPublicApiFetchHeaders } from '@/lib/public-api-base';
import type { SensorType } from '@/shared/schema/types';

export type TrendPoint = {
  time: string;
  rawTs: number;
  value: number;
};

function readingsToTrendPoints(readings: unknown[]): TrendPoint[] {
  const points: TrendPoint[] = [];
  for (const r of readings) {
    if (!r || typeof r !== 'object') continue;
    const row = r as { ts?: string; value?: number };
    if (row.ts == null || typeof row.value !== 'number') continue;
    const d = new Date(row.ts);
    points.push({
      time: `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`,
      rawTs: d.getTime(),
      value: Math.round(row.value * 1000) / 1000,
    });
  }
  points.sort((a, b) => a.rawTs - b.rawTs);
  return points;
}

/** When the API has no series yet (local or Lambda), show the same synthetic trend so charts render. */
function demoTrendPoints(type: SensorType, limit: number): TrendPoint[] {
  return readingsToTrendPoints(generateDemoReadings(type, limit));
}

export function useSensorTrendReadings(
  type: SensorType,
  options: { limit?: number; pollIntervalMs?: number } = {}
) {
  const { publicApiUrl } = useApiBackend();
  const limit = options.limit ?? 60;
  const pollIntervalMs = options.pollIntervalMs ?? 30_000;

  const fetchReadings = useCallback(async (): Promise<TrendPoint[]> => {
    try {
      const url = publicApiUrl(`/api/sensors/${type}/readings?limit=${limit}`);
      const res = await fetch(url, {
        cache: 'no-store',
        headers: getPublicApiFetchHeaders(url),
      });
      if (!res.ok) {
        return demoTrendPoints(type, limit);
      }
      const json = await res.json();
      const readings = json.readings;
      if (!Array.isArray(readings)) {
        return demoTrendPoints(type, limit);
      }
      const points = readingsToTrendPoints(readings);
      if (points.length > 0) return points;
      return demoTrendPoints(type, limit);
    } catch {
      return demoTrendPoints(type, limit);
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
