/**
 * Pre-flight: confirm TLS + MQTT connect to AWS IoT Core for EDGE (simulator) and FOG before `npm run dev:iot`.
 * Run: npx tsx scripts/verify-iot-core.ts
 */
import { X509Certificate } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { inspect } from 'node:util';
import { parse } from 'dotenv';
import { connect, type MqttClient } from 'mqtt';
import { applyMqttTlsProfile, extraMqttTlsOptions } from '../lib/mqtt-connect-options.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

function loadRootEnv(): void {
  for (const name of ['.env', '.env.local']) {
    const full = path.join(root, name);
    if (!fs.existsSync(full)) continue;
    const merged = parse(fs.readFileSync(full, 'utf8'));
    for (const [k, v] of Object.entries(merged)) {
      if (process.env[k] === undefined) process.env[k] = v;
    }
  }
}

function mustExist(label: string, p: string | undefined): void {
  if (!p?.trim()) {
    console.error(`[iot:verify] Missing ${label}`);
    process.exit(1);
  }
  const abs = path.isAbsolute(p) ? p : path.join(root, p);
  if (!fs.existsSync(abs)) {
    console.error(`[iot:verify] ${label} file not found: ${p} (resolved ${abs})`);
    process.exit(1);
  }
}

/** 64-char lowercase hex — same as **Certificate ID** in the IoT console (SHA-256 of the cert). */
function awsIotCertificateIdFromPem(pem: string): string {
  const cert = new X509Certificate(pem);
  return cert.fingerprint256.replace(/:/g, '').toLowerCase();
}

function logLocalCertId(role: 'EDGE' | 'FOG'): void {
  const p = process.env.AWS_IOT_CERT_PATH;
  if (!p?.trim()) return;
  const abs = path.isAbsolute(p) ? p : path.join(root, p);
  try {
    const id = awsIotCertificateIdFromPem(fs.readFileSync(abs, 'utf8'));
    console.log(
      `[iot:verify] ${role} local PEM → IoT certificate ID ${id}\n` +
        `[iot:verify]   file: ${abs}`,
    );
  } catch (e) {
    console.error(`[iot:verify] ${role} could not read certificate for ID check: ${abs}`, e);
  }
}

function verifyPathsForRole(role: 'EDGE' | 'FOG'): void {
  applyMqttTlsProfile(role);
  const ca = process.env.AWS_IOT_CA_PATH;
  const cert = process.env.AWS_IOT_CERT_PATH;
  const key = process.env.AWS_IOT_KEY_PATH;
  const extra = process.env.AWS_IOT_CA_EXTRA_PATH;
  const prefix = role === 'EDGE' ? 'EDGE_' : 'FOG_';
  mustExist(`${prefix}AWS_IOT_CA_PATH or AWS_IOT_CA_PATH`, ca);
  mustExist(`${prefix}AWS_IOT_CERT_PATH`, cert);
  mustExist(`${prefix}AWS_IOT_KEY_PATH`, key);
  if (extra?.trim()) mustExist(`${prefix}AWS_IOT_CA_EXTRA_PATH`, extra);
}

/** Full detail for TLS/DNS/socket errors (not only `Error.message`). */
function logExactError(prefix: string, err: unknown): void {
  console.error(`${prefix}:`);
  if (err instanceof Error) {
    console.error(`  name: ${err.name}`);
    console.error(`  message: ${err.message}`);
    if (err.stack) console.error(err.stack);
    const rec = err as NodeJS.ErrnoException & Record<string, unknown>;
    for (const k of [
      'code',
      'errno',
      'syscall',
      'address',
      'port',
      'hostname',
      'reason',
      'opensslErrorStack',
    ] as const) {
      if (rec[k] !== undefined && rec[k] !== '') {
        console.error(`  ${k}: ${inspect(rec[k], { depth: 6, colors: false })}`);
      }
    }
  } else {
    console.error(`  ${inspect(err, { depth: 8, colors: false })}`);
  }
}

/** TLS/TCP errors sometimes surface on the raw stream, not `MqttClient` `error`. */
function attachStreamDiagnostics(
  client: MqttClient,
  label: string,
  onRawError: (err: unknown) => void,
): void {
  const stream = (client as unknown as { stream?: NodeJS.EventEmitter }).stream;
  if (!stream?.on) return;

  stream.on('error', (err: unknown) => {
    onRawError(err);
    logExactError(`[iot:verify] ${label} underlying socket error`, err);
  });

  stream.on('close', (hadError?: boolean) => {
    const tls = stream as import('tls').TLSSocket;
    if (typeof tls.getPeerCertificate === 'function' && tls.authorizationError) {
      console.error(
        `[iot:verify] ${label} TLS authorizationError: ${tls.authorizationError} (check CA / hostname vs endpoint)`,
      );
    }
    if (hadError) {
      console.error(`[iot:verify] ${label} stream closed with hadError=true (see errors above)`);
    }
  });
}

type VerifyError = Error & { iotVerifyDetailsPrinted?: boolean };

