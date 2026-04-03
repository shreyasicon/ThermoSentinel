/**
 * Cloud ingest API (App Router).
 * Accepts fog envelope, enqueues for processing, returns 202.
 */

import { NextRequest, NextResponse } from 'next/server';
import { pushIngest } from '@/lib/ingest-queue';
import type { FogEnvelope } from '@/shared/schema/types';

export const dynamic = 'auto';
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const envelope = body as FogEnvelope;
  if (
    typeof envelope?.fogNodeId !== 'string' ||
    typeof envelope?.receivedAt !== 'string' ||
    !Array.isArray(envelope?.readings)
  ) {
    return NextResponse.json(
      { error: 'Invalid envelope: fogNodeId, receivedAt, readings required' },
      { status: 400 }
    );
  }

  await pushIngest(envelope);
  return NextResponse.json(
    { accepted: envelope.readings.length, queued: true },
    { status: 202, headers: { 'Cache-Control': 'no-store' } }
  );
}
