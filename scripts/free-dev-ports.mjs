#!/usr/bin/env node
/**
 * Frees local dev ports and stale Next lock so `npm run dev:all` can start cleanly.
 * Run automatically before dev:all (see package.json).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync, execSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const lockPath = path.join(rootDir, '.next', 'dev', 'lock');

const PORTS = [3000, 4000];

function freePortsWindows() {
  const portsList = PORTS.join(', ');
  const script = `
$ports = @(${portsList})
foreach ($p in $ports) {
  Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue |
    ForEach-Object {
      try {
        Stop-Process -Id $_.OwningProcess -Force -ErrorAction Stop
        Write-Host ("Stopped PID " + $_.OwningProcess + " on port " + $p)
      } catch {}
    }
}
`.trim();
  execFileSync(
    'powershell.exe',
    ['-NoProfile', '-NonInteractive', '-Command', script],
    { stdio: 'inherit' }
  );
}

function freePortsUnix() {
  for (const p of PORTS) {
    try {
      const out = execSync(`lsof -ti tcp:${p}`, {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      }).trim();
      if (!out) continue;
      for (const pid of out.split(/\s+/)) {
        if (pid) {
          try {
            execSync(`kill -9 ${pid}`, { stdio: 'ignore' });
            console.log(`Stopped PID ${pid} on port ${p}`);
          } catch {
            // ignore
          }
        }
      }
    } catch {
      // nothing listening or lsof missing
    }
  }
}

function removeNextDevLock() {
  try {
    if (fs.existsSync(lockPath)) {
      fs.unlinkSync(lockPath);
      console.log('Removed stale .next/dev/lock');
    }
  } catch (e) {
    console.warn('Could not remove .next/dev/lock:', e?.message ?? e);
  }
}

console.log('Preparing dev stack: free ports', PORTS.join(', '), '…');
if (process.platform === 'win32') {
  try {
    freePortsWindows();
  } catch {
    // ignore if no listeners / permission
  }
} else {
  try {
    freePortsUnix();
  } catch {
    // ignore
  }
}
removeNextDevLock();
