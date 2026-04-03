'use client';

import { useState, useEffect, useCallback } from 'react';
import { useApiBackend } from '@/contexts/ApiBackendContext';
import { generateDemoReadings } from '@/lib/demo-sensor-data';
import type { SensorType } from '@/shared/schema/types';

export interface BackendReading {
  sensorId: string;
  sensorType: SensorType;
  ts: string;
  value?: number;
  unit?: string;
  location?: string;
}

export function useBackendSensorReadings(type: SensorType, limit = 50) {
  const { publicApiUrl, mode } = useApiBackend();
  const [readings, setReadings] = useState<BackendReading[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDemo, setIsDemo] = useState(false);

  const fetchReadings = useCallback(async () => {
    try {
      const res = await fetch(
        publicApiUrl(`/api/sensors/${type}/readings?limit=${limit}`),
        {
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache' },
        },
      );
      if (!res.ok) throw new Error(res.statusText);
      const data = await res.json();
      const fetched = data.readings ?? [];
      if (Array.isArray(fetched) && fetched.length > 0) {
        setReadings(fetched);
        setError(null);
        setIsDemo(false);
      } else if (mode === 'lambda') {
        setReadings(generateDemoReadings(type, limit));
        setError(null);
        setIsDemo(true);
      } else {
        setReadings([]);
        setError(null);
        setIsDemo(false);
      }
    } catch (e) {
      setError(null);
      if (mode === 'lambda') {
        setReadings(generateDemoReadings(type, limit));
        setIsDemo(true);
      } else {
        setReadings([]);
        setIsDemo(false);
      }
    } finally {
      setLoading(false);
    }
  }, [type, limit, publicApiUrl, mode]);

  useEffect(() => {
    setLoading(true);
    fetchReadings();
    const interval = setInterval(fetchReadings, 2000);
    return () => clearInterval(interval);
  }, [fetchReadings]);

  return { readings, loading, error, isDemo, refetch: fetchReadings };
}
