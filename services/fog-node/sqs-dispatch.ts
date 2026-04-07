/**
 * Optional AWS SQS fan-out from fog (buffering / decoupling before Lambda consumers).
 */

/** Region segment from https://sqs.{region}.amazonaws.com/... */
export function regionFromSqsQueueUrl(queueUrl: string): string | undefined {
  try {
    const { hostname } = new URL(queueUrl);
    const m = hostname.match(/^sqs\.([a-z0-9-]+)\.amazonaws\.com$/);
    return m?.[1];
  } catch {
    return undefined;
  }
}

/** Queue name and region for GET /status (ops / dashboard). */
export function parseSqsQueueMeta(queueUrl: string): { region?: string; queueName?: string } {
  try {
    const u = new URL(queueUrl);
    const region = regionFromSqsQueueUrl(queueUrl);
    const segs = u.pathname.replace(/^\//, '').split('/').filter(Boolean);
    const queueName = segs.length >= 2 ? segs[segs.length - 1] : segs[0];
    return { region, queueName };
  } catch {
    return {};
  }
}

export async function sendEnvelopeToSqs(queueUrl: string, messageBody: string): Promise<boolean> {
  try {
    const { SQSClient, SendMessageCommand } = await import('@aws-sdk/client-sqs');
    const r = regionFromSqsQueueUrl(queueUrl);
    const client = new SQSClient(r ? { region: r } : {});
    await client.send(
      new SendMessageCommand({
        QueueUrl: queueUrl,
        MessageBody: messageBody,
      }),
    );
    return true;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[fog] SQS send failed:', msg);
    return false;
  }
}
