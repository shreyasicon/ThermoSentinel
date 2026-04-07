#!/usr/bin/env node
/**
 * Deploy API stack without SAM: build artifact → S3 → aws cloudformation deploy.
 * Requires: AWS CLI v2, credentials configured, appropriate IAM permissions.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import archiver from 'archiver';
import { writeThermoApiEnvGenerated } from './thermo-stack-env.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const templateRel = path.join('infra', 'cfn', 'thermosentinel-api.yaml');
const templatePath = path.join(root, templateRel);
const distLambda = path.join(root, 'dist', 'lambda');
const deployDir = path.join(root, 'deploy');

const region =
  process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'us-east-1';
const stackName = (process.env.THERMO_API_STACK_NAME || 'thermosentinel-api').trim();

/**
 * file:// URI for AWS CLI `--template-body`.
 * Windows: `file://E:/path` (not `file:///E:/...` — that causes Errno 22 with the CLI).
 * Unix: `file:///abs/path` via `file://${p}` when p starts with `/`.
 */
function fileUriForAwsCli(absPath) {
  const p = absPath.replace(/\\/g, '/');
  return `file://${p}`;
}

function runAws(args) {
  const r = spawnSync('aws', args, {
    cwd: root,
    stdio: 'inherit',
  });
  if (r.error) {
    console.error(r.error.message || r.error);
    process.exit(1);
  }
  if (r.status !== 0) process.exit(r.status ?? 1);
}

function runAwsCapture(args) {
  const r = spawnSync('aws', args, {
    cwd: root,
    encoding: 'utf8',
  });
  if (r.status !== 0) return null;
  return (r.stdout || '').trim();
}

function ensureAwsCli() {
  const v = runAwsCapture(['--version']);
  if (!v) {
    console.error('AWS CLI not found. Install and configure it (aws configure).');
    process.exit(1);
  }
  console.log(v);
}

function isValidS3BucketName(name) {
  return /^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(name) && !name.includes('..');
}

function resolveArtifactsBucket() {
  const raw = (process.env.API_ARTIFACTS_BUCKET || '').trim().toLowerCase();
  if (raw && isValidS3BucketName(raw)) return raw;

  const idJson = runAwsCapture([
    'sts',
    'get-caller-identity',
    '--output',
    'json',
    '--region',
    region,
  ]);
  let account = 'unknown';
  if (idJson) {
    try {
      account = JSON.parse(idJson).Account || account;
    } catch {
      /* ignore */
    }
  }
  const suffix = String(account).replace(/\D/g, '').slice(-6) || Date.now().toString().slice(-6);
  const generated = `thermo-api-${region}-${suffix}`.toLowerCase().replace(/[^a-z0-9.-]/g, '-');
  console.log(
    `Using S3 bucket for Lambda zip: ${generated} (set API_ARTIFACTS_BUCKET to override)`
  );
  return generated;
}

function ensureS3Bucket(bucket) {
  const head = spawnSync('aws', ['s3api', 'head-bucket', '--bucket', bucket, '--region', region], {
    encoding: 'utf8',
  });
  if (head.status === 0) {
    console.log(`S3 bucket exists: ${bucket}`);
    return;
  }

  console.log(`Creating S3 bucket: ${bucket}`);
  if (region === 'us-east-1') {
    runAws(['s3api', 'create-bucket', '--bucket', bucket, '--region', region]);
  } else {
    runAws([
      's3api',
      'create-bucket',
      '--bucket',
      bucket,
      '--create-bucket-configuration',
      `LocationConstraint=${region}`,
      '--region',
      region,
    ]);
  }
}

function zipLambda(zipPath) {
  return new Promise((resolve, reject) => {
    const handler = path.join(distLambda, 'handler.js');
    if (!fs.existsSync(handler)) {
      reject(new Error(`Missing ${handler} — run npm run build:lambda first.`));
      return;
    }
    const out = fs.createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });
    out.on('close', resolve);
    archive.on('error', reject);
    archive.pipe(out);
    archive.file(handler, { name: 'handler.js' });
    archive.finalize();
  });
}

function printStackOutputs() {
  const json = runAwsCapture([
    'cloudformation',
    'describe-stacks',
    '--stack-name',
    stackName,
    '--region',
    region,
    '--output',
    'json',
  ]);
  if (!json) return;
  try {
    const stacks = JSON.parse(json).Stacks;
    const outs = stacks?.[0]?.Outputs;
    if (!Array.isArray(outs) || outs.length === 0) return;
    console.log('\n--- Stack outputs ---');
    for (const o of outs) {
      console.log(`  ${o.OutputKey}: ${o.OutputValue}`);
    }
    console.log('');
  } catch {
    /* ignore */
  }
}

async function main() {
  ensureAwsCli();

  if (!fs.existsSync(templatePath)) {
    console.error(`Template not found: ${templatePath}`);
    process.exit(1);
  }

  const handlerPath = path.join(distLambda, 'handler.js');
  if (!fs.existsSync(handlerPath)) {
    console.error(`Missing ${handlerPath}. Run: npm run build:lambda`);
    process.exit(1);
  }

  if (!fs.existsSync(deployDir)) fs.mkdirSync(deployDir, { recursive: true });

  const bucket = resolveArtifactsBucket();
  ensureS3Bucket(bucket);

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const key = `lambda-api/${stamp}/function.zip`;
  const zipPath = path.join(deployDir, `lambda-api-${stamp}.zip`);

  console.log(`Zipping Lambda package → ${zipPath}`);
  await zipLambda(zipPath);

  const s3Uri = `s3://${bucket}/${key}`;
  console.log(`Uploading → ${s3Uri}`);
  runAws(['s3', 'cp', zipPath, s3Uri, '--region', region]);

  const tursoUrl = process.env.TURSO_DATABASE_URL ?? '';
  const tursoToken = process.env.TURSO_AUTH_TOKEN ?? '';
  const redisUrl = process.env.REDIS_URL ?? '';
  const fogSenderPrincipalArn = process.env.FOG_SENDER_PRINCIPAL_ARN ?? '';
  const opsAlertEmail = process.env.OPS_ALERT_EMAIL ?? '';

  console.log(`Validating template ${templateRel} …`);
  runAws([
    'cloudformation',
    'validate-template',
    '--template-body',
    fileUriForAwsCli(templatePath),
  ]);

  console.log(`Deploying stack ${stackName} …`);
  runAws([
    'cloudformation',
    'deploy',
    '--template-file',
    templatePath,
    '--stack-name',
    stackName,
    '--capabilities',
    'CAPABILITY_IAM',
    '--no-fail-on-empty-changeset',
    '--region',
    region,
    '--parameter-overrides',
    `LambdaCodeBucket=${bucket}`,
    `LambdaCodeKey=${key}`,
    `TursoDatabaseUrl=${tursoUrl}`,
    `TursoAuthToken=${tursoToken}`,
    `RedisUrl=${redisUrl}`,
    `FogSenderPrincipalArn=${fogSenderPrincipalArn}`,
    `OpsAlertEmail=${opsAlertEmail}`,
  ]);

  console.log('\nDeploy finished.');
  printStackOutputs();
  writeThermoApiEnvGenerated({ stackName, region });
  if (opsAlertEmail.trim()) {
    console.log(
      '\nSNS: confirm the subscription email from AWS Notifications to receive CRITICAL alerts.\n',
    );
  }
}

main().catch((err) => {
  console.error(err?.message || err);
  process.exit(1);
});
