# Deploy: Amplify (static UI) + API Gateway + Lambda (API)

This split matches a typical **serverless** layout:

| Piece | AWS service | Role |
|--------|-------------|------|
| Dashboard UI | **Amplify Hosting** | Static export from Next.js (`out/`) |
| REST API | **API Gateway (HTTP API)** + **Lambda** | `/api/health`, `/api/ingest`, `/api/sensors/{type}/readings` |
| Async ingest | **SQS** + same **Lambda** | Fog can `SendMessage` with the same JSON as HTTP ingest; DLQ + optional **SNS** ops topic. See **`docs/DEPLOY_SQS_PIPELINE.md`**. |

Elastic Beanstalk (`npm run deploy:aws`) is unchanged: it still ships a full Next server with `/api` on the same origin.

## 1. Prerequisites

- **API stack:** either **`npm run deploy:api`** (CloudFormation + AWS CLI; no SAM) or **`npm run deploy:sam`** with the [AWS SAM CLI](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html). If you use SAM and `sam` is not recognized, see **`docs/INSTALL_SAM_CLI.md`**.
- AWS credentials configured (`aws sts get-caller-identity`)
- **Storage:** the API stack provisions **DynamoDB** (`…-readings`) for sensor data. Turso is optional legacy; prefer DynamoDB for new deploys.

## 2. Deploy the API (Lambda + HTTP API)

From the repo root:

**Option A — no SAM (`deploy:api` builds Lambda + uploads + CloudFormation deploy):**

```bash
npm install
npm run deploy:api
```

This writes **`deploy/thermosentinel-api.env.generated`** with **`FOG_SQS_QUEUE_URL`**, **`CLOUD_URL`**, **`NEXT_PUBLIC_LAMBDA_API_URL`**. Refresh with **`npm run stack:env`** without redeploying.

**Option B — SAM:**

```bash
npm install
npm run build:lambda
sam deploy --template-file infra/sam/template.yaml --stack-name thermosentinel-api --resolve-s3 --capabilities CAPABILITY_IAM --guided
```

On later deploys you can omit `--guided` and use `infra/sam/samconfig.toml.example` as a template for `samconfig.toml`.

**Pass Turso (recommended):**

```bash
sam deploy --template-file infra/sam/template.yaml --stack-name thermosentinel-api --resolve-s3 --capabilities CAPABILITY_IAM \
  --parameter-overrides TursoDatabaseUrl="libsql://...." TursoAuthToken="..."
```

**Outputs:**

- **`HttpApiUrl`** — API **base URL** with **no trailing slash** (Amplify / dashboard Lambda mode).
- **`IngestQueueUrl`** — set **`FOG_SQS_QUEUE_URL`** on the fog node so batches also go **SQS → Lambda** (same payload as HTTP). IAM on the fog identity needs **`sqs:SendMessage`**.
- **`OpsTopicArn`** — optional SNS topic for subscriptions / alarms.

**Fog / simulator:** Point cloud ingest at:

`{HttpApiUrl}/api/ingest`  
(e.g. set `CLOUD_URL` / your fog env to that full URL.)

Queue path: see **`docs/DEPLOY_SQS_PIPELINE.md`**.

## 3. Deploy the frontend (Amplify)

### 3a. Connect Git and push

1. Commit and push this repo to **GitHub**, **GitLab**, **Bitbucket**, or AWS CodeCommit (Amplify connects to these).
2. Example (new GitHub repo):

   ```bash
   git add -A
   git commit -m "ThermoSentinel: API + Amplify hosting"
   git remote add origin https://github.com/YOUR_ORG/YOUR_REPO.git
   git push -u origin main
   ```

3. In **AWS Amplify Console** → **Host web app** → **Connect branch** → select the repo and branch (e.g. `main`). Amplify detects **`amplify.yml`** at the repo root.

### 3b. Environment variables (required for the live API)

The static UI must know your **HTTP API** base URL at **build** time (`NEXT_PUBLIC_*` are inlined).

From your machine (with AWS CLI and a deployed API stack):

```bash
npm run amplify:env
```

That prints **`NEXT_PUBLIC_LAMBDA_API_URL`** = CloudFormation **`HttpApiUrl`**. In **Amplify** → your app → **Hosting** → **Environment variables**, add:

