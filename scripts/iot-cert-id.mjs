#!/usr/bin/env node
/**
 * Print AWS IoT "Certificate ID" (SHA-256 hex) for each local PEM — compare with IoT Core → Security.
 *
 * Uses EDGE_* / FOG_* from .env the same way as the app (EDGE_AWS_IOT_CERT_PATH, etc.).
 */
import { X509Certificate } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'dotenv';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

for (const name of ['.env', '.env.local']) {
  const full = path.join(root, name);
  if (!fs.existsSync(full)) continue;
  const merged = parse(fs.readFileSync(full, 'utf8'));
  for (const [k, v] of Object.entries(merged)) {
    if (process.env[k] === undefined) process.env[k] = v;
  }
}

function certPathFor(role) {
  const prefix = role === 'EDGE' ? 'EDGE_' : 'FOG_';
  const v = process.env[`${prefix}AWS_IOT_CERT_PATH`];
  if (v !== undefined && String(v).trim() !== '') return String(v).trim();
  return (process.env.AWS_IOT_CERT_PATH || '').trim();
}

function show(role) {
  const p = certPathFor(role);
  if (!p) {
    console.log(`${role}: (no ${role === 'EDGE' ? 'EDGE_' : 'FOG_'}AWS_IOT_CERT_PATH / AWS_IOT_CERT_PATH in .env)`);
    return;
  }
  const abs = path.isAbsolute(p) ? p : path.join(root, p);
  if (!fs.existsSync(abs)) {
    console.log(`${role}: file not found: ${abs}`);
    return;
  }
  const pem = fs.readFileSync(abs, 'utf8');
  const cert = new X509Certificate(pem);
  const id = cert.fingerprint256.replace(/:/g, '').toLowerCase();
  console.log(`${role}: ${id}`);
  console.log(`     ${abs}`);
}

console.log('Compare these IDs with IoT Core → Security → Certificate ID\n');
show('EDGE');
show('FOG');
