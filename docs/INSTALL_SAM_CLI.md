# Install AWS SAM CLI (optional if you use `npm run deploy:sam`)

**You do not need SAM** to deploy the API stack: use **`npm run deploy:api`** instead. That path uses plain CloudFormation (`infra/cfn/thermosentinel-api.yaml`) and the AWS CLI only (`aws cloudformation deploy`). See comments in `.env.example` under “Deploy API stack”.

This page applies if you choose **`npm run deploy:sam`** (the older SAM template under `infra/sam/`).

If you see:

```text
sam : The term 'sam' is not recognized
```

the **AWS Serverless Application Model (SAM) CLI** is not installed or not on your `PATH`. The API stack (`infra/sam/template.yaml`) is deployed with **`sam deploy`**, not with plain `npm` alone.

## 1. Install SAM (Windows)

Official steps:

https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html

Typical approaches:

1. **MSI** — Follow *Install AWS SAM CLI* → **Windows** in the guide above (download and run the installer).
2. **pip** (if you use Python):  
   `pip install aws-sam-cli`  
   Then ensure the Scripts folder where `sam.exe` is installed is on your PATH.

After installing:

1. **Close and reopen** PowerShell or VS Code.
2. Verify:

   ```powershell
   sam --version
   ```

## 2. SAM installed but `sam` is not recognized (custom folder, e.g. `E:\AWS SAM`)

If you installed SAM to a custom path and did not add it to **PATH**, either:

**A — Add to PATH (recommended)**  
Add the folder that contains `sam.cmd` (often `…\bin`) to your user **Path** environment variable, then reopen PowerShell.

**B — Point this project at `sam.cmd`**  
Find `sam.cmd` in File Explorer (search under `E:\AWS SAM` or your install folder), then in PowerShell before deploy:

```powershell
$env:SAM_CLI_PATH = "E:\AWS SAM\bin\sam.cmd"
npm run deploy:sam
```

Use the **real** path from your PC. The deploy script also checks `E:\AWS SAM\bin\sam.cmd` and `E:\AWS SAm\bin\sam.cmd` automatically.

You can persist the variable: **Settings → System → About → Advanced system settings → Environment variables → User → New** → name `SAM_CLI_PATH`, value full path to `sam.cmd`.

## 3. Deploy the API stack

From the project root:

```powershell
npm run build:lambda
npm run deploy:sam
```

First time you may want guided setup:

```powershell
npm run deploy:sam -- --guided
```

(`--` passes extra arguments to `sam deploy`.)

## 4. Without installing SAM locally

- **AWS CloudShell** (in the AWS console): often has AWS CLI; you may install SAM with `pip install --user aws-sam-cli` or use the documented CloudShell SAM install steps, then upload/build your `dist/lambda` artifact.
- **WSL** (Windows Subsystem for Linux): install SAM using the Linux instructions in the same AWS doc.

## 5. Why SAM?

The template uses `Transform: AWS::Serverless-2016-10-31`. Packaging and deploying that transform is handled by **SAM CLI** (`sam deploy` / `sam build`), not by `npm` alone.
