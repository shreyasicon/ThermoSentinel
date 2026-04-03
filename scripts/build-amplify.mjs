import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const appApiRoot = path.join(root, 'app', 'api');

function listRouteFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listRouteFiles(abs));
    if (entry.isFile() && entry.name === 'route.ts') out.push(abs);
  }
  return out;
}

const renamed = [];
for (const file of listRouteFiles(appApiRoot)) {
  const hidden = `${file}.disabled`;
  fs.renameSync(file, hidden);
  renamed.push({ from: file, to: hidden });
}

try {
  const result = spawnSync('npx', ['cross-env', 'STATIC_EXPORT=true', 'next', 'build'], {
    cwd: root,
    stdio: 'inherit',
    shell: true,
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
} finally {
  for (const entry of renamed.reverse()) {
    if (fs.existsSync(entry.to)) fs.renameSync(entry.to, entry.from);
  }
}
