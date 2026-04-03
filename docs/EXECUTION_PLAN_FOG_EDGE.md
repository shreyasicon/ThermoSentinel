# Fog & Edge Cloud Application – Execution Plan

This document outlines the plan to back ThermoSentinel with a full **sensor → fog → cloud** pipeline: configurable sensors, virtual fog node(s), and a scalable cloud backend with dashboards.

---

## 1. High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│  SENSOR LAYER (Edge)                                                             │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐                │
│  │ Temp     │ │ Humidity │ │ Pressure │ │ Motion   │ │ Light    │  (3–5 types)   │
│  │ Sensor   │ │ Sensor   │ │ Sensor   │ │ Sensor   │ │ Sensor   │  configurable  │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘  frequency &   │
│       │            │            │            │            │         dispatch      │
└───────┼────────────┼────────────┼────────────┼────────────┼─────────────────────┘
        └────────────┴────────────┴─────┬──────┴────────────┘
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│  FOG LAYER (Virtual / Coded)                                                     │
│  ┌─────────────────────────────────────────────────────────────────────────┐    │
│  │  Fog Node(s): receive → validate → aggregate/batch → dispatch to cloud   │    │
│  └─────────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│  CLOUD BACKEND                                                                   │
│  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐   ┌─────────────────────┐  │
│  │ API Gateway │ → │ Message     │ → │ Workers /   │ → │ DB + Time-series    │  │
│  │ or REST     │   │ Queue       │   │ FaaS        │   │ (e.g. Cosmos/Influx)│  │
│  └─────────────┘   └─────────────┘   └─────────────┘   └─────────────────────┘  │
│                                                              │                   │
│                                                              ▼                   │
│  ┌─────────────────────────────────────────────────────────────────────────────┐│
│  │  Dashboards (Next.js) – consume API / WebSocket / Server-Sent Events         ││
│  └─────────────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Sensor & Fog Layers

### 2.1 Sensor Types (3–5, configurable)

| # | Type        | Payload example                    | Configurable params              |
|---|-------------|------------------------------------|----------------------------------|
| 1 | Temperature | `{ value, unit, sensorId, ts }`    | frequency (Hz), dispatch interval|
| 2 | Humidity    | `{ value, unit, sensorId, ts }`   | frequency, dispatch interval     |
| 3 | Pressure    | `{ value, unit, sensorId, ts }`   | frequency, dispatch interval     |
| 4 | Motion      | `{ active, count, sensorId, ts }` | frequency, dispatch interval     |
| 5 | Light       | `{ lux, sensorId, ts }`           | frequency, dispatch interval     |

**Implementation options:**

- **Option A – Mock sensors (Node.js/TS service):**  
  Single process that runs 3–5 “sensor” loops (or one loop with multiple types). Each type has:
  - **Sample frequency:** e.g. every 500 ms / 1 s / 2 s.
  - **Dispatch rate:** e.g. send to fog every 2 s / 5 s (batch or single reading).
- **Option B – Real sensors:**  
  Replace mock loops with MQTT/HTTP clients that read from real devices (e.g. Raspberry Pi + sensors, or a cloud IoT hub that already ingests device data). Same config (frequency / dispatch) can be applied at the gateway or in a small “sensor adapter” service.

**Deliverable:** A **sensor simulator / adapter** (e.g. `sensor-simulator` or `edge-simulator`) that:
1. Generates (or forwards) data for 3–5 sensor types.
2. Allows configuration of frequency and dispatch interval per type (env vars or config file).
3. Sends payloads to the fog layer (HTTP POST or message queue, depending on choice below).

### 2.2 Fog Node(s) (virtual, coded)

- **Role:** Receive sensor data → validate → optionally aggregate/filter → send to cloud.
- **Implementation:** A small service (Node.js, Python, or .NET) that:
  1. **Receives** data from sensors (HTTP endpoint and/or pull from a queue).
  2. **Validates** schema and basic ranges (e.g. temperature 0–50 °C).
  3. **Processes:** e.g. compute min/max/avg over a short window, or forward as-is.
  4. **Dispatches** to the cloud backend (HTTP to API, or push to a cloud queue).

**Deployment:** Run as a container (e.g. Docker) or as a single process. For “virtual” fog, no real edge hardware is required; it can run on the same machine as the simulator or in a separate container/VM.

**Deliverable:** A **fog-node** service with:
- Configurable input (port, queue URL if used).
- Configurable output (cloud API URL or queue connection).
- Clear logging of receive → process → dispatch.

---

## 3. Backend Layer (Scalable Web Service)

### 3.1 Processing pipeline

1. **Ingestion:** Fog sends payloads to the cloud (REST API or message queue).
2. **Queue (recommended):** Use a managed queue (e.g. Azure Service Bus, AWS SQS, or RabbitMQ in cloud) so that:
   - Bursts from many fog nodes don’t overwhelm the API.
   - Processing can be scaled independently (workers/FaaS).
3. **Workers / FaaS:**  
   - **Workers:** Long-running processes that pull from the queue, validate, transform, and write to DB.  
   - **FaaS:** Each message triggers a function (e.g. Azure Functions, AWS Lambda) that does the same. FaaS gives autoscaling by design.
4. **Storage:**  
   - Time-series or document DB for sensor readings (e.g. Azure Cosmos DB, InfluxDB, or AWS Timestream).  
   - Optionally a relational DB for metadata (sensors, fog nodes, config).

### 3.2 Responsive dashboards

- **ThermoSentinel (Next.js)** already provides the dashboard UI.
- **Data source:** Switch from client-side mock to:
  - **REST API:** e.g. `GET /api/sensors/:type/readings?from=&to=&limit=`.
  - **Real-time (optional):** WebSockets or Server-Sent Events (SSE) for live updates.
