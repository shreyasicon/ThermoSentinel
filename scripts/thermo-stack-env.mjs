#!/usr/bin/env node
/**
 * Reads CloudFormation outputs for thermosentinel-api and writes deploy/thermosentinel-api.env.generated
 * (FOG_SQS_QUEUE_URL, CLOUD_URL, NEXT_PUBLIC_LAMBDA_API_URL, AWS_REGION).
 * Run after deploy or any time: npm run stack:env
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const deployDir = path.join(root, 'deploy');
const outName = 'thermosentinel-api.env.generated';
const outFile = path.join(deployDir, outName);

export function fetchStackOutputsMap(stackName, region) {
  const r = spawnSync(
    'aws',
    ['cloudformation', 'describe-stacks', '--stack-name', stackName, '--region', region, '--output', 'json'],
    { encoding: 'utf8', cwd: root },
  );
  if (r.status !== 0) return null;
  try {
    const stacks = JSON.parse(r.stdout).Stacks;
    const outs = stacks?.[0]?.Outputs;
    const map = Object.create(null);
    for (const o of outs || []) {
      if (o.OutputKey && o.OutputValue != null) map[o.OutputKey] = o.OutputValue;
    }
    return map;
  } catch {
    return null;
  }
}

export function writeThermoApiEnvGenerated({ stackName, region }) {
  const map = fetchStackOutputsMap(stackName, region);
  if (!map) {
    console.error(`Could not read outputs for stack "${stackName}" in ${region}.`);
    return false;
  }
  if (!fs.existsSync(deployDir)) fs.mkdirSync(deployDir, { recursive: true });
  const lines = [
    '# thermosentinel-api — fog + browser (from CloudFormation outputs). Do not commit secrets.',
    `# Stack: ${stackName}  Region: ${region}`,
    `AWS_REGION=${region}`,
    `FOG_SQS_QUEUE_URL=${map.IngestQueueUrl ?? ''}`,
    `CLOUD_URL=${map.FogIngestUrl ?? ''}`,
    `NEXT_PUBLIC_LAMBDA_API_URL=${map.HttpApiUrl ?? ''}`,
    `DYNAMODB_READINGS_TABLE=${map.ReadingsTableName ?? ''}`,
    '',
  ];
  fs.writeFileSync(outFile, lines.join('\n'), 'utf8');
  console.log(`Wrote ${path.relative(root, outFile)}`);
  return true;
}

function main() {
  const stackName = (process.env.THERMO_API_STACK_NAME || 'thermosentinel-api').trim();
  const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'us-east-1';
  const ok = writeThermoApiEnvGenerated({ stackName, region });
  if (!ok) process.exit(1);
}

const selfPath = path.resolve(fileURLToPath(import.meta.url));
const entryPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (entryPath && selfPath === entryPath) main();
