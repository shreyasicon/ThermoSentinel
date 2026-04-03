/**
 * Single Lambda behind API Gateway HTTP API — mirrors Next.js routes:
 * GET /api/health, POST /api/ingest, GET /api/sensors/{type}/readings
 *
 * For production serverless, set TURSO_DATABASE_URL + TURSO_AUTH_TOKEN so reads/writes
 * survive cold starts and concurrent executions. In-memory only is best-effort on Lambda.
 */

import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { getReadingsAsync } from '../../lib/sensor-store';
import { processIngestEnvelope } from '../../lib/ingest-processor';
import type { FogEnvelope, SensorType } from '../../shared/schema/types';

const VALID_TYPES: SensorType[] = [
  'temperature',
  'humidity',
  'pressure',
  'airflow',
  'smoke',
];

function json(
  statusCode: number,
  body: unknown,
  headers: Record<string, string> = {}
): APIGatewayProxyResultV2 {
  return {
    statusCode,
    headers: {
      'content-type': 'application/json',
      ...headers,
    },
    body: JSON.stringify(body),
  };
}

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  const method = event.requestContext?.http?.method ?? 'GET';
  const rawPath = event.rawPath ?? '';
  const qs = event.rawQueryString ?? '';

  if (method === 'GET' && rawPath === '/api/health') {
    return json(200, {
      status: 'ok',
      timestamp: new Date().toISOString(),
      queue: process.env.REDIS_URL ? 'redis' : 'memory',
    });
  }

  if (method === 'POST' && rawPath === '/api/ingest') {
    if (!event.body) {
      return json(400, { error: 'Empty body' });
    }
    let parsed: unknown;
    try {
      const raw =
        event.isBase64Encoded && event.body
          ? Buffer.from(event.body, 'base64').toString('utf8')
          : event.body;
      parsed = JSON.parse(raw);
    } catch {
      return json(400, { error: 'Invalid JSON' });
    }
    const envelope = parsed as FogEnvelope;
    if (
      typeof envelope?.fogNodeId !== 'string' ||
      typeof envelope?.receivedAt !== 'string' ||
      !Array.isArray(envelope?.readings)
    ) {
      return json(400, {
        error: 'Invalid envelope: fogNodeId, receivedAt, readings required',
      });
    }
    const result = await processIngestEnvelope(envelope);
    if (!result.ok) {
      return json(400, { error: result.error ?? 'Processing failed' });
    }
    return json(
      202,
      { accepted: result.accepted, queued: false },
      { 'cache-control': 'no-store' }
    );
  }

  const sensorMatch = rawPath.match(/^\/api\/sensors\/([^/]+)\/readings$/);
  if (method === 'GET' && sensorMatch) {
    const type = sensorMatch[1];
    if (!VALID_TYPES.includes(type as SensorType)) {
      return json(400, {
        error: `Invalid type. Use one of: ${VALID_TYPES.join(', ')}`,
      });
    }
    const params = new URLSearchParams(qs);
    const limitParam = params.get('limit');
    const limit = limitParam
      ? Math.min(500, Math.max(1, parseInt(limitParam, 10)))
      : 100;
    const from = params.get('from') ?? undefined;
    const to = params.get('to') ?? undefined;

    const readings = await getReadingsAsync(type as SensorType, { from, to, limit });
    return json(
      200,
      { type, readings },
      {
        'cache-control': 'no-store, no-cache, must-revalidate',
      }
    );
  }

  return json(404, { error: 'Not found' });
}
