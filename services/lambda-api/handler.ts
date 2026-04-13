/**
 * Single Lambda: HTTP API (health, ingest, readings) + optional SQS-triggered ingest (fog → queue → Lambda).
 */

import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2,
  SQSEvent,
  SQSBatchResponse,
} from 'aws-lambda';
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

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,POST,OPTIONS',
  'access-control-allow-headers': 'content-type,authorization,x-requested-with',
};

function json(
  statusCode: number,
  body: unknown,
  headers: Record<string, string> = {},
): APIGatewayProxyResultV2 {
  return {
    statusCode,
    headers: {
      'content-type': 'application/json',
      ...CORS_HEADERS,
      ...headers,
    },
    body: JSON.stringify(body),
  };
}

function normalizePath(rawPath: string): string {
  if (!rawPath) return '/';
  const withoutTrailing = rawPath.replace(/\/+$/, '') || '/';
  if (withoutTrailing === '/api') return '/';
  if (withoutTrailing.startsWith('/api/')) return withoutTrailing.slice(4);
  return withoutTrailing;
}

function isSqsEvent(event: unknown): event is SQSEvent {
  if (!event || typeof event !== 'object') return false;
  const r = (event as { Records?: unknown }).Records;
  if (!Array.isArray(r) || r.length === 0) return false;
  return (r[0] as { eventSource?: string }).eventSource === 'aws:sqs';
}

async function handleSqs(event: SQSEvent): Promise<SQSBatchResponse> {
  const batchItemFailures: { itemIdentifier: string }[] = [];
  for (const record of event.Records) {
    const id = record.messageId ?? '';
    try {
      const parsed = JSON.parse(record.body) as unknown;
      const envelope = parsed as FogEnvelope;
      if (
        typeof envelope?.fogNodeId !== 'string' ||
        typeof envelope?.receivedAt !== 'string' ||
        !Array.isArray(envelope?.readings)
      ) {
        batchItemFailures.push({ itemIdentifier: id });
        continue;
      }
      const result = await processIngestEnvelope(envelope);
      if (!result.ok) batchItemFailures.push({ itemIdentifier: id });
    } catch {
      batchItemFailures.push({ itemIdentifier: id });
    }
  }
  return { batchItemFailures };
}

async function handleHttp(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  const method = event.requestContext?.http?.method ?? 'GET';
  const rawPath = event.rawPath ?? '';
  const path = normalizePath(rawPath);
  const qs = event.rawQueryString ?? '';

  if (method === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: CORS_HEADERS,
    };
  }

  if (method === 'GET' && (path === '/health' || rawPath === '/api/health')) {
    return json(200, {
      status: 'ok',
      timestamp: new Date().toISOString(),
      queue: process.env.INGEST_QUEUE_URL
        ? 'sqs'
        : process.env.REDIS_URL
          ? 'redis'
          : 'memory',
    });
  }

  if (method === 'POST' && (path === '/ingest' || rawPath === '/api/ingest')) {
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
      { 'cache-control': 'no-store' },
    );
  }

  const sensorMatch =
    path.match(/^\/sensors\/([^/]+)\/readings$/) ??
    rawPath.match(/^\/api\/sensors\/([^/]+)\/readings$/);
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
      },
    );
  }

  return json(404, { error: 'Not found' });
}

export async function handler(
  event: APIGatewayProxyEventV2 | SQSEvent,
): Promise<APIGatewayProxyResultV2 | SQSBatchResponse> {
  if (isSqsEvent(event)) {
    return handleSqs(event);
  }
  return handleHttp(event as APIGatewayProxyEventV2);
}
