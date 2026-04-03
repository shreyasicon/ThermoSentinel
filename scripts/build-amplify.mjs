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

const middlewarePath = path.join(root, 'middleware.ts');
const middlewareSkip = path.join(root, 'middleware.ts.__amplify_skip');
let middlewareRenamed = false;
if (fs.existsSync(middlewarePath)) {
  fs.renameSync(middlewarePath, middlewareSkip);
  middlewareRenamed = true;
}

let exitCode = 0;
try {
  const result = spawnSync('npx', ['cross-env', 'STATIC_EXPORT=true', 'next', 'build'], {
    cwd: root,
    stdio: 'inherit',
    shell: true,
  });
  exitCode = result.status ?? 0;
} finally {
  if (middlewareRenamed && fs.existsSync(middlewareSkip)) {
    fs.renameSync(middlewareSkip, middlewarePath);
  }
  for (const entry of renamed.reverse()) {
    if (fs.existsSync(entry.to)) fs.renameSync(entry.to, entry.from);
  }
}

process.exit(exitCode === 0 ? 0 : exitCode);
