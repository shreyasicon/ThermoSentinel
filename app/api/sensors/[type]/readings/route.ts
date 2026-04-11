/**
 * Dashboard API: get readings by sensor type (App Router).
 * Same process as ingest so in-memory store is shared and live data is visible.
 */
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { getReadingsAsync } from '@/lib/sensor-store';
import type { SensorType } from '@/shared/schema/types';

const VALID_TYPES: SensorType[] = [
  'temperature',
  'humidity',
  'pressure',
  'airflow',
  'smoke',
];

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ type: string }> }
) {
  const { type } = await params;
  if (!type || !VALID_TYPES.includes(type as SensorType)) {
    return NextResponse.json(
      { error: `Invalid type. Use one of: ${VALID_TYPES.join(', ')}` },
      { status: 400 }
    );
  }

  const { searchParams } = new URL(request.url);
  const limitParam = searchParams.get('limit');
  const limit = limitParam
    ? Math.min(500, Math.max(1, parseInt(limitParam, 10)))
    : 100;
  const from = searchParams.get('from') ?? undefined;
  const to = searchParams.get('to') ?? undefined;

  const readings = await getReadingsAsync(type as SensorType, {
    from,
    to,
    limit,
  });

  return NextResponse.json(
    { type, readings },
    {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    }
  );
}