- **Per–sensor-type views:** Reuse or add panels for each of the 3–5 sensor types (temperature, humidity, pressure, airflow, smoke), with charts and configurable time ranges.

### 3.3 Scalability

- **Queues:** Decouple ingestion from processing; absorb traffic spikes.
- **FaaS or autoscaled workers:** Scale with queue depth (e.g. Azure Functions with queue trigger, or Kubernetes HPA for workers).
- **Database:** Choose a store that scales (managed Cosmos, Timestream, etc.) and index by `sensorType`, `sensorId`, `timestamp`.

---

## 4. Deployment (Public Cloud)

### 4.1 Azure

- **Ingestion:** Azure Functions (HTTP trigger) or API Management → put message in **Azure Service Bus** (or Event Hubs for very high throughput).
- **Processing:** Azure Functions with **Service Bus trigger** (or Event Hubs trigger), write to **Cosmos DB** (or Azure Table Storage for simpler key-value).
- **Dashboard:** Next.js on **Azure Static Web Apps** or **App Service**; call Azure-hosted APIs.
- **Fog / sensors:** Run in **Container Apps** or **App Service** (or locally for dev).

### 4.2 AWS

- **Ingestion:** **API Gateway** + **Lambda** (or **SQS** direct from fog) → **SQS** queue.
- **Processing:** **Lambda** triggered by SQS, write to **DynamoDB** or **Timestream**.
- **Dashboard:** Next.js on **Amplify** or **ECS/Fargate**; call API Gateway or Lambda URLs.
- **Fog / sensors:** **ECS Fargate** or **EC2** (or local for dev).

### 4.3 Minimal path (single cloud)

- Use **one** cloud (e.g. Azure) and deploy:
  - Sensor simulator + fog node (container or VM).
  - Backend: Function App (HTTP + Queue-triggered) + Service Bus + Cosmos DB.
  - Next.js dashboard on Static Web Apps or App Service, reading from the same backend API.

---

## 5. Recommended Execution Order

| Phase | Task | Outcome |
|-------|------|--------|
| **1** | Define shared **payload schema** (JSON) for all sensor types and fog→cloud payload. | Single source of truth for types and fields. |
| **2** | Implement **sensor simulator**: 3–5 types, configurable frequency and dispatch; send to fog (HTTP or queue). | Edge layer done (mock). |
| **3** | Implement **fog-node** service: receive, validate, process, dispatch to cloud API or queue. | Fog layer done. |
| **4** | Implement **cloud backend**: REST endpoint (or queue listener) → queue → worker/FaaS → DB. | Scalable ingestion + storage. |
| **5** | Add **REST API** for dashboards (per sensor type, time range, aggregation). | Backend ready for UI. |
| **6** | Wire **Next.js dashboard** to backend API (and optional real-time). Add/adapt views for each sensor type. | Responsive dashboards. |
| **7** | Deploy to **one public cloud** (Azure or AWS): fog + backend + dashboard; run basic tests. | Deployed and tested. |

---

## 6. Tech Stack Suggestions (Concise)

- **Sensors + Fog:** Node.js or Python; config via env or YAML.
- **Cloud backend:**  
  - **Azure:** Functions (Node/Python/C#) + Service Bus + Cosmos DB.  
  - **AWS:** Lambda + SQS + DynamoDB or Timestream.
- **Dashboard:** Existing Next.js app; add API client and per–sensor-type dashboards.
- **IaC (optional):** Bicep (Azure) or Terraform for repeatable deployment.

---

## 7. Summary

- **Sensors:** 3–5 types (temperature, humidity, pressure, airflow, smoke), configurable frequency and dispatch; implemented as mock simulator or adapter to real devices.
- **Fog:** Virtual node(s) that receive, validate, process, and forward to the cloud (HTTP or queue).
- **Backend:** Queue-based ingestion, FaaS or autoscaled workers, time-series/document DB, REST API for dashboards.
- **Dashboards:** ThermoSentinel consumes backend API (and optional real-time) with views per sensor type.
- **Deploy:** One public cloud (e.g. Azure or AWS), with all components deployed and a short test report.

Following the phases in **Section 5** gives a clear, step-by-step path from your current Next.js app to a full Fog & Edge–aligned, scalable cloud solution.

---

## 8. Progress log

| Phase | Task | Status |
|-------|------|--------|
| **1** | Define shared payload schema (JSON + TypeScript) | ✅ Done – `shared/schema/` |
| **2** | Sensor simulator (3–5 types, configurable) | ✅ Done – `services/sensor-simulator/` |
| **3** | Fog-node service | ✅ Done – `services/fog-node/` |
| **4** | Cloud backend (ingest API + in-memory store) | ✅ Done – `app/api/ingest`, `lib/sensor-store` |
| **5** | REST API for dashboards | ✅ Done – `app/api/sensors/[type]/readings` |
| **6** | Wire Next.js dashboard to backend | ✅ Done – `BackendSensorPanel`, `useBackendSensorReadings` |
| **7** | Deploy and test on public cloud | 🔲 Pending |

### How to run the pipeline locally

1. **Start the cloud backend (Next.js):**  
   `pnpm dev` — serves the app and `POST /api/ingest`, `GET /api/sensors/:type/readings`.

2. **Start the fog node:**  
   `pnpm run fog` — listens on port 4000, forwards to `http://localhost:3000/api/ingest`.

3. **Start the sensor simulator:**  
   `pnpm run simulator` — sends readings to `http://localhost:4000/ingest`.

4. Open the dashboard at `http://localhost:3000`; the “Backend sensor data (fog → cloud)” panel will show live readings from the pipeline.