| Name | Value |
|------|--------|
| `NEXT_PUBLIC_LAMBDA_API_URL` | Output **`HttpApiUrl`** (no trailing slash) |
| `NEXT_PUBLIC_API_URL` | Same (optional legacy alias) |

**You do not** set DynamoDB, SQS, or SNS keys in Amplify — only the Lambda backend uses those.

Optional:

| Name | Value |
|------|--------|
| `NEXT_PUBLIC_FOG_STATUS_URL` | Only if your fog node exposes `GET /status` on a **public** URL (rare for class demos). |

Redeploy the frontend after saving variables (Amplify rebuilds with the new `NEXT_PUBLIC_*` values).

### 3c. Behaviour on Amplify

- With **`NEXT_PUBLIC_LAMBDA_API_URL`** set at build time, the dashboard **defaults to “AWS Lambda”** on the first paint (including static export) so fetches go to **API Gateway**, not `http://127.0.0.1:3000` in the visitor’s browser.
- **Local API** still works for developers who run `npm run dev` and open the Amplify URL with **Local API** selected; set **`ALLOWED_API_ORIGINS`** on the local Next server for CORS (see `.env.example`).

### 3d. Build

The build runs **`npm run build:amplify`** (`STATIC_EXPORT=true` → output **`out/`**). Use **Node 20** (`amplify.yml` uses `nvm` when available).

### 3e. No Git (manual ZIP)

On Windows, do **not** use `Compress-Archive` on `out/` — paths break on Amplify’s Linux host. After **`npm run build:amplify`**, run **`npm run zip:out`**, then upload **`amplify-manual.zip`** via `aws amplify create-deployment` / `start-deployment`.

## 4. Local development (unchanged)

- `npm run dev` — Next serves UI and `/api` on one origin; with **Local API** selected in the UI, the browser uses same-origin `/api/...` (no env needed). When testing the **Amplify** URL against your laptop, choose **Local API** and run Next locally; configure **`ALLOWED_API_ORIGINS`** on the local app if the browser reports CORS errors.

## 5. NPM scripts reference

| Script | Purpose |
|--------|---------|
| `npm run build:amplify` | Static Next export into `out/` (for Amplify). |
| `npm run build:lambda` | Bundles `services/lambda-api/handler.ts` → `dist/lambda/handler.js`. |
| `npm run build:all` | `lint` → `next build` → `build:lambda` → `build:amplify`. |
| `npm run deploy:api` | `build:lambda` + CloudFormation deploy (preferred if no SAM CLI). |
| `npm run deploy:sam` | `build:lambda` + `sam deploy` (optional). |
| `npm run deploy:all` | `deploy:api` then `deploy:aws` (Lambda API + Elastic Beanstalk). |
| `npm run ship` | **`build:all`** then **`deploy:api`** then **`deploy:aws`**. |
| `npm run amplify:env` | Print Amplify Console env vars from stack **`HttpApiUrl`** (AWS CLI). |

For **Amplify** hosting only, connect the repo and set **`NEXT_PUBLIC_LAMBDA_API_URL`** from **`HttpApiUrl`**. Run **`npm run amplify:env`** to copy values from CloudFormation.

**Elastic Beanstalk** (`deploy:aws`) still needs your usual env vars, e.g. `EB_ENV_NAME`, `EB_S3_BUCKET`, `AWS_REGION` — see `docs/DEPLOY_AWS_BEANSTALK.md`.

## 6. Troubleshooting

- **CORS errors:** The SAM template enables broad CORS on the HTTP API. If you lock origins down later, add your `*.amplifyapp.com` (and custom domain) to `AllowOrigins`.
- **Dashboard loads but no data:** Confirm **`NEXT_PUBLIC_LAMBDA_API_URL`** was set **before** the Amplify build (redeploy after editing env vars). In the browser, open DevTools → Network and confirm requests go to **`execute-api…amazonaws.com`**, not `127.0.0.1`. Check Lambda has **`DYNAMODB_READINGS_TABLE`** and that something is **POSTing to `/api/ingest`** (fog/simulator or a test); otherwise readings stay empty and you only see demo fill. For **Local API**, run `npm run dev` and set **`ALLOWED_API_ORIGINS`** for your Amplify URL.
- **Amplify build fails:** If a dependency (e.g. analytics) conflicts with `output: 'export'`, check the Amplify build log; you may need to adjust `app/layout.tsx` for static hosting.
