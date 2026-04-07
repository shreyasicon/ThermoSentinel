/**
 * Shared MQTT/TLS options — primary path is **AWS IoT Core** (`mqtts://…:8883` + device PEMs).
 * Plain `mqtt://` (e.g. local broker) works without PEM env vars.
 *
 * IoT Core: set MQTT_BROKER_URL to the account device data endpoint and AWS_IOT_*_PATH (or MQTT_* aliases).
 * Create an IoT Thing per client ID; policy must allow connect, subscribe (fog), publish (simulator).
 */

import fs from 'node:fs';

export type MqttTlsOptions = {
  rejectUnauthorized: boolean;
  ca?: Buffer;
  cert?: Buffer;
  key?: Buffer;
};

/**
 * TLS options when AWS_IOT_*_PATH or MQTT_CA_PATH are set.
 * IoT Core: download Amazon Root CA 1; device cert + private key from IoT console.
 */
export function extraMqttTlsOptions(): MqttTlsOptions | undefined {
  const caPath = process.env.AWS_IOT_CA_PATH || process.env.MQTT_CA_PATH;
  const certPath = process.env.AWS_IOT_CERT_PATH || process.env.MQTT_CERT_PATH;
  const keyPath = process.env.AWS_IOT_KEY_PATH || process.env.MQTT_KEY_PATH;
  if (!caPath && !certPath && !keyPath) return undefined;
  try {
    const opts: MqttTlsOptions = {
      rejectUnauthorized: process.env.MQTT_TLS_REJECT_UNAUTHORIZED !== 'false',
    };
    if (caPath) opts.ca = fs.readFileSync(caPath);
    if (certPath) opts.cert = fs.readFileSync(certPath);
    if (keyPath) opts.key = fs.readFileSync(keyPath);
    return opts;
  } catch (e) {
    console.error('[mqtt] Failed to read TLS/IoT PEM files:', e);
    return undefined;
  }
}

/** @deprecated use extraMqttTlsOptions */
export const extraMqttOptions = extraMqttTlsOptions;
