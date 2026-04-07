# AWS IoT Core — aligned with AWS IoT tutorials

**Automated AWS setup:** deploy Things + policies and provision certificates with **`docs/AWS_IOT_DEPLOY.md`** (`npm run iot:deploy` → `npm run iot:provision`).

---

This project can mirror common **AWS IoT Core** labs:

1. Create a **Thing** (e.g. `mock-sensor-001`).
2. **Auto-generate a certificate**, download **device cert**, **private key**, and **Amazon Root CA 1**.
3. Create an **IoT policy** (e.g. `SensorPublishPolicy`) and attach it to the certificate.
4. Connect with **mqtts://** on port **8883** using the **same client ID as the Thing name** when using registry-based policies.

ThermoSentinel adds a **fog subscriber** (second Thing + policy) that listens on a wide topic filter and forwards to your cloud API.

---

## Reference policy: `SensorPublishPolicy` (sensor / edge only)

Replace `REGION`, `ACCOUNT`, and thing name if needed. This matches the classic lab shape: one client id, one data topic, subscribe under the same prefix.

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "iot:Connect",
      "Resource": "arn:aws:iot:REGION:ACCOUNT:client/mock-sensor-001"
    },
    {
      "Effect": "Allow",
      "Action": "iot:Publish",
      "Resource": "arn:aws:iot:REGION:ACCOUNT:topic/sensors/mock-sensor-001/data"
    },
    {
      "Effect": "Allow",
      "Action": "iot:Receive",
      "Resource": "arn:aws:iot:REGION:ACCOUNT:topic/sensors/mock-sensor-001/data"
    },
    {
      "Effect": "Allow",
      "Action": "iot:Subscribe",
      "Resource": "arn:aws:iot:REGION:ACCOUNT:topicfilter/sensors/mock-sensor-001/#"
    }
  ]
}
```

Use this certificate **only** for the **sensor simulator** (`SIMULATOR_MQTT_CLIENT_ID=mock-sensor-001`).

---

## Fog subscriber (second Thing): `FogSubscribePolicy` example

The fog node uses a **different** client ID (e.g. `thermosentinel-fog`) and must **subscribe** to a filter that includes your data topic, e.g. `sensors/#`.

Create another Thing + certificate, or reuse a policy that allows:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "iot:Connect",
      "Resource": "arn:aws:iot:REGION:ACCOUNT:client/thermosentinel-fog"
    },
    {
      "Effect": "Allow",
      "Action": "iot:Subscribe",
      "Resource": "arn:aws:iot:REGION:ACCOUNT:topicfilter/sensors/#"
    },
    {
      "Effect": "Allow",
      "Action": "iot:Receive",
      "Resource": "arn:aws:iot:REGION:ACCOUNT:topic/sensors/*"
    }
  ]
}
```

---

## ThermoSentinel env (tutorial-style topics)

Single data topic + JSON batch (matches **Pub/Sub** payloads to IoT Core):

```bash
MQTT_BROKER_URL=mqtts://xxxxxx-ats.iot.REGION.amazonaws.com:8883
AWS_IOT_CA_PATH=./certs/AmazonRootCA1.pem
AWS_IOT_CERT_PATH=./certs/device.pem.crt
AWS_IOT_KEY_PATH=./certs/private.pem.key

MQTT_TOPIC_MODE=iot
MQTT_DATA_TOPIC=sensors/mock-sensor-001/data
MQTT_TOPIC_FILTER=sensors/#

SIMULATOR_MQTT_CLIENT_ID=mock-sensor-001
FOG_MQTT_CLIENT_ID=thermosentinel-fog
```

- **Simulator** publishes `{"readings":[...]}` to `MQTT_DATA_TOPIC`.
- **Fog** subscribes to `MQTT_TOPIC_FILTER` and accepts:
  - one reading object,
  - `{ "readings": [ ... ] }`,
  - or a JSON array of readings.

Use a **sensor cert** for the simulator and a **fog cert** for the fog process (two terminals / two `.env` files), or one merged policy that allows both client IDs (see below).

---

## Alternative: hierarchical topics (library / Mosquitto)

```bash
MQTT_TOPIC_MODE=library
MQTT_TOPIC_ROOT=library/sensors
MQTT_TOPIC_FILTER=library/sensors/#
```

---

## Endpoint and TLS

**Settings** → **Device data endpoint**:

```text
mqtts://a1b2c3d4e5f6g7-ats.iot.us-east-1.amazonaws.com:8883
```

---

## Single policy (two client IDs + topics)

If both processes load the **same** certificate:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "iot:Connect",
      "Resource": [
        "arn:aws:iot:REGION:ACCOUNT:client/mock-sensor-001",
        "arn:aws:iot:REGION:ACCOUNT:client/thermosentinel-fog"
      ]
    },
    {
      "Effect": "Allow",
      "Action": "iot:Publish",
      "Resource": "arn:aws:iot:REGION:ACCOUNT:topic/sensors/mock-sensor-001/data"
    },
    {
      "Effect": "Allow",
      "Action": ["iot:Subscribe", "iot:Receive"],
      "Resource": [
        "arn:aws:iot:REGION:ACCOUNT:topicfilter/sensors/#",
        "arn:aws:iot:REGION:ACCOUNT:topic/sensors/*"
      ]
    }
  ]
}
```

---

## Run (local dev)

```bash
npm run dev:iot
```

---

## Diagram

See **`docs/ARCHITECTURE_EDGE_FOG_IOT.md`**.

## More pipeline detail

**`docs/PIPELINE_EDGE_FOG_CLOUD.md`**
