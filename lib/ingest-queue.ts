/**
 * Ingest queue: decouples HTTP ingest from processing for scalability.
 * - In-memory queue: used when REDIS_URL is not set (dev / single instance).
 * - Optional Redis/BullMQ: set REDIS_URL for multi-instance / production queue.
 * Consumer runs in-process for in-memory; run `npm run worker` for Redis.
 */

import type { FogEnvelope } from '../shared/schema/types';
import { processIngestEnvelope } from './ingest-processor';

const MAX_IN_MEMORY_QUEUE_SIZE = 10_000;

// --- In-memory queue ---
const memoryQueue: FogEnvelope[] = [];
let consumerStarted = false;

function startInMemoryConsumer() {
  if (consumerStarted) return;
  consumerStarted = true;
  const drain = async () => {
    while (memoryQueue.length > 0) {
      const envelope = memoryQueue.shift();
      if (envelope) await processIngestEnvelope(envelope);
    }
  };
  const tick = () => {
    drain().catch((err) => console.error('[ingest-queue]', err));
  };
  setInterval(tick, 50);
  tick();
}

/** Push envelope to the appropriate queue (in-memory or Redis). Returns immediately. */
export async function pushIngest(envelope: FogEnvelope): Promise<void> {
  const redisUrl = process.env.REDIS_URL;
  if (redisUrl) {
    try {
      const { Queue } = await import('bullmq');
      const { default: IORedis } = await import('ioredis');
      const connection = new IORedis(redisUrl, { maxRetriesPerRequest: null });
      const queue = new Queue<FogEnvelope>('ingest', {
        connection,
        defaultJobOptions: { removeOnComplete: { count: 1000 } },
      });
      await queue.add('envelope', envelope);
      await queue.close();
      connection.disconnect();
      return;
    } catch (err) {
      console.error('[ingest-queue] Redis unavailable, falling back to in-memory:', err);
    }
  }
  if (memoryQueue.length >= MAX_IN_MEMORY_QUEUE_SIZE) {
    console.warn('[ingest-queue] In-memory queue full, dropping oldest');
    memoryQueue.shift();
  }
  memoryQueue.push(envelope);
  startInMemoryConsumer();
  // Process this envelope immediately so the store has data before the request returns (same process as GET /api/sensors/...)
  const toProcess = memoryQueue.shift();
  if (toProcess) await processIngestEnvelope(toProcess);
}
