/* global console, process, setTimeout */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import archiver from 'archiver';

const POLICY_WEB_TIER = 'arn:aws:iam::aws:policy/AWSElasticBeanstalkWebTier';
const POLICY_EB_SERVICE = 'arn:aws:iam::aws:policy/service-role/AWSElasticBeanstalkService';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const deployDir = path.join(rootDir, 'deploy');

const cfg = {
  region: process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'us-east-1',
  appName: process.env.EB_APP_NAME || 'thermosentinel-app',
  envName: process.env.EB_ENV_NAME || 'thermosentinel-env',
  s3Bucket: process.env.EB_S3_BUCKET,
  s3Prefix: process.env.EB_S3_PREFIX || 'elasticbeanstalk/source-bundles',
  solutionStack: process.env.EB_SOLUTION_STACK || '',
  /** Max seconds to wait for Elastic Beanstalk env to reach Ready (default 15 min). */
  waitMaxSeconds: Number(process.env.EB_WAIT_MAX_SECONDS || '900'),
  /** IAM names (defaults match Elastic Beanstalk console defaults). */
  ec2InstanceProfileName:
    process.env.EB_EC2_INSTANCE_PROFILE || 'aws-elasticbeanstalk-ec2-role',
  ebServiceRoleName:
    process.env.EB_SERVICE_ROLE || 'aws-elasticbeanstalk-service-role',
  /** Custom VPC (all three required together). Omit to use account default VPC. */
  vpcId: (process.env.EB_VPC_ID || '').trim(),
  vpcSubnets: (process.env.EB_SUBNETS || '').trim(),
  vpcElbSubnets: (process.env.EB_ELB_SUBNETS || '').trim(),
  /** For custom VPC: set "false" only if instances use private subnets + NAT. */
  vpcAssociatePublicIp: process.env.EB_ASSOCIATE_PUBLIC_IP !== 'false',
  workspace: rootDir,
};

function run(command) {
  console.log(`\n$ ${command}`);
  return execSync(command, {
    cwd: cfg.workspace,
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf8',
  }).trim();
}

function runJson(command) {
  const output = run(command);
  return output ? JSON.parse(output) : {};
}

function runQuiet(command) {
  try {
    execSync(command, {
      cwd: cfg.workspace,
      stdio: ['ignore', 'pipe', 'pipe'],
      encoding: 'utf8',
    });
    return true;
  } catch {
    return false;
  }
}

function ensureAwsCli() {
  try {
    const version = run('aws --version');
    console.log(version);
  } catch {
    console.error('AWS CLI not found. Install and configure it first.');
    process.exit(1);
  }
}

function ensureDeployDir() {
  if (!fs.existsSync(deployDir)) fs.mkdirSync(deployDir, { recursive: true });
}

function isValidS3BucketName(name) {
  return /^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(name) && !name.includes('..');
}

function resolveBucketName() {
  const raw = (cfg.s3Bucket || '').trim().toLowerCase();
  const hasPlaceholder =
    raw.includes('<') ||
    raw.includes('>') ||
    raw.includes('your-unique-suffix') ||
    raw.includes('your-eb-artifacts-bucket');
  if (raw && !hasPlaceholder && isValidS3BucketName(raw)) return raw;

  const ts = Date.now().toString().slice(-8);
  const generated = `${cfg.appName}-${cfg.region}-${ts}`
    .toLowerCase()
    .replace(/[^a-z0-9.-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  console.log(
    `Using auto-generated S3 bucket name: ${generated} (set EB_S3_BUCKET to override)`
  );
  return generated;
}

function ensureS3Bucket() {
  cfg.s3Bucket = resolveBucketName();
  try {
    run(`aws s3api head-bucket --bucket "${cfg.s3Bucket}" --region "${cfg.region}"`);
    console.log(`S3 bucket exists: ${cfg.s3Bucket}`);
    return;
  } catch {
    console.log(`S3 bucket not found, creating: ${cfg.s3Bucket}`);
  }

  if (cfg.region === 'us-east-1') {
    run(
      `aws s3api create-bucket --bucket "${cfg.s3Bucket}" --region "${cfg.region}"`
    );
  } else {
    run(
      `aws s3api create-bucket ` +
        `--bucket "${cfg.s3Bucket}" ` +
        `--create-bucket-configuration LocationConstraint="${cfg.region}" ` +
        `--region "${cfg.region}"`
    );
  }
  console.log(`Created S3 bucket: ${cfg.s3Bucket}`);
}

function createZip(zipPath) {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', resolve);
    archive.on('error', reject);
    archive.pipe(output);

    archive.glob('**/*', {
      cwd: rootDir,
      dot: true,
      ignore: [
        '.git/**',
        '.next/**',
        'node_modules/**',
        'deploy/**',
        'terminals/**',
        'agent-transcripts/**',
        'npm-debug.log*',
      ],
    });

    archive.finalize();
  });
}

