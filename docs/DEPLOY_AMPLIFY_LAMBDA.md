# Deploy: Amplify (static UI) + API Gateway + Lambda (API)

This split matches a typical **serverless** layout:

| Piece | AWS service | Role |
|--------|-------------|------|
| Dashboard UI | **Amplify Hosting** | Static export from Next.js (`out/`) |
| REST API | **API Gateway (HTTP API)** + **Lambda** | `/api/health`, `/api/ingest`, `/api/sensors/{type}/readings` |

Elastic Beanstalk (`npm run deploy:aws`) is unchanged: it still ships a full Next server with `/api` on the same origin.

## 1. Prerequisites

- [AWS SAM CLI](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html) (`sam --version`)
- AWS credentials configured (`aws sts get-caller-identity`)
- Optional but **strongly recommended** for Lambda: a [Turso](https://turso.tech/) (libSQL) database so sensor data survives cold starts and concurrent invocations. Without Turso, the handler still runs, but in-memory state is **not** shared across Lambda instances.

## 2. Deploy the API (Lambda + HTTP API)

From the repo root:

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

**Outputs:** Note **`HttpApiUrl`** (e.g. `https://abc123.execute-api.us-east-1.amazonaws.com`). This value is your API **base URL** with **no trailing slash**.

**Fog / simulator:** Point cloud ingest at:

`{HttpApiUrl}/api/ingest`  
(e.g. set `CLOUD_URL` / your fog env to that full URL.)

## 3. Deploy the frontend (Amplify)

1. Push this repo to GitHub (or connect your provider).
2. In **Amplify Console** → **Host web app** → connect the repo.
3. Amplify should detect **`amplify.yml`** at the repo root.
4. Under **Environment variables**, add:

   | Name | Value |
   |------|--------|
   | `NEXT_PUBLIC_LAMBDA_API_URL` | Same as CloudFormation output **`HttpApiUrl`** (no trailing slash) |
   | *or* `NEXT_PUBLIC_API_URL` | Same value (legacy; still read by the app for Lambda mode) |

   The hosted dashboard defaults to **Local API** (browser calls your machine at `http://127.0.0.1:3000` when the UI is on Amplify). Users can switch to **Lambda** in the header to use this URL. For your **local** `npm run dev` server to accept cross-origin calls from `*.amplifyapp.com`, set **`ALLOWED_API_ORIGINS`** there (see `.env.example`).

5. **Build settings:** Ensure the build uses **Node.js 20** (Amplify console “Build image settings”, or keep the `nvm use 20` lines in `amplify.yml` if your image supports `nvm`).

6. Save and deploy.

The build runs **`npm run build:amplify`**, which sets `STATIC_EXPORT=true` and emits static files under **`out/`** (see `next.config.mjs`).

## 4. Local development (unchanged)

- `npm run dev` — Next serves UI and `/api` on one origin; with **Local API** selected in the UI, the browser uses same-origin `/api/...` (no env needed). When testing the **Amplify** URL against your laptop, choose **Local API** and run Next locally; configure **`ALLOWED_API_ORIGINS`** on the local app if the browser reports CORS errors.

## 5. NPM scripts reference

| Script | Purpose |
|--------|---------|
| `npm run build:amplify` | Static Next export into `out/` (for Amplify). |
| `npm run build:lambda` | Bundles `services/lambda-api/handler.ts` → `dist/lambda/handler.js`. |
| `npm run build:all` | `lint` → `next build` → `build:lambda` → `build:amplify`. |
| `npm run deploy:sam` | `build:lambda` + `sam deploy` (stack `thermosentinel-api`, non-interactive). |
| `npm run deploy:all` | `deploy:sam` then `deploy:aws` (Lambda API + Elastic Beanstalk). |
| `npm run ship` | **`build:all`** then **`deploy:sam`** then **`deploy:aws`** — one command for full local CI + both AWS deploys. |

For **Amplify** hosting only, connect the repo to Amplify Console (it runs `build:amplify` via `amplify.yml`); you do not need `ship` for that. Set **`NEXT_PUBLIC_LAMBDA_API_URL`** (or **`NEXT_PUBLIC_API_URL`**) in Amplify to the SAM stack **`HttpApiUrl`** output.

**Elastic Beanstalk** (`deploy:aws`) still needs your usual env vars, e.g. `EB_ENV_NAME`, `EB_S3_BUCKET`, `AWS_REGION` — see `docs/DEPLOY_AWS_BEANSTALK.md`.

## 6. Troubleshooting

- **CORS errors:** The SAM template enables broad CORS on the HTTP API. If you lock origins down later, add your `*.amplifyapp.com` (and custom domain) to `AllowOrigins`.
- **Dashboard loads but no data:** In the UI, switch to **Lambda** and confirm `NEXT_PUBLIC_LAMBDA_API_URL` / `NEXT_PUBLIC_API_URL` matches the deployed API base URL; confirm Turso env vars on Lambda if you expect persistence. For **Local API**, run `npm run dev` and ensure **`ALLOWED_API_ORIGINS`** includes your Amplify URL.
- **Amplify build fails:** If a dependency (e.g. analytics) conflicts with `output: 'export'`, check the Amplify build log; you may need to adjust `app/layout.tsx` for static hosting.
