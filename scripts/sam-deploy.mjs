#!/usr/bin/env node
/**
 * Runs `sam deploy` from the repo root with sensible defaults.
 * Resolves `sam` via PATH, or SAM_CLI_PATH, or common Windows manual install folders.
 */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Look for sam.cmd under a folder (one level of subfolders + bin). */
function shallowFindSamCmd(baseDir) {
  if (!baseDir || !fs.existsSync(baseDir)) return null;
  const tryPaths = [
    path.join(baseDir, 'sam.cmd'),
    path.join(baseDir, 'bin', 'sam.cmd'),
    path.join(baseDir, 'Scripts', 'sam.cmd'),
  ];
  for (const p of tryPaths) {
    if (fs.existsSync(p)) return p;
  }
  try {
    const subs = fs.readdirSync(baseDir, { withFileTypes: true });
    for (const d of subs) {
      if (!d.isDirectory()) continue;
      const sub = path.join(baseDir, d.name);
      for (const rel of ['sam.cmd', path.join('bin', 'sam.cmd')]) {
        const p = path.join(sub, rel);
        if (fs.existsSync(p)) return p;
      }
    }
  } catch {
    /* ignore */
  }
  return null;
}

/** Windows: resolve via `where.exe` if sam is on PATH. */
function findSamViaWhere() {
  if (process.platform !== 'win32') return null;
  for (const name of ['sam.cmd', 'sam.exe', 'sam']) {
    const r = spawnSync('where.exe', [name], { encoding: 'utf8' });
    if (r.status === 0 && r.stdout) {
      const line = r.stdout.trim().split(/\r?\n/)[0]?.trim();
      if (line && fs.existsSync(line)) return line;
    }
  }
  return null;
}

/** Full path to sam.cmd / sam.exe, or the string `sam` if relying on PATH. */
function resolveSamExecutable() {
  const fromEnv = process.env.SAM_CLI_PATH?.trim();
  if (fromEnv && fs.existsSync(fromEnv)) {
    return fromEnv;
  }
  const fromAwsSamHome = process.env.AWS_SAM_HOME?.trim();
  if (fromAwsSamHome) {
    const found = shallowFindSamCmd(fromAwsSamHome);
    if (found) return found;
  }
  const whereFound = findSamViaWhere();
  if (whereFound) return whereFound;

  const candidates = [
    path.join('E:', 'AWS SAM', 'bin', 'sam.cmd'),
    path.join('E:', 'AWS SAm', 'bin', 'sam.cmd'),
    path.join('E:', 'AWS SAM', 'sam.cmd'),
    path.join('E:', 'AWS SAm', 'sam.cmd'),
    path.join(process.env.ProgramFiles || 'C:\\Program Files', 'Amazon', 'AWSSAMCLI', 'bin', 'sam.cmd'),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  for (const rootDir of [path.join('E:', 'AWS SAm'), path.join('E:', 'AWS SAM')]) {
    const found = shallowFindSamCmd(rootDir);
    if (found) return found;
  }
  return 'sam';
}

function samVersionWorks(samCmd) {
  const r = spawnSync(samCmd, ['--version'], { shell: true, encoding: 'utf8', stdio: 'pipe' });
  return r.status === 0;
}

const samExe = resolveSamExecutable();
if (!samVersionWorks(samExe)) {
  printSamMissing(samExe);
  process.exit(1);
}

const defaultArgs = [
  'deploy',
  '--template-file',
  'infra/sam/template.yaml',
  '--stack-name',
  'thermosentinel-api',
  '--resolve-s3',
  '--capabilities',
  'CAPABILITY_IAM',
  '--no-confirm-changeset',
  '--no-fail-on-empty-changeset',
];

const userArgs = process.argv.slice(2);
const args = [...defaultArgs, ...userArgs];

const r = spawnSync(samExe, args, { cwd: root, stdio: 'inherit', shell: true });
process.exit(r.status === null ? 1 : r.status);

function printSamMissing(tried) {
  console.error('\n*** AWS SAM CLI not found — CloudFormation stack was NOT created. ***\n');
  console.error(`Tried: ${tried}\n`);
  console.error('Fix one of:\n');
  console.error('  1) Add the folder that contains sam.cmd to your user PATH, then reopen the terminal.');
  console.error('  2) Set SAM_CLI_PATH to the full path of sam.cmd, e.g.:');
  console.error('       $env:SAM_CLI_PATH="E:\\AWS SAm\\bin\\sam.cmd"   # PowerShell');
  console.error('     Or point AWS_SAM_HOME at the install folder (script searches for sam.cmd).');
  console.error('     In Explorer, search your E: drive for **sam.cmd** and paste that full path.\n');
  console.error('Install guide:');
  console.error('  https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html\n');
  console.error('See also: docs/INSTALL_SAM_CLI.md\n');
}