function connectOnce(
  label: string,
  brokerUrl: string,
  clientId: string,
  tls: ReturnType<typeof extraMqttTlsOptions>,
  timeoutMs: number,
): Promise<void> {
  return new Promise((resolve, reject) => {
    let settled = false;
    let sawConnect = false;
    let lastErr: unknown;

    const noteErr = (err: unknown) => {
      lastErr = err;
    };

    const finish = (err: VerifyError, detailsAlreadyLogged: boolean) => {
      if (settled) return;
      settled = true;
      err.iotVerifyDetailsPrinted = detailsAlreadyLogged;
      reject(err);
    };

    const client: MqttClient = connect(brokerUrl, {
      reconnectPeriod: 0,
      connectTimeout: timeoutMs,
      clientId,
      ...tls,
    });

    attachStreamDiagnostics(client, label, noteErr);

    const t = setTimeout(() => {
      if (settled) return;
      console.error(
        `[iot:verify] ${label}: timed out after ${timeoutMs}ms (broker: ${brokerUrl}, clientId: ${clientId})`,
      );
      if (lastErr !== undefined) {
        logExactError(`[iot:verify] ${label}: last error before timeout`, lastErr);
      } else {
        console.error(
          `[iot:verify] ${label}: no \`error\` event — often wrong host/port, blocked outbound 8883, or DNS. ` +
            'Confirm MQTT_BROKER_URL uses your account **-ats.iot.<region>.amazonaws.com:8883** endpoint.',
        );
      }
      try {
        client.end(true);
      } catch {
        /* ignore */
      }
      const err = new Error(
        lastErr instanceof Error
          ? `timeout after ${timeoutMs}ms (${label}); last error: ${lastErr.message}`
          : `timeout after ${timeoutMs}ms waiting for MQTT CONNACK (${label})`,
      ) as VerifyError;
      finish(err, true);
    }, timeoutMs);

    client.on('connect', () => {
      if (settled) return;
      sawConnect = true;
      settled = true;
      clearTimeout(t);
      console.log(`[iot:verify] OK — ${label} connected as ${clientId}`);
      client.end(true, () => resolve());
    });

    client.on('error', (err) => {
      lastErr = err;
      logExactError(`[iot:verify] ${label} MQTT client error`, err);
      clearTimeout(t);
      try {
        client.end(true);
      } catch {
        /* ignore */
      }
      const e = (err instanceof Error ? err : new Error(String(err))) as VerifyError;
      finish(e, true);
    });

    client.on('close', () => {
      if (settled || sawConnect) return;
      clearTimeout(t);
      if (lastErr !== undefined) {
        logExactError(`[iot:verify] ${label} MQTT closed before CONNACK (after transport/MQTT error)`, lastErr);
        const e = (lastErr instanceof Error ? lastErr : new Error(String(lastErr))) as VerifyError;
        finish(e, true);
        return;
      }
      console.error(`[iot:verify] ${label} MQTT closed before CONNACK (broker=${brokerUrl}, clientId=${clientId})`);
      console.error(
        `[iot:verify] ${label} Common fixes: set SIMULATOR_MQTT_CLIENT_ID / FOG_MQTT_CLIENT_ID to the **Thing name** ` +
          'for this certificate; attach the cert to that Thing; IoT policy must allow iot:Connect for that clientId; ' +
          'use the **-ats.iot.<region>.amazonaws.com** endpoint for this account/region.',
      );
      console.error(
        `[iot:verify] ${label} If the cert ID above does not match the certificate in the console, replace PEM/key from **IoT Core → Security** or re-run **npm run iot:provision** and update .env.`,
      );
      finish(
        new Error(`${label}: MQTT closed before CONNACK (clientId vs Thing name, policy, or endpoint region)`) as VerifyError,
        true,
      );
    });
  });
}

async function main(): Promise<void> {
  process.chdir(root);
  loadRootEnv();

  if (process.env.SKIP_IOT_VERIFY === '1' || process.env.SKIP_IOT_VERIFY === 'true') {
    console.warn('[iot:verify] Skipped (SKIP_IOT_VERIFY). Remove for real IoT Core checks.');
    return;
  }

  const broker = (process.env.MQTT_BROKER_URL || '').trim();
  if (!broker.startsWith('mqtts://')) {
    console.error(
      '[iot:verify] Set MQTT_BROKER_URL=mqtts://<endpoint>-ats.iot.<region>.amazonaws.com:8883 in .env',
    );
    process.exit(1);
  }

  const timeoutMs = Number(process.env.IOT_VERIFY_TIMEOUT_MS || '20000');

  for (const role of ['EDGE', 'FOG'] as const) {
    verifyPathsForRole(role);
    logLocalCertId(role);
    applyMqttTlsProfile(role);
    const tls = extraMqttTlsOptions();
    if (!tls?.cert || !tls?.key) {
      console.error(`[iot:verify] ${role}: could not build TLS options (cert/key missing after apply profile)`);
      process.exit(1);
    }
    const fogNodeId = process.env.FOG_NODE_ID || 'fog-node-1';
    const fogDefaultId = `fog-${fogNodeId.replace(/[^a-zA-Z0-9_-]/g, '-')}`;
    /** Match services/sensor-simulator and services/fog-node clientId resolution (stable here so IoT Thing name matches). */
    const clientId =
      role === 'EDGE'
        ? process.env.SIMULATOR_MQTT_CLIENT_ID || process.env.MQTT_CLIENT_ID || 'sim-iot-verify'
        : process.env.FOG_MQTT_CLIENT_ID || process.env.MQTT_CLIENT_ID || fogDefaultId;
    try {
      await connectOnce(role, broker, clientId, tls, timeoutMs);
    } catch (e) {
      console.error(`[iot:verify] FAILED — ${role}`);
      const printed = (e as VerifyError)?.iotVerifyDetailsPrinted;
      if (!printed) {
        logExactError(`[iot:verify] ${role} thrown error`, e);
      }
      console.error(
        '[iot:verify] Check: .env paths (e.g. certs/sensor/, certs/fog/), Thing-attached certs, clientId = Thing name, IoT policy, region, outbound TCP 8883.',
      );
      process.exit(1);
    }
  }

  console.log('[iot:verify] IoT Core reachable for both identities — starting dev stack.');
}

main().catch((e) => {
  logExactError('[iot:verify] fatal', e);
  process.exit(1);
});
