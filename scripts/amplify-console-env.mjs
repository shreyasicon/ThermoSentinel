#!/usr/bin/env node
/**
 * Prints Amplify Console environment variables from CloudFormation stack outputs
 * (copy-paste into Hosting → Environment variables). Run: npm run amplify:env
 */

import { fetchStackOutputsMap } from './thermo-stack-env.mjs';

const stackName = (process.env.THERMO_API_STACK_NAME || 'thermosentinel-api').trim();
const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'us-east-1';

const map = fetchStackOutputsMap(stackName, region);
if (!map) {
  console.error(`Could not read stack "${stackName}" in ${region}. Deploy the API stack first (npm run deploy:api).`);
  process.exit(1);
}

const http = map.HttpApiUrl || '';
console.log(`
=== AWS Amplify Hosting → Environment variables ===
(Add these in the Amplify app → Hosting → Environment variables, then redeploy the frontend.)

Name                              Value
--------------------------------  -----
NEXT_PUBLIC_LAMBDA_API_URL        ${http}
NEXT_PUBLIC_API_URL               ${http}   (optional legacy alias)

Notes:
- No trailing slash on the API URL.
- After saving env vars, trigger a new build (Redeploy this version).
- The dashboard defaults to "AWS Lambda" data source on *.amplifyapp.com when the URL is set at build time.
- DynamoDB / SNS / SQS are used only by Lambda (no browser keys needed).

=== Optional (fog status panel when your fog node is reachable) ===
NEXT_PUBLIC_FOG_STATUS_URL        http://YOUR_PUBLIC_IP:4000/status   (only if you expose fog)

---
Git → Amplify (typical flow):
1. Create a repo on GitHub and push this project:  git remote add origin <url> && git push -u origin main
2. AWS Amplify Console → Host web app → Connect branch → pick repo → use amplify.yml
3. Paste the env vars above → Save → Deploy

`);
