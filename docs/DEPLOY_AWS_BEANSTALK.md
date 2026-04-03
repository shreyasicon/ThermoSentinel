# AWS Elastic Beanstalk deploy notes

## EBS vs Elastic Beanstalk (common confusion)

- **EBS (Elastic Block Store)** = AWS disk volumes. You do **not** create “EBS” as a separate step in this deploy script.
- **Elastic Beanstalk** = managed platform that creates **load balancer + EC2 instances**. Each EC2 instance automatically uses **EBS volumes** for its root disk.

So: if you expected a standalone “EBS resource,” that is not what this app deploy creates. What you get is an **Elastic Beanstalk environment** (and EBS exists *inside* each instance).

## Verify the environment exists

```bash
aws elasticbeanstalk describe-environments \
  --application-name thermosentinel-app \
  --environment-names thermosentinel-prod \
  --region ap-south-1
```

Get URL (CNAME):

```bash
aws elasticbeanstalk describe-environments \
  --application-name thermosentinel-app \
  --environment-names thermosentinel-prod \
  --region ap-south-1 \
  --query "Environments[0].CNAME" \
  --output text
```

Provisioning can take **5–15 minutes** after `create-environment`.

## Next.js build on the instance (required)

The source bundle **excludes** `.next/` and `node_modules/`. The platform runs `npm install` and **`npm start`** (`next start`), which needs a prior **`next build`**.

The repo includes **`.ebextensions/01_node_build.config`**, which:

- Sets **`NPM_USE_PRODUCTION=false`** so **devDependencies** (e.g. TypeScript) are installed.
- Runs **`npm run build`** in **`container_commands`** (leader-only) after dependencies install.
- Sets **`aws:elasticbeanstalk:command` → `Timeout` = `1800`** so long installs/builds are less likely to time out.

## Deploy script wait

`npm run deploy:aws` now waits (polls) until Status is **Ready** and prints the URL, or shows recent events on failure.

- Override max wait: `EB_WAIT_MAX_SECONDS=1200` (default 900).

## "Environment not visible yet" forever

That happened when the environment **failed or terminated**: the script used `--no-include-deleted`, so AWS returned **no rows** and the wait loop looked empty forever.

The deploy script now uses **`--include-deleted`** so terminated/failed environments are still visible, prints **diagnostics** (lists all envs for the app), and falls back to **application-level events** if env-specific events are empty.

## If the app does not start

Check **Elastic Beanstalk → Environment → Events** in the AWS Console. Typical fixes:

- Add environment variables your Next.js app needs.
- Ensure `npm run build` / `npm start` works in the Node platform (may need a `Procfile` or platform hooks — add if deployment succeeds but app returns 502).

## Error: "Default VPC not found" / load balancer `InvalidConfigurationRequest`

Elastic Beanstalk creates an **Application Load Balancer** in a VPC. If your account has **no default VPC** in that region (common if it was deleted or the account is older), creation fails with events like:

- `Creating load balancer failed Reason: Default VPC not found`
- `Resource AWSEBAutoScalingGroup does not exist` (follow-on CloudFormation failure)

**Fix (recommended):** create the default VPC once in that region:

```bash
aws ec2 create-default-vpc --region ap-south-1
```

Or in the console: **VPC** → **Actions** → **Create default VPC**.

Then **terminate** the failed Beanstalk environment and deploy again (or use a new `EB_ENV_NAME`).

**Alternative:** deploy into a **custom VPC** by setting all of:

- `EB_VPC_ID` — e.g. `vpc-0abc...`
- `EB_SUBNETS` — comma-separated subnet IDs for EC2 (typically 2+ AZs)
- `EB_ELB_SUBNETS` — subnets for the load balancer (often the same public subnets)

Optional: `EB_ASSOCIATE_PUBLIC_IP=true` (default) for instances in public subnets; set `EB_ASSOCIATE_PUBLIC_IP=false` only with private subnets + NAT.

## Error: "Environment must have instance profile associated with it"

Elastic Beanstalk needs:

1. **EC2 instance profile** (so instances can pull app versions from S3, publish logs, etc.)
2. **Elastic Beanstalk service role** (so the service can manage resources on your behalf)

The `npm run deploy:aws` script now creates default roles if missing:

- Instance profile / EC2 role name: `aws-elasticbeanstalk-ec2-role` (override with `EB_EC2_INSTANCE_PROFILE`)
- Service role name: `aws-elasticbeanstalk-service-role` (override with `EB_SERVICE_ROLE`)

The deploy script passes these via **`deploy/eb-create-option-settings.json`** and `--option-settings file://...` (not comma-separated CLI shorthand). That avoids cases on **Windows** where the AWS CLI or shell does not apply `IamInstanceProfile` / `ServiceRole` correctly, which leads to this exact error even when the roles exist.

If a previous deploy **failed** and left the environment in a bad state, **terminate** that environment in the console, pick a **new** `EB_ENV_NAME` if the name is still tied to a terminated env, then run deploy again.

### Environment name is still "Terminated"

Elastic Beanstalk keeps a **Terminated** record for a while. The deploy script **cannot** create or update an env whose name is **Terminated** — use another name until AWS releases it, for example:

```powershell
$env:EB_ENV_NAME = "thermosentinel-prod"
$env:EB_S3_BUCKET = "your-stable-artifacts-bucket"
npm run deploy:aws
```

Set **`EB_S3_BUCKET`** to a fixed bucket so every run does not create a new S3 bucket.

```bash
aws elasticbeanstalk terminate-environment --environment-name thermosentinel-prod --region ap-south-1
```
