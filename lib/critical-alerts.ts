/**
 * Evaluate readings for critical thresholds and publish to SNS (ops topic).
 */

import { PublishCommand, SNSClient } from '@aws-sdk/client-sns';
import type { SensorReading } from '../shared/schema/types';

function snsTopicArn(): string {
  return (process.env.SNS_OPS_TOPIC_ARN || '').trim();
}

function criticalTempC(): number {
  return Number(process.env.CRITICAL_TEMP_CELSIUS ?? '35');
}

function criticalSmoke(): number {
  return Number(process.env.CRITICAL_SMOKE_INDEX ?? '70');
}

function criticalHumidityHigh(): number {
  return Number(process.env.CRITICAL_HUMIDITY_HIGH ?? '90');
}

function criticalHumidityLow(): number {
  return Number(process.env.CRITICAL_HUMIDITY_LOW ?? '10');
}

/**
 * Returns human-readable lines for any critical conditions (temperature, smoke, humidity).
 */
export function collectCriticalMessages(readings: SensorReading[], fogNodeId: string): string[] {
  const lines: string[] = [];
  const tMax = criticalTempC();
  const sMax = criticalSmoke();
  const hHi = criticalHumidityHigh();
  const hLo = criticalHumidityLow();

  for (const r of readings) {
    const loc = r.location ? ` @ ${r.location}` : '';
    if (r.sensorType === 'temperature' && r.value > tMax) {
      lines.push(
        `[TEMP] ${r.value}°C exceeds ${tMax}°C — sensor ${r.sensorId}${loc} — ${r.ts} — fog ${fogNodeId}`,
      );
    }
    if (r.sensorType === 'smoke' && r.value > sMax) {
      lines.push(
        `[SMOKE] index ${r.value} exceeds ${sMax} — sensor ${r.sensorId}${loc} — ${r.ts} — fog ${fogNodeId}`,
      );
    }
    if (r.sensorType === 'humidity' && (r.value > hHi || r.value < hLo)) {
      lines.push(
        `[HUMIDITY] ${r.value}% out of safe range (${hLo}–${hHi}%) — sensor ${r.sensorId}${loc} — ${r.ts} — fog ${fogNodeId}`,
      );
    }
  }
  return lines;
}

export async function publishCriticalAlert(subject: string, message: string): Promise<void> {
  const arn = snsTopicArn();
  if (!arn || !message.trim()) return;
  try {
    const client = new SNSClient({});
    await client.send(
      new PublishCommand({
        TopicArn: arn,
        Subject: subject.slice(0, 100),
        Message: message,
      }),
    );
  } catch (err) {
    console.error('[critical-alerts] SNS publish failed:', err instanceof Error ? err.message : err);
  }
}

/**
 * After ingest: notify once per batch if any reading is critical.
 */
export async function evaluateAndNotifyCritical(
  readings: SensorReading[],
  fogNodeId: string,
): Promise<void> {
  const lines = collectCriticalMessages(readings, fogNodeId);
  if (lines.length === 0) return;
  await publishCriticalAlert(
    `[ThermoSentinel] CRITICAL — ${lines.length} condition(s)`,
    lines.join('\n'),
  );
}
