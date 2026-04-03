#!/usr/bin/env node
/**
 * Ingest queue worker: processes fog envelopes from Redis (BullMQ).
 * Run when REDIS_URL is set for scalable, multi-instance processing.
 * Usage: REDIS_URL=... npm run worker
 */

import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import { processIngestEnvelope } from '../lib/ingest-processor';
import type { FogEnvelope } from '../shared/schema/types';

const redisUrl = process.env.REDIS_URL;
if (!redisUrl) {
  console.error('REDIS_URL is required for the worker. Exiting.');
  process.exit(1);
}

const connection = new IORedis(redisUrl, { maxRetriesPerRequest: null });

const worker = new Worker<FogEnvelope>(
  'ingest',
  async (job) => {
    const result = await processIngestEnvelope(job.data);
    if (!result.ok) throw new Error(result.error);
    return result;
  },
  {
    connection,
    concurrency: 10,
  }
);

worker.on('completed', (job) => {
  console.log(`[worker] Job ${job.id} completed: ${job.returnvalue?.accepted ?? 0} readings`);
});

worker.on('failed', (job, err) => {
  console.error(`[worker] Job ${job?.id} failed:`, err?.message);
});

worker.on('error', (err) => {
  console.error('[worker] Error:', err);
});

console.log('[worker] Ingest worker started. Waiting for jobs...');

process.on('SIGTERM', async () => {
  await worker.close();
  connection.disconnect();
  process.exit(0);
});