function ensureEbApplication() {
  const apps = runJson(
    `aws elasticbeanstalk describe-applications --application-names "${cfg.appName}" --region "${cfg.region}" --output json`
  );
  const exists = Array.isArray(apps.Applications) && apps.Applications.length > 0;
  if (!exists) {
    run(
      `aws elasticbeanstalk create-application --application-name "${cfg.appName}" --region "${cfg.region}"`
    );
    console.log(`Created Elastic Beanstalk application: ${cfg.appName}`);
  } else {
    console.log(`Elastic Beanstalk application exists: ${cfg.appName}`);
  }
}

function createAppVersion(versionLabel, s3Key) {
  run(
    `aws elasticbeanstalk create-application-version ` +
      `--application-name "${cfg.appName}" ` +
      `--version-label "${versionLabel}" ` +
      `--source-bundle S3Bucket="${cfg.s3Bucket}",S3Key="${s3Key}" ` +
      `--region "${cfg.region}"`
  );
}

function resolveSolutionStack() {
  if (cfg.solutionStack) return cfg.solutionStack;

  const data = runJson(
    `aws elasticbeanstalk list-available-solution-stacks --region "${cfg.region}" --output json`
  );
  const stacks = Array.isArray(data.SolutionStacks) ? data.SolutionStacks : [];
  const nodeStacks = stacks.filter((s) => s.includes('running Node.js'));

  if (nodeStacks.length === 0) {
    console.error(
      `No Node.js Elastic Beanstalk solution stacks found in region ${cfg.region}.`
    );
    process.exit(1);
  }

  const pickByVersion = (v) => nodeStacks.find((s) => s.includes(`Node.js ${v}`));
  const selected = pickByVersion('20') || pickByVersion('18') || nodeStacks[0];
  console.log(`Using solution stack: ${selected}`);
  return selected;
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function fileUriForAwsCli(absPath) {
  return `file://${absPath.replace(/\\/g, '/')}`;
}

/**
 * Elastic Beanstalk requires an EC2 instance profile + service role.
 * If missing (common on new accounts / CLI-only deploy), create them.
 */
async function ensureIamForElasticBeanstalk() {
  const trustEc2Path = path.join(deployDir, 'iam-trust-ec2.json');
  const trustEbPath = path.join(deployDir, 'iam-trust-elasticbeanstalk.json');

  fs.writeFileSync(
    trustEc2Path,
    JSON.stringify({
      Version: '2012-10-17',
      Statement: [
        {
          Effect: 'Allow',
          Principal: { Service: 'ec2.amazonaws.com' },
          Action: 'sts:AssumeRole',
        },
      ],
    })
  );
  fs.writeFileSync(
    trustEbPath,
    JSON.stringify({
      Version: '2012-10-17',
      Statement: [
        {
          Effect: 'Allow',
          Principal: { Service: 'elasticbeanstalk.amazonaws.com' },
          Action: 'sts:AssumeRole',
        },
      ],
    })
  );

  const ec2Role = cfg.ec2InstanceProfileName;
  const svcRole = cfg.ebServiceRoleName;

  if (!runQuiet(`aws iam get-role --role-name "${ec2Role}"`)) {
    console.log(`Creating IAM role for EC2 instances: ${ec2Role}`);
    run(
      `aws iam create-role --role-name "${ec2Role}" --assume-role-policy-document "${fileUriForAwsCli(trustEc2Path)}"`
    );
    run(
      `aws iam attach-role-policy --role-name "${ec2Role}" --policy-arn "${POLICY_WEB_TIER}"`
    );
  } else {
    console.log(`IAM EC2 role exists: ${ec2Role}`);
  }

  if (!runQuiet(`aws iam get-instance-profile --instance-profile-name "${ec2Role}"`)) {
    console.log(`Creating IAM instance profile: ${ec2Role}`);
    run(`aws iam create-instance-profile --instance-profile-name "${ec2Role}"`);
    run(
      `aws iam add-role-to-instance-profile --instance-profile-name "${ec2Role}" --role-name "${ec2Role}"`
    );
  } else {
    console.log(`IAM instance profile exists: ${ec2Role}`);
  }

  if (!runQuiet(`aws iam get-role --role-name "${svcRole}"`)) {
    console.log(`Creating Elastic Beanstalk service role: ${svcRole}`);
    run(
      `aws iam create-role --role-name "${svcRole}" --assume-role-policy-document "${fileUriForAwsCli(trustEbPath)}"`
    );
    run(
      `aws iam attach-role-policy --role-name "${svcRole}" --policy-arn "${POLICY_EB_SERVICE}"`
    );
  } else {
    console.log(`Elastic Beanstalk service role exists: ${svcRole}`);
  }

  console.log(
    'Waiting 15s for IAM propagation (first-time role creation can take a moment)...'
  );
  await sleep(15_000);
}

/**
 * Resolve IAM ARNs so EB gets unambiguous values (also avoids CLI shorthand quirks).
 */
function resolveInstanceProfileArnForEb() {
  try {
    const j = runJson(
      `aws iam get-instance-profile --instance-profile-name "${cfg.ec2InstanceProfileName}" --output json`
    );
    return j.InstanceProfile?.Arn || cfg.ec2InstanceProfileName;
  } catch {
    return cfg.ec2InstanceProfileName;
  }
}

function resolveServiceRoleArnForEb() {
  try {
    const j = runJson(`aws iam get-role --role-name "${cfg.ebServiceRoleName}" --output json`);
    return j.Role?.Arn || cfg.ebServiceRoleName;
  } catch {
    return cfg.ebServiceRoleName;
  }
}

function hasCustomVpcConfig() {
  return Boolean(cfg.vpcId && cfg.vpcSubnets && cfg.vpcElbSubnets);
}

function defaultVpcExistsInRegion() {
  try {
    const data = runJson(
      `aws ec2 describe-vpcs --filters Name=isDefault,Values=true --region "${cfg.region}" --output json`
    );
    return Array.isArray(data.Vpcs) && data.Vpcs.length > 0;
  } catch {
    return false;
  }
}

/**
 * Load-balanced EB needs a VPC. If the account has no default VPC, ALB creation fails with:
 * "Default VPC not found" / InvalidConfigurationRequest.
 */
function assertVpcPrerequisitesForCreate() {
  const anyVpcEnv = cfg.vpcId || cfg.vpcSubnets || cfg.vpcElbSubnets;
  if (anyVpcEnv && !hasCustomVpcConfig()) {
    console.error(
      '\nSet all of EB_VPC_ID, EB_SUBNETS, and EB_ELB_SUBNETS together (comma-separated subnet IDs), or unset all to use the default VPC.\n'
    );
    process.exit(1);
  }

  if (hasCustomVpcConfig()) {
    console.log(
      `Using custom VPC ${cfg.vpcId} (EC2 subnets: ${cfg.vpcSubnets}; ELB subnets: ${cfg.vpcElbSubnets})`
    );
    return;
  }

  if (!defaultVpcExistsInRegion()) {
    console.error(`
No default VPC in region "${cfg.region}". Elastic Beanstalk cannot create a load balancer without a VPC.

Fix (simplest — one-time per region):
  aws ec2 create-default-vpc --region ${cfg.region}

Then deploy again. (Console: VPC → Actions → Create default VPC.)

If you use only a custom VPC (no default), set:
  EB_VPC_ID=vpc-xxxxxxxx
  EB_SUBNETS=subnet-aaa,subnet-bbb
  EB_ELB_SUBNETS=subnet-aaa,subnet-bbb
Use subnets in at least two Availability Zones for the load balancer. Public subnets for an internet-facing ALB.
`);
    process.exit(1);
  }
  console.log(`Default VPC present in ${cfg.region} (ok for Elastic Beanstalk).`);
}

/**
 * Elastic Beanstalk option settings as JSON (preferred over CLI shorthand on Windows:
 * comma-separated Namespace=...,OptionName=...,Value=... can be misparsed by the shell/CLI).
 */
function writeEbCreateOptionSettingsFile() {
  const ipArn = resolveInstanceProfileArnForEb();
  const svcArn = resolveServiceRoleArnForEb();
  const payload = [
    {
      Namespace: 'aws:autoscaling:launchconfiguration',
      OptionName: 'IamInstanceProfile',
      Value: ipArn,
    },
    {
      Namespace: 'aws:elasticbeanstalk:environment',
      OptionName: 'ServiceRole',
      Value: svcArn,
    },
    {
      Namespace: 'aws:elasticbeanstalk:command',
      OptionName: 'Timeout',
      Value: '1800',
    },
  ];

  if (hasCustomVpcConfig()) {
    payload.push(
      { Namespace: 'aws:ec2:vpc', OptionName: 'VPCId', Value: cfg.vpcId },
      { Namespace: 'aws:ec2:vpc', OptionName: 'Subnets', Value: cfg.vpcSubnets },
      { Namespace: 'aws:ec2:vpc', OptionName: 'ELBSubnets', Value: cfg.vpcElbSubnets }
    );
    if (cfg.vpcAssociatePublicIp) {
      payload.push({
        Namespace: 'aws:ec2:vpc',
        OptionName: 'AssociatePublicIpAddress',
        Value: 'true',
      });
    }
  }

  const outPath = path.join(deployDir, 'eb-create-option-settings.json');
  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2), 'utf8');
  return outPath;
}

