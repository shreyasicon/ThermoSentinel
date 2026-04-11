import {
  dynamoAddReadings,
  dynamoGetReadings,
  isDynamoConfigured,
} from './dynamo-readings';
import type { SensorReading, SensorType } from '../shared/schema/types';

const MAX_READINGS_PER_TYPE = 1000;

/**
 * Next.js dev (Turbopack) can load multiple copies of this module — separate `Map` instances
 * meant ingest wrote to store A while GET /api/sensors/* read store B (empty charts).
 * Pin the in-memory store on `globalThis` so all bundles share one map.
 */
const g = globalThis as unknown as {
  __thermoSentinelSensorByType?: Map<SensorType, SensorReading[]>;
};

function getByTypeMap(): Map<SensorType, SensorReading[]> {
  if (!g.__thermoSentinelSensorByType) {
    g.__thermoSentinelSensorByType = new Map();
  }
  return g.__thermoSentinelSensorByType;
}

function getKey(type: SensorType): SensorType {
  return type;
}

// --- Turso (optional) ---
let tursoClient: ReturnType<typeof createTursoClient> = null;

function createTursoClient() {
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (!url || !authToken) return null;
  try {
    const { createClient } = require('@libsql/client');
    return createClient({ url, authToken });
  } catch {
    return null;
  }
}

function getTurso() {
  if (tursoClient === null) tursoClient = createTursoClient();
  return tursoClient;
}

const INIT_SQL = `
CREATE TABLE IF NOT EXISTS sensor_readings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sensor_type TEXT NOT NULL,
  sensor_id TEXT NOT NULL,
  ts TEXT NOT NULL,
  payload TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_sensor_readings_type_ts ON sensor_readings(sensor_type, ts DESC);
`;

async function ensureTursoSchema(client: NonNullable<ReturnType<typeof getTurso>>) {
  await client.execute(INIT_SQL);
}

async function tursoAddReadings(readings: SensorReading[]): Promise<void> {
  const client = getTurso();
  if (!client) return;
  await ensureTursoSchema(client);
  for (const r of readings) {
    await client.execute({
      sql: 'INSERT INTO sensor_readings (sensor_type, sensor_id, ts, payload) VALUES (?, ?, ?, ?)',
      args: [r.sensorType, r.sensorId, r.ts, JSON.stringify(r)],
    });
  }
  // Prune per type to avoid unbounded growth
  for (const type of ['temperature', 'humidity', 'pressure', 'airflow', 'smoke'] as const) {
    const rows = await client.execute({
      sql: 'SELECT id FROM sensor_readings WHERE sensor_type = ? ORDER BY ts DESC LIMIT 1 OFFSET ?',
      args: [type, MAX_READINGS_PER_TYPE - 1],
    });
    if (rows.rows.length > 0) {
      const keepAboveId = rows.rows[0].id as number;
      await client.execute({
        sql: 'DELETE FROM sensor_readings WHERE sensor_type = ? AND id < ?',
        args: [type, keepAboveId],
      });
    }
  }
}

function memoryAddReadings(readings: SensorReading[]): void {
  const byType = getByTypeMap();
  for (const r of readings) {
    const key = getKey(r.sensorType);
    let list = byType.get(key);
    if (!list) {
      list = [];
      byType.set(key, list);
    }
    list.push(r);
    if (list.length > MAX_READINGS_PER_TYPE) list.shift();
  }
}

export async function addReadings(readings: SensorReading[]): Promise<void> {
  memoryAddReadings(readings);
  if (isDynamoConfigured()) {
    try {
      await dynamoAddReadings(readings);
    } catch (err) {
      console.error('DynamoDB addReadings error:', err);
    }
    return;
  }
  const client = getTurso();
  if (client) {
    try {
      await tursoAddReadings(readings);
    } catch (err) {
      console.error('Turso addReadings error:', err);
    }
  }
}

async function tursoGetReadings(
  type: SensorType,
  options: { from?: string; to?: string; limit?: number }
): Promise<SensorReading[]> {
  const client = getTurso();
  if (!client) return [];
  await ensureTursoSchema(client);
  const limit = Math.min(options.limit ?? 100, 500);
  let sql = 'SELECT payload FROM sensor_readings WHERE sensor_type = ?';
  const args: (string | number)[] = [type];
  if (options.from) {
    sql += ' AND ts >= ?';
    args.push(options.from);
  }
  if (options.to) {
    sql += ' AND ts <= ?';
    args.push(options.to);
  }
  sql += ' ORDER BY ts DESC LIMIT ?';
  args.push(limit);
  const result = await client.execute({ sql, args });
  const readings: SensorReading[] = [];
  for (const row of result.rows) {
    try {
      const r = JSON.parse(row.payload as string) as SensorReading;
      if (r.sensorType === type) readings.push(r);
    } catch {
      // skip invalid row
    }
  }
  return readings.reverse();
}

function memoryGetReadings(
  type: SensorType,
  options: { from?: string; to?: string; limit?: number } = {}
): SensorReading[] {
  const byType = getByTypeMap();
  const list = byType.get(type) ?? [];
  let out = [...list].reverse();
  if (options.from) {
    const from = new Date(options.from).getTime();
    out = out.filter((r) => new Date(r.ts).getTime() >= from);
  }
  if (options.to) {
    const to = new Date(options.to).getTime();
    out = out.filter((r) => new Date(r.ts).getTime() <= to);
  }
  const limit = options.limit ?? 100;
  return out.slice(0, limit);
}

export function getReadings(
  type: SensorType,
  options: { from?: string; to?: string; limit?: number } = {}
): SensorReading[] {
  return memoryGetReadings(type, options);
}

/** Async version for API route: merges Turso + memory when Turso is configured */
export async function getReadingsAsync(
  type: SensorType,
  options: { from?: string; to?: string; limit?: number } = {}
): Promise<SensorReading[]> {
  if (isDynamoConfigured()) {
    try {
      const fromDynamo = await dynamoGetReadings(type, options);
      const fromMemory = memoryGetReadings(type, options);
      const byKey = new Map<string, SensorReading>();
      for (const r of [...fromMemory, ...fromDynamo]) {
        const key = `${r.ts}-${r.sensorId}`;
        if (!byKey.has(key)) byKey.set(key, r);
      }
      const merged = [...byKey.values()].sort(
        (a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime()
      );
      const limit = options.limit ?? 100;
      return merged.slice(-limit).reverse();
    } catch (err) {
      console.error('DynamoDB getReadings error:', err);
      return memoryGetReadings(type, options);
    }
  }

  const fromMemory = memoryGetReadings(type, options);
  const client = getTurso();
  if (!client) return fromMemory;
  try {
    const fromTurso = await tursoGetReadings(type, options);
    // Merge and dedupe by ts + sensorId; prefer latest
    const byKey = new Map<string, SensorReading>();
    for (const r of [...fromMemory, ...fromTurso]) {
      const key = `${r.ts}-${r.sensorId}`;
      if (!byKey.has(key)) byKey.set(key, r);
    }
    const merged = [...byKey.values()].sort(
      (a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime()
    );
    const limit = options.limit ?? 100;
    return merged.slice(-limit).reverse();
  } catch (err) {
    console.error('Turso getReadings error:', err);
    return fromMemory;
  }
}

export function getLatestByType(): Partial<Record<SensorType, SensorReading[]>> {
  const byType = getByTypeMap();
  const result: Partial<Record<SensorType, SensorReading[]>> = {};
  for (const type of byType.keys()) {
    const list = byType.get(type) ?? [];
    const latest = [...list].slice(-10).reverse();
    result[type] = latest;
  }
  return result;
}
