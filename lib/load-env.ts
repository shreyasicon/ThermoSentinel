/**
 * Load repo-root `.env` / `.env.local` before other modules read `process.env`.
 * Used by fog-node and sensor-simulator (tsx child processes do not inherit Next.js env loading).
 *
 * Merges `.env` then `.env.local` (local wins for file-only keys) but does **not** override
 * variables already set in `process.env` (e.g. `cross-env FOG_INPUT_MODE=http` from npm scripts).
 */
import { parse } from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function mergeEnvFiles(): Record<string, string> {
  const merged: Record<string, string> = {};
  for (const name of ['.env', '.env.local']) {
    const full = path.join(root, name);
    if (!fs.existsSync(full)) continue;
    const parsed = parse(fs.readFileSync(full));
    Object.assign(merged, parsed);
  }
  return merged;
}

const fromFiles = mergeEnvFiles();
for (const [key, value] of Object.entries(fromFiles)) {
  if (process.env[key] === undefined) process.env[key] = value;
}