/**
 * Include deleted/terminated so we never get a false "empty" when the env failed.
 */
function describeOurEnvironment() {
  const data = runJson(
    `aws elasticbeanstalk describe-environments ` +
      `--application-name "${cfg.appName}" ` +
      `--environment-names "${cfg.envName}" ` +
      `--include-deleted ` +
      `--region "${cfg.region}" ` +
      `--output json`
  );
  const list = Array.isArray(data.Environments) ? data.Environments : [];
  return list.find((e) => e.EnvironmentName === cfg.envName) ?? null;
}

function listAllAppEnvironments() {
  const data = runJson(
    `aws elasticbeanstalk describe-environments ` +
      `--application-name "${cfg.appName}" ` +
      `--include-deleted ` +
      `--region "${cfg.region}" ` +
      `--output json`
  );
  return Array.isArray(data.Environments) ? data.Environments : [];
}

function ensureEnvironment(versionLabel) {
  const env = describeOurEnvironment();

  if (env) {
    const st = env.Status;
    if (st === 'Terminated' || st === 'Terminating') {
      console.error(
        `\nEnvironment "${cfg.envName}" exists but is ${st}. You cannot redeploy until the name is released.`
      );
      console.error(
        `Option A: wait for termination to finish, then run deploy again.\n` +
          `Option B: use a new name: $env:EB_ENV_NAME="thermosentinel-prod2"`
      );
      console.error(
        `\nTerminate (if stuck): aws elasticbeanstalk terminate-environment --environment-name "${cfg.envName}" --region "${cfg.region}"`
      );
      process.exit(1);
    }

    run(
      `aws elasticbeanstalk update-environment ` +
        `--environment-name "${cfg.envName}" ` +
        `--version-label "${versionLabel}" ` +
        `--region "${cfg.region}"`
    );
    console.log(`Updated environment: ${cfg.envName}`);
    return;
  }

  assertVpcPrerequisitesForCreate();
  const solutionStack = resolveSolutionStack();
  const optionSettingsFile = writeEbCreateOptionSettingsFile();
  const optionSettingsUri = fileUriForAwsCli(optionSettingsFile);
  console.log(`EB option settings written: ${optionSettingsUri}`);
  run(
    `aws elasticbeanstalk create-environment ` +
      `--application-name "${cfg.appName}" ` +
      `--environment-name "${cfg.envName}" ` +
      `--version-label "${versionLabel}" ` +
      `--solution-stack-name "${solutionStack}" ` +
      `--option-settings "${optionSettingsUri}" ` +
      `--region "${cfg.region}"`
  );
  console.log(`Created environment: ${cfg.envName}`);
}

