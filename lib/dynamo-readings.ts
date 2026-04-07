/**
 * DynamoDB persistence for sensor readings (Lambda / AWS).
 * Table: PK sensorType, SK readingKey = {zeroPaddedEpochMs}#{sensorId}
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  PutCommand,
  QueryCommand,
  BatchWriteCommand,
} from '@aws-sdk/lib-dynamodb';
import type { SensorReading, SensorType } from '../shared/schema/types';

let docClient: DynamoDBDocumentClient | null = null;

function getTableName(): string {
  return (process.env.DYNAMODB_READINGS_TABLE || '').trim();
}

function getDocClient(): DynamoDBDocumentClient | null {
  const table = getTableName();
  if (!table) return null;
  if (!docClient) {
    const low = new DynamoDBClient({});
    docClient = DynamoDBDocumentClient.from(low, {
      marshallOptions: { removeUndefinedValues: true },
    });
  }
  return docClient;
}

/**
 * Dynamo is used when the table is set — except in `next dev`, where local fog/simulator
 * should use the in-memory store unless you opt in (avoids empty reads from AWS while writes stayed in RAM).
 */
export function isDynamoConfigured(): boolean {
  if (
    process.env.NODE_ENV === 'development' &&
    process.env.ALLOW_DYNAMODB_IN_NEXT_DEV !== 'true'
  ) {
    return false;
  }
  return Boolean(getTableName() && getDocClient());
}

function readingSk(reading: SensorReading): string {
  const epoch = new Date(reading.ts).getTime();
  const pad = epoch.toString().padStart(13, '0');
  return `${pad}#${reading.sensorId}`;
}

export async function dynamoAddReadings(readings: SensorReading[]): Promise<void> {
  const table = getTableName();
  const doc = getDocClient();
  if (!table || !doc || readings.length === 0) return;

  for (let i = 0; i < readings.length; i += 25) {
    const chunk = readings.slice(i, i + 25);
    const reqs = chunk.map((r) => ({
      PutRequest: {
        Item: {
          sensorType: r.sensorType,
          readingKey: readingSk(r),
          ts: r.ts,
          payload: JSON.stringify(r),
        },
      },
    }));
    await doc.send(
      new BatchWriteCommand({
        RequestItems: {
          [table]: reqs,
        },
      }),
    );
  }
}

export async function dynamoGetReadings(
  type: SensorType,
  options: { from?: string; to?: string; limit?: number } = {},
): Promise<SensorReading[]> {
  const table = getTableName();
  const doc = getDocClient();
  if (!table || !doc) return [];

  const limit = Math.min(options.limit ?? 100, 500);
  const exprVals: Record<string, unknown> = { ':t': type };
  let filter = '';
  if (options.from && options.to) {
    filter = 'ts BETWEEN :from AND :to';
    exprVals[':from'] = options.from;
    exprVals[':to'] = options.to;
  } else if (options.from) {
    filter = 'ts >= :from';
    exprVals[':from'] = options.from;
  } else if (options.to) {
    filter = 'ts <= :to';
    exprVals[':to'] = options.to;
  }

  const res = await doc.send(
    new QueryCommand({
      TableName: table,
      KeyConditionExpression: 'sensorType = :t',
      ExpressionAttributeValues: exprVals,
      ...(filter ? { FilterExpression: filter } : {}),
      ScanIndexForward: false,
      Limit: limit,
    }),
  );

  const items = res.Items ?? [];
  const readings: SensorReading[] = [];
  for (const it of items) {
    try {
      const raw = it.payload as string;
      const r = JSON.parse(raw) as SensorReading;
      if (r.sensorType === type) readings.push(r);
    } catch {
      /* skip */
    }
  }
  return readings.sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime());
}

/** Single put (e.g. tests) */
export async function dynamoPutReading(reading: SensorReading): Promise<void> {
  const table = getTableName();
  const doc = getDocClient();
  if (!table || !doc) return;
  await doc.send(
    new PutCommand({
      TableName: table,
      Item: {
        sensorType: reading.sensorType,
        readingKey: readingSk(reading),
        ts: reading.ts,
        payload: JSON.stringify(reading),
      },
    }),
  );
}
