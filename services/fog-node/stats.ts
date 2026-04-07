/**
 * Mutable counters for GET /status (dashboard + ops).
 */

export const fogStats = {
  mqttMessagesReceived: 0,
  httpIngestRequests: 0,
  readingsAccepted: 0,
  cloudHttpSuccess: 0,
  cloudHttpFailure: 0,
  sqsSent: 0,
  sqsFailure: 0,
  mqttPublishedToCloudTopic: 0,
  mqttPublishFailure: 0,
  lastEnvelopeAt: null as string | null,
  lastError: null as string | null,
  mqttSubscriberConnected: false,
  mqttPublisherConnected: false,
};

export function bumpMqttMessage(): void {
  fogStats.mqttMessagesReceived += 1;
}

export function bumpHttpIngest(count: number): void {
  fogStats.httpIngestRequests += 1;
  fogStats.readingsAccepted += count;
}

export function noteEnvelope(ts: string): void {
  fogStats.lastEnvelopeAt = ts;
}

export function noteCloudHttp(ok: boolean): void {
  if (ok) fogStats.cloudHttpSuccess += 1;
  else fogStats.cloudHttpFailure += 1;
}

export function noteSqs(ok: boolean): void {
  if (ok) fogStats.sqsSent += 1;
  else fogStats.sqsFailure += 1;
}

export function noteMqttPublish(ok: boolean): void {
  if (ok) fogStats.mqttPublishedToCloudTopic += 1;
  else fogStats.mqttPublishFailure += 1;
}

export function setLastError(msg: string | null): void {
  fogStats.lastError = msg;
}
