import type { TrendPoint } from '@/hooks/useSensorTrendReadings';

/** Bucket key: start of minute in UTC ms */
function minuteBucketStart(ts: number): number {
  const d = new Date(ts);
  d.setSeconds(0, 0);
  return d.getTime();
}

/**
 * One sample per clock minute (keeps the last reading in each minute).
 * Produces readable X-axis labels (e.g. one "15:03" per minute, not dozens).
 */
export function aggregatePointsPerMinute(points: TrendPoint[]): TrendPoint[] {
  if (points.length === 0) return [];
  const byMinute = new Map<number, TrendPoint>();
  for (const p of points) {
    const bucket = minuteBucketStart(p.rawTs);
    const prev = byMinute.get(bucket);
    if (!prev || p.rawTs >= prev.rawTs) {
      byMinute.set(bucket, {
        rawTs: bucket,
        time: formatMinuteLabel(bucket),
        value: p.value,
      });
    }
  }
  return [...byMinute.values()].sort((a, b) => a.rawTs - b.rawTs);
}

function formatMinuteLabel(ts: number): string {
  const d = new Date(ts);
  const h = d.getHours().toString().padStart(2, '0');
  const m = d.getMinutes().toString().padStart(2, '0');
  return `${h}:${m}`;
}
