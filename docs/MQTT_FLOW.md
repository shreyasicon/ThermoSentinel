# MQTT and HTTP flow — ThermoSentinel

## Default local stack (HTTP)

**`npm run dev`** (same as **`npm run dev:all`**) starts Next.js, the fog node, and the sensor simulator with **no MQTT broker**:

1. Simulator **`SENSOR_TRANSPORT=http`** → POST readings to **`http://localhost:4000/ingest`**
2. Fog **`FOG_INPUT_MODE=http`** → validates/batches → POST to **`CLOUD_URL`** (default **`http://localhost:3000/api/ingest`**)
3. Dashboard reads **`/api/sensors/.../readings`**

Fog exposes **`http://127.0.0.1:4000/status`**; the UI uses **`/api/fog/status`** as a proxy.

---

## AWS IoT Core (MQTT over TLS on **8883**)

For **MQTT**, use **`npm run dev:iot`** (Next + **`fog:mqtt`** + **`simulator:mqtt`**) and set **`MQTT_BROKER_URL`** to your account’s **device data endpoint** (IoT console → Settings). The code uses **`mqtt.js`** with PEM-based TLS (**`lib/mqtt-connect-options.ts`**).

1. Create Things, certificates, and policies (**`docs/AWS_IOT_CORE.md`**, or **`npm run iot:deploy`** / **`npm run iot:provision`** per **`docs/AWS_IOT_DEPLOY.md`**).
2. In `.env` (or `.env.iot.generated`):

   - **`MQTT_BROKER_URL=mqtts://xxxxx-ats.iot.REGION.amazonaws.com:8883`**
   - **`AWS_IOT_CA_PATH`**, **`AWS_IOT_CERT_PATH`**, **`AWS_IOT_KEY_PATH`**
   - **`FOG_MQTT_CLIENT_ID`** / **`SIMULATOR_MQTT_CLIENT_ID`** matching policies
   - Defaults align with the IoT lab shape:
     - **`MQTT_TOPIC_MODE=iot`**
     - **`MQTT_DATA_TOPIC=sensors/mock-sensor-001/data`**
     - **`MQTT_TOPIC_FILTER=sensors/#`** (fog subscribe)

3. Run from the **repo root** (so `.env` resolves). Fog and the simulator load **`lib/load-env.ts`** so IoT variables apply. **Shell / `cross-env` wins** over `.env` for the same key (so `npm run fog` can force HTTP without `.env` overriding it).

---

## Optional: hierarchical “library/…” topics (non-IoT tutorial)

Set **`MQTT_TOPIC_MODE=library`**, **`MQTT_TOPIC_ROOT=library/sensors`**, and point **`MQTT_BROKER_URL`** at any broker that supports your auth. Override **`MQTT_TOPIC_FILTER`** (e.g. **`library/sensors/#`**) to match.

---

## Topic defaults (IoT lab)

| Piece | Default |
|--------|---------|
| Simulator publish | **`MQTT_DATA_TOPIC`** (`sensors/mock-sensor-001/data`) with JSON `{ "readings": [...] }` |
| Fog subscribe | **`MQTT_TOPIC_FILTER`** = **`sensors/#`** |

## Data flow

1. Simulator produces readings and publishes (MQTT) or HTTP POSTs to fog.
2. Fog validates, batches, forwards to **`CLOUD_URL`** and optionally **SQS**.
3. Dashboard reads **`/api/sensors/[type]/readings`**.

## Environment variables (summary)

| Variable | Purpose |
|----------|---------|
| `SENSOR_TRANSPORT` | **`http`** (default in code + `npm run simulator`) or **`mqtt`** (`simulator:mqtt`) |
| `FOG_PORT` | **`4000`** — fog HTTP port (use this name; do not reuse Next’s **`PORT=3000`** from `.env`) |
| `FOG_INPUT_MODE` | **`http`** (default in code + `npm run fog`), **`mqtt`**, or **`both`** |
| `MQTT_BROKER_URL` | **Required** for MQTT subscriber — IoT endpoint **`mqtts://…-ats.iot.….amazonaws.com:8883`** |
| `MQTT_TOPIC_MODE` | `iot` (default) or `library` |
| `MQTT_DATA_TOPIC` | IoT single-topic publish target |
| `MQTT_TOPIC_FILTER` | Fog subscription (default **`sensors/#`**) |
| `MQTT_TOPIC_ROOT` | Used when **`MQTT_TOPIC_MODE=library`** |
| `MQTT_FLUSH_MS` | batch flush interval (default `2000`) |

**Loading `.env`:** `next dev` reads `.env`; **`npm run fog`** / **`npm run simulator`** use **`lib/load-env.ts`**. Variables already set in the environment (including from **`cross-env`**) are not overwritten by file merges.

### ngrok (or similar) to `localhost:3000`

If the dashboard is opened at **`https://your-subdomain.ngrok-free.dev`**, the app treats that like localhost and uses **same-origin** `/api/…`. Point the fog node at the public ingest URL, e.g. **`CLOUD_URL=https://your-subdomain.ngrok-free.dev/api/ingest`**. Set **`FOG_CORS_ORIGIN`** to the same `https://…` origin if the browser calls the fog HTTP API directly.

---

## Troubleshooting: no messages in the AWS IoT **MQTT test client**

1. **`npm run dev` / `npm run dev:all` does not use IoT MQTT** — the default stack uses **HTTP** (simulator → fog → Next). Nothing is published to AWS IoT. Use **`npm run dev:iot`** and a repo-root **`.env`** with **`MQTT_BROKER_URL`**, **`AWS_IOT_*_PATH`**, **`SIMULATOR_MQTT_CLIENT_ID`**, **`FOG_MQTT_CLIENT_ID`**, topics (see `.env.example`).

2. **Same AWS Region** — open **MQTT test client** in the **same region** as your endpoint (`…-ats.iot.**us-east-1**.amazonaws.com` → console top-right **us-east-1**).

3. **Mutual TLS** — `mqtts://` requires **Amazon Root CA + device cert + private key** paths. If the simulator exits or logs TLS errors, fix paths (repo-root relative, e.g. `./certs/device.pem.crt`).

4. **IoT policy** — the certificate must allow **`iot:Publish`** to **`…/topic/sensors/mock-sensor-001/data`** (or your `MQTT_DATA_TOPIC`) and **`iot:Connect`** for your **`SIMULATOR_MQTT_CLIENT_ID`**. If policy denies publish, the broker drops messages (check simulator terminal for errors).

5. **Subscribe filter** — use **`sensors/#`** or the exact **`MQTT_DATA_TOPIC`** string your simulator prints at startup.

6. **Lambda / API Gateway** — the **HTTP API + Lambda** stack does **not** show up in the IoT MQTT test client. That path is **REST**, not MQTT. You only see MQTT traffic when a **client publishes to IoT Core** (simulator, test client, or an IoT Rule target). To run logic on each message, add an **IoT Rule** → Lambda in the AWS console (separate from this repo’s default flow).
