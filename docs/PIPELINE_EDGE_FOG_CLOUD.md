# Edge → Fog → Cloud pipeline

End-to-end data path implemented in this repo:

```text
Sensor (simulator or hardware)
    → MQTT and/or HTTP
Edge (publisher)
    → topic: {MQTT_TOPIC_ROOT}/<room>/<sensorType>  (default root: library/sensors)
AWS IoT Core (mqtts + certs); optional local broker if you override MQTT_BROKER_URL
    → subscribe
Fog node (services/fog-node)
    → POST JSON envelope to cloud /api/ingest
    → optional: AWS SQS (same JSON body)
    → optional: MQTT publish to fog/out/envelopes (mirror for IoT Rules → Lambda)
Cloud
    → Next.js /api/ingest or API Gateway + Lambda
```

## 1. Sensor → edge

| Mode | Configure | Sends to |
|------|-----------|----------|
| **MQTT** (default) | `SENSOR_TRANSPORT=mqtt`, `MQTT_BROKER_URL`, `MQTT_TOPIC_ROOT` | Broker topics under `library/sensors/...` |
| **MQTT (IoT lab)** | `MQTT_TOPIC_MODE=iot`, `MQTT_DATA_TOPIC=sensors/mock-sensor-001/data` | Single topic; JSON `{"readings":[...]}` — see **`docs/AWS_IOT_CORE.md`** |
| **HTTP** | `SENSOR_TRANSPORT=http`, `FOG_URL=http://localhost:4000/ingest` | Fog HTTP POST |

Scripts: `npm run simulator` (MQTT), `npm run simulator:http` (HTTP).

## 2. Edge → broker → fog

1. **AWS IoT Core (default):** Set **`MQTT_BROKER_URL`** to your **`mqtts://…-ats.iot.….amazonaws.com:8883`** endpoint, PEM paths, and client IDs — see **`docs/AWS_IOT_CORE.md`**. Then **`npm run dev:all`** (or **`dev:iot`**) starts Next + fog + simulator.
2. **Optional local broker:** Point **`MQTT_BROKER_URL`** at **`mqtt://localhost:1883`** and set **`MQTT_TOPIC_FILTER`** / **`MQTT_TOPIC_MODE`** to match; see **`services/mosquitto/mosquitto.conf`**.
3. **HTTP-only:** **`npm run dev:all:http`** — no MQTT env vars.

One terminal: **`npm run dev`** starts Next + fog + simulator together (same as **`npm run dev:all`**). For Next only: **`npm run dev:next`**.

## 3. Fog → cloud

- **HTTP** (always on): `CLOUD_URL` → default `http://localhost:3000/api/ingest` or your API Gateway `.../api/ingest`.
- **SQS** (optional): Stack creates **IngestQueue** + **DLQ**; Lambda consumes messages (same JSON as HTTP). Set **`FOG_SQS_QUEUE_URL`** to **`IngestQueueUrl`**. Details: **`docs/DEPLOY_SQS_PIPELINE.md`**.
- **DynamoDB**: Stack creates **`…-readings`** (PK `sensorType`, SK `readingKey`). Lambda and (optionally) local Next.js use **`DYNAMODB_READINGS_TABLE`** — see **`deploy/thermosentinel-api.env.generated`** after **`npm run deploy:api`**. Turso remains optional if DynamoDB is not used locally.
- **SNS**: **`OpsTopic`** + optional **email subscription** (`OPS_ALERT_EMAIL` / parameter **`OpsAlertEmail`** on deploy). **Confirm the AWS “Subscription Confirmation” email.** Ingest evaluates **CRITICAL** readings (temperature, smoke, humidity thresholds) and **`Publish`**es to the topic.
- **MQTT publish** (optional): set `FOG_MQTT_PUBLISH=true`. Fog republishes each envelope to `MQTT_TO_CLOUD_TOPIC` (default `fog/out/envelopes`) on `MQTT_PUBLISH_BROKER_URL` (defaults to the same broker; point to **AWS IoT Core** for cloud-side subscribers).

## 4. AWS IoT Core (replace Mosquitto in cloud)

Point `MQTT_BROKER_URL` / `MQTT_PUBLISH_BROKER_URL` at `mqtts://<endpoint>:8883` and set PEM paths:

- `AWS_IOT_CA_PATH`
- `AWS_IOT_CERT_PATH`
- `AWS_IOT_KEY_PATH`

Create IoT policy allowing `subscribe` on `library/sensors/#` and `publish` on `fog/out/envelopes` (or your topics).

## 5. Dashboard: fog status (frontend)

The **Fog pipeline** card calls `GET /api/fog/status`, which proxies to the fog node `GET http://127.0.0.1:4000/status`.

- Set **`FOG_STATUS_URL`** on the Next server if fog runs elsewhere.
- Static Amplify builds **omit** API routes: set **`NEXT_PUBLIC_FOG_STATUS_URL=http://<host>:4000/status`** and allow CORS via **`FOG_CORS_ORIGIN`** on the fog node (or tunnel).

## Environment reference

See root `.env.example` (section **Fog / pipeline**).
