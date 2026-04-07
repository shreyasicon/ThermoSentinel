# Fog node

Receives sensor data from the sensor simulator, validates and processes it, then dispatches to the cloud backend.

## Env

| Env | Default | Description |
|-----|---------|--------------|
| `FOG_PORT` | 4000 | HTTP server port (not `PORT` — Next.js often sets `PORT=3000` in `.env`) |
| `CLOUD_URL` | `http://localhost:3000/api/ingest` | Cloud backend ingest endpoint |
| `FOG_NODE_ID` | fog-node-1 | Node identifier |

## Endpoints

- `GET /` or `GET /health` – health check
- `POST /ingest` – body: `{ readings: SensorReading[] }` (from sensor simulator)

## Run

From repo root:

```bash
pnpm run fog
```

Or: `npx tsx services/fog-node/index.ts`

Ensure the cloud backend (Next.js or separate API) is running on `CLOUD_URL`.
