# Scalability: Queues, FaaS-Style Processing, Health Check

## Ingest flow

```
Fog node → POST /api/ingest → validate → push to queue → 202
                                    ↓
              In-memory queue (or Redis/BullMQ when REDIS_URL set)
                                    ↓
              Consumer (in-process or separate worker) → processIngestEnvelope() → sensor-store
```

## Queue

- **In-memory (default):** No config. Envelopes are pushed to an in-process array; a consumer loop drains it and calls the processor. Works for dev and single-instance.
- **Redis/BullMQ:** Set `REDIS_URL`. Ingest API adds jobs to the `ingest` queue and returns immediately. Run a separate worker: `REDIS_URL=... npm run worker`. Use for multi-instance or production.

## FaaS-style processor

- **`lib/ingest-processor.ts`** exports `processIngestEnvelope(envelope)`. One envelope in, persist to store. Invoked by:
  - In-memory queue consumer (same process)
  - BullMQ worker (separate process)
  - Could be invoked by a serverless function or cron in a cloud setup.

## Health check

- **GET /api/health** returns `200` and `{ status: 'ok', queue: 'memory'|'redis' }`. Use for load balancer health checks and autoscaling readiness.

## Autoscaling

- App and API routes are stateless (except in-memory queue when Redis is not used). When deployed:
  - Scale the web app (e.g. multiple instances behind a load balancer); use Redis so all instances share the same queue.
  - Run one or more workers (`npm run worker`) to process the queue; scale workers independently.
  - Configure the platform’s autoscaling (e.g. CPU or request count); health check at `/api/health`.
