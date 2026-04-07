/**
 * FaaS-style ingest processor: single function that processes one fog envelope.
 * Designed to be invokable by a queue worker, serverless function, or cron.
 * Keeps processing logic separate from HTTP/queue layer for scalability.
 */

import { evaluateAndNotifyCritical } from './critical-alerts';
import { addReadings } from './sensor-store';
import type { FogEnvelope } from '../shared/schema/types';

export interface ProcessResult {
  accepted: number;
  ok: boolean;
  error?: string;
}

/**
 * Process a single fog envelope: validate and persist readings to the store.
 * Can be used by: in-process queue consumer, BullMQ worker, or serverless function.
 */
export async function processIngestEnvelope(envelope: FogEnvelope): Promise<ProcessResult> {
  if (
    typeof envelope?.fogNodeId !== 'string' ||
    typeof envelope?.receivedAt !== 'string' ||
    !Array.isArray(envelope?.readings)
  ) {
    return { accepted: 0, ok: false, error: 'Invalid envelope' };
  }
  try {
    await addReadings(envelope.readings);
    await evaluateAndNotifyCritical(envelope.readings, envelope.fogNodeId);
    return { accepted: envelope.readings.length, ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[ingest-processor]', message);
    return { accepted: 0, ok: false, error: message };
  }
}
