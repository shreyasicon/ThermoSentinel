# SQS ingest pipeline (fog → queue → Lambda)

After deploying the API stack (`infra/cfn/thermosentinel-api.yaml` via **`npm run deploy:api`**, or `infra/sam/template.yaml` via SAM), you get:

| Resource | Purpose |
|----------|---------|
| **IngestQueue** | Fog sends the **same JSON string** as `POST /api/ingest` (FogEnvelope). |
| **Lambda** | Triggered by SQS; runs `processIngestEnvelope` for each message. |
| **IngestDLQ** | Failed messages (after retries) land here for inspection. |
| **OpsTopic** (SNS) | Optional operations notifications — add email subscriptions in the SNS console. |

## 1. Deploy / update the API stack

**SAM-free (recommended if you do not have SAM CLI):**

```bash
npm run deploy:api
```

**Or with SAM:**

```bash
npm run build:lambda
sam deploy --template-file infra/sam/template.yaml --stack-name thermosentinel-api --resolve-s3 --capabilities CAPABILITY_IAM --guided
```

## 2. Wire fog + app from stack outputs

**Automatic env file (FOG_SQS_QUEUE_URL + CLOUD_URL + NEXT_PUBLIC_LAMBDA_API_URL):**

- After **`npm run deploy:api`**, the script writes **`deploy/thermosentinel-api.env.generated`** (gitignored).
- Refresh without redeploying: **`npm run stack:env`** (uses `THERMO_API_STACK_NAME` + `AWS_REGION`).

In PowerShell, merge into your session before **`npm run fog`**:

```powershell
Get-Content .\deploy\thermosentinel-api.env.generated | ForEach-Object {
  if ($_ -match '^\s*#' -or $_ -notmatch '=') { return }
  $n, $v = $_ -split '=', 2
  Set-Item -Path "Env:$n" -Value $v
}
```

Or copy the `FOG_SQS_QUEUE_URL` and `CLOUD_URL` lines into your own `.env` / shell.

Manual copy from CloudFormation **Outputs** or:

`aws cloudformation describe-stacks --stack-name thermosentinel-api --query "Stacks[0].Outputs"`

- **`IngestQueueUrl`** → **`FOG_SQS_QUEUE_URL`**
- **`FogIngestUrl`** → **`CLOUD_URL`** (HTTP ingest; can run **HTTP + SQS** in parallel)
- **`HttpApiUrl`** → **`NEXT_PUBLIC_LAMBDA_API_URL`** (dashboard / browser calls to Lambda)

## 3. Configure the fog node

```powershell
$env:FOG_SQS_QUEUE_URL="https://sqs.us-east-1.amazonaws.com/518029233624/thermosentinel-api-ingest"
$env:AWS_REGION="us-east-1"
# Credentials: AWS_PROFILE or default CLI credentials must allow sqs:SendMessage on this queue
npm run fog
```

The fog node calls `SendMessage` with the envelope JSON (`services/fog-node/sqs-dispatch.ts`). The client uses the **region parsed from the queue URL** so `AWS_REGION` can differ from the queue region without breaking sends.

### IAM for fog (developer laptop or EC2)

**Same account (typical):** attach an **identity policy** to your IAM user or role:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "sqs:SendMessage",
      "Resource": "arn:aws:sqs:us-east-1:ACCOUNT_ID:thermosentinel-api-ingest"
    }
  ]
}
```

**Optional queue resource policy (cross-account or explicit allow):** set **`FOG_SENDER_PRINCIPAL_ARN`** to the IAM principal ARN before **`npm run deploy:api`** (or pass **`FogSenderPrincipalArn`** to SAM). The stack adds an **SQS queue policy** allowing that principal `sqs:SendMessage`. Leave empty if you only use identity policies on the sender.

## 4. End-to-end paths

| Path | Flow |
|------|------|
| **HTTP** | Fog → `POST .../api/ingest` → Lambda (sync). |
| **SQS** | Fog → SQS → Lambda (async buffer; decouples spikes). |
| **Both** | Fog keeps **`CLOUD_URL`** for POST **and** **`FOG_SQS_QUEUE_URL`** for the queue (default sends both after each batch). |

To use **SQS only**, unset or change **`CLOUD_URL`** — see fog `dispatchToCloud` in `services/fog-node/index.ts`.

## 5. Monitoring

- **SQS** → Ingest queue → **Monitoring** (messages visible, age).
- **DLQ** → **IngestDLQ** — inspect messages if payloads are invalid or Turso/Lambda errors persist.
- **Dashboard** → **Fog pipeline** panel shows **SQS messages sent / failures**, queue name, and region when **`FOG_SQS_QUEUE_URL`** is set.

## 6. Environment variables (Lambda)

The stack sets:

- **`INGEST_QUEUE_URL`** — queue URL (Lambda `/api/health` reports `queue: sqs` when set).
- **`SNS_OPS_TOPIC_ARN`** — reserved for future use (e.g. publish failures from code).

See also **`docs/DEPLOY_AMPLIFY_LAMBDA.md`** for Amplify + API URL.
