# Deploy AWS IoT Core for ThermoSentinel (infrastructure + certificates)

This creates **Things**, **IoT policies**, **device certificates**, and wires them for:

- **Sensor (edge):** Thing `mock-sensor-001`, publishes JSON to `sensors/mock-sensor-001/data`
- **Fog:** Thing `thermosentinel-fog`, subscribes to `sensors/#`

## Prerequisites

- [AWS CLI v2](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html) configured (`aws sts get-cidentity`)
- Permissions: `cloudformation:*` (deploy stack), `iot:*` (things, policies, certs)

## Step 1 — Deploy the IoT stack (CloudFormation)

From the repo root:

```bash
npm run iot:deploy
```

Or:

```bash
aws cloudformation deploy \
  --template-file infra/iot-core/template.yaml \
  --stack-name thermosentinel-iot \
  --no-fail-on-empty-changeset
```

Optional parameters (thing names):

```bash
aws cloudformation deploy \
  --template-file infra/iot-core/template.yaml \
  --stack-name thermosentinel-iot \
  --parameter-overrides SensorThingName=mock-sensor-001 FogThingName=thermosentinel-fog
```

Creates:

- Things: `mock-sensor-001`, `thermosentinel-fog`
- Policies: `<stack>-sensor`, `<stack>-fog` (resource ARNs scoped to your account/region)

## Step 2 — Create certificates and attach to Things

```bash
npm run iot:provision
```

This script:

1. Reads stack outputs (`SensorPolicyName`, `FogPolicyName`, thing names).
2. Calls **CreateKeysAndCertificate** twice (sensor + fog).
3. Attaches each policy to its certificate and **AttachThingPrincipal**.
4. Downloads **Amazon Root CA 1** to `certs/AmazonRootCA1.pem`.
5. Writes device files under `certs/sensor/` and `certs/fog/`.
6. Writes **`.env.iot.generated`** with `MQTT_BROKER_URL=mqtts://…:8883` and commented env lines.

**Security:** `certs/` and `.env.iot.generated` are **gitignored**. Do not commit private keys.

Environment:

- `AWS_REGION` — default `us-east-1`
- `IOT_STACK_NAME` — default `thermosentinel-iot`

## Step 3 — Run the app

Use **two terminals** (sensor and fog need **different** certs):

**Terminal A — simulator**

Uncomment the “Terminal A” block from `.env.iot.generated` into `.env.local` (or export vars), then:

```bash
npm run simulator
```

**Terminal B — fog**

Uncomment the “Terminal B” block (fog cert paths + `FOG_MQTT_CLIENT_ID`), then:

```bash
npm run fog
```

**Terminal C — Next.js**

```bash
npm run dev
```

Or merge all non-conflicting vars into `.env.local` and use `npm run dev:iot` (still run fog + simulator with correct cert env per process).

## Verify in AWS Console

- **IoT Core** → **Manage** → **Things** — both things listed.
- **Secure** → **Policies** — stack-named policies.
- **Test** → MQTT test client — subscribe to `sensors/#` while simulator runs.

## Destroy

```bash
aws cloudformation delete-stack --stack-name thermosentinel-iot
```

Certificates created outside the template must be **deactivated/archived** in **IoT Core** → **Security** → **Certificates** if you no longer need them.

## Troubleshooting

| Issue | What to check |
|--------|----------------|
| `Stack not found` | Run `npm run iot:deploy` first. |
| `AccessDenied` | IAM user/role needs `iot:*` and CloudFormation permissions. |
| MQTT connect failed | `MQTT_BROKER_URL` must use `mqtts://` and port **8883**; PEM paths correct. |
| Policy error | Thing name must match **exact** client ID (`SIMULATOR_MQTT_CLIENT_ID`, `FOG_MQTT_CLIENT_ID`). |

See also **`docs/AWS_IOT_CORE.md`** and **`docs/PIPELINE_EDGE_FOG_CLOUD.md`**.
