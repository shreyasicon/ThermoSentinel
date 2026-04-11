/**
 * Shared MQTT/TLS options — primary path is **AWS IoT Core MQTT** on the device data endpoint
 * (`mqtts://<id>-ats.iot.<region>.amazonaws.com:8883` + Amazon Root CA + device cert + private key).
 * The `mqtt` package connects as a standard MQTT 3.1.1 client; IoT Core treats this like any
 * compliant MQTT client (same as AWS tutorials using X.509). We do **not** need `aws-iot-device-sdk-v2`
 * for basic pub/sub — that SDK is an optional higher-level wrapper.
 *
 * Plain `mqtt://` (e.g. local Mosquitto) works without PEM env vars.
 *
 * IoT Core: set MQTT_BROKER_URL to the account device data endpoint and AWS_IOT_*_PATH (or MQTT_* aliases).
 * Create an IoT **Thing per MQTT client ID** (e.g. simulator + fog), not one Thing per virtual sensor row.
 */

import fs from 'node:fs';

/**
 * Map EDGE_* / FOG_* env vars onto AWS_IOT_* before `extraMqttTlsOptions()` (one `.env`, two MQTT clients).
 * Kept in this module so `tsx` services resolve one stable file (see sensor-simulator / fog-node imports).
 */
export function applyMqttTlsProfile(role: 'EDGE' | 'FOG'): void {
  const prefix = role === 'EDGE' ? 'EDGE_' : 'FOG_';
  const keys = [
    'AWS_IOT_CA_PATH',
    'AWS_IOT_CA_EXTRA_PATH',
    'AWS_IOT_CERT_PATH',
    'AWS_IOT_KEY_PATH',
  ] as const;
  for (const k of keys) {
    const v = process.env[`${prefix}${k}`];
    if (v !== undefined && String(v).trim() !== '') {
      process.env[k] = v;
    }
  }
}

export type MqttTlsOptions = {
  rejectUnauthorized: boolean;
  ca?: Buffer;
  cert?: Buffer;
  key?: Buffer;
};

/**
 * TLS options when AWS_IOT_*_PATH or MQTT_CA_PATH are set.
 * IoT Core: download Amazon Root CA 1; device cert + private key from IoT console.
 * Optional `AWS_IOT_CA_EXTRA_PATH`: second PEM (e.g. Amazon Root CA 3) concatenated to `ca`.
 */
export function extraMqttTlsOptions(): MqttTlsOptions | undefined {
  const caPath = process.env.AWS_IOT_CA_PATH || process.env.MQTT_CA_PATH;
  const caExtraPath = process.env.AWS_IOT_CA_EXTRA_PATH || process.env.MQTT_CA_EXTRA_PATH;
  const certPath = process.env.AWS_IOT_CERT_PATH || process.env.MQTT_CERT_PATH;
  const keyPath = process.env.AWS_IOT_KEY_PATH || process.env.MQTT_KEY_PATH;
  if (!caPath && !certPath && !keyPath) return undefined;
  try {
    const opts: MqttTlsOptions = {
      rejectUnauthorized: process.env.MQTT_TLS_REJECT_UNAUTHORIZED !== 'false',
    };
    if (caPath) {
      let ca = fs.readFileSync(caPath);
      if (caExtraPath) {
        ca = Buffer.concat([ca, Buffer.from('\n', 'utf8'), fs.readFileSync(caExtraPath)]);
      }
      opts.ca = ca;
    }
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

/** Default export helps `tsx` when importing from `services/*` (nested `"type":"module"`) — named ESM interop. */
export default {
  applyMqttTlsProfile,
  extraMqttTlsOptions,
  extraMqttOptions,
};