async function waitForEnvironmentReady() {
  const maxMs = Math.max(60_000, cfg.waitMaxSeconds * 1000);
  const started = Date.now();
  let emptyPolls = 0;
  console.log(
    `\nWaiting for Elastic Beanstalk environment to finish provisioning (max ${Math.round(maxMs / 1000)}s)...`
  );
  console.log(
    'Note: "EBS" is Elastic Block Store (disks). This script creates an Elastic Beanstalk environment; EC2 instances get EBS volumes automatically.'
  );

  while (Date.now() - started < maxMs) {
    const env = describeOurEnvironment();
    if (!env) {
      emptyPolls += 1;
      console.log(
        `No environment record yet for "${cfg.envName}" (create may still be registering, or it failed). Poll ${emptyPolls}…`
      );
      if (emptyPolls === 4 || emptyPolls === 8) {
        console.log('\nDiagnostics — all environments for this application:');
        for (const e of listAllAppEnvironments()) {
          console.log(
            `  - ${e.EnvironmentName}: Status=${e.Status} Health=${e.Health ?? 'n/a'}`
          );
        }
        logRecentEvents();
      }
      await sleep(15_000);
      continue;
    }

    emptyPolls = 0;
    const status = env.Status;
    const health = env.Health;
    const cname = env.CNAME || '';
    console.log(`  Status: ${status}   Health: ${health ?? 'n/a'}   URL: ${cname ? `http://${cname}` : '(pending)'}`);

    if (status === 'Ready') {
      if (health === 'Red') {
        console.error('\nEnvironment is Ready but Health is Red. Check Events and logs.');
        logRecentEvents();
        process.exit(1);
      }
      console.log('\nElastic Beanstalk environment is Ready.');
      if (cname) console.log(`Open: http://${cname}`);
      return;
    }

    if (status === 'Terminated' || status === 'Terminating') {
      console.error('\nEnvironment terminated. Check AWS Console → Elastic Beanstalk → Events.');
      logRecentEvents();
      process.exit(1);
    }

    await sleep(15_000);
  }

  console.error('\nTimed out waiting for environment Ready.');
  console.error('List environments in this account/region:');
  try {
    for (const e of listAllAppEnvironments()) {
      console.error(
        `  - ${e.EnvironmentName}: Status=${e.Status} Health=${e.Health ?? 'n/a'}`
      );
    }
  } catch {
    // ignore
  }
  logRecentEvents();
  process.exit(1);
}

function logRecentEvents() {
  try {
    let data = runJson(
      `aws elasticbeanstalk describe-events ` +
        `--environment-name "${cfg.envName}" ` +
        `--max-items 15 ` +
        `--region "${cfg.region}" ` +
        `--output json`
    );
    let events = Array.isArray(data.Events) ? data.Events : [];
    if (events.length === 0) {
      data = runJson(
        `aws elasticbeanstalk describe-events ` +
          `--application-name "${cfg.appName}" ` +
          `--max-items 20 ` +
          `--region "${cfg.region}" ` +
          `--output json`
      );
      events = Array.isArray(data.Events) ? data.Events : [];
    }
    if (events.length === 0) return;
    console.error('\nRecent Elastic Beanstalk events:');
    for (const ev of events) {
      const msg = ev.Message || '';
      const sev = ev.Severity || '';
      console.error(`  [${sev}] ${msg}`);
    }
  } catch {
    // ignore
  }
}

async function main() {
  ensureAwsCli();
  ensureDeployDir();
  ensureS3Bucket();

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const versionLabel = `deploy-${stamp}`;
  const zipName = `${versionLabel}.zip`;
  const zipPath = path.join(deployDir, zipName);
  const s3Key = `${cfg.s3Prefix}/${zipName}`;

  console.log('Creating source bundle...');
  await createZip(zipPath);
  console.log(`Created: ${zipPath}`);

  run(`aws s3 cp "${zipPath}" "s3://${cfg.s3Bucket}/${s3Key}" --region "${cfg.region}"`);
  console.log(`Uploaded to s3://${cfg.s3Bucket}/${s3Key}`);

  ensureEbApplication();
  createAppVersion(versionLabel, s3Key);
  await ensureIamForElasticBeanstalk();
  ensureEnvironment(versionLabel);

  console.log('\nDeployment triggered successfully.');
  await waitForEnvironmentReady();
}

main().catch((err) => {
  console.error('\nDeploy failed.');
  console.error(err?.stderr?.toString?.() || err?.message || err);
  process.exit(1);
});

