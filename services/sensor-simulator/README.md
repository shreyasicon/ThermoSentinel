# Sensor simulator

Generates mock data for 3–5 sensor types and sends batches to the fog node.

## Config (env)

| Env | Default | Description |
|-----|---------|--------------|
| `FOG_URL` | `http://localhost:4000/ingest` | Fog node ingest endpoint |
| `ENABLED_SENSOR_TYPES` | (all) | Comma-separated: `temperature,humidity,pressure,airflow,smoke` |
| `TEMPERATURE_SAMPLE_MS` | 1000 | Sample interval (ms) |
| `TEMPERATURE_DISPATCH_MS` | 3000 | Dispatch interval (ms) |
| `TEMPERATURE_COUNT` | 3 | Number of virtual sensors |
| (Same for `HUMIDITY_*`, `PRESSURE_*`, `AIRFLOW_*`, `SMOKE_*`) | | |

## Run

From repo root (recommended):

```bash
pnpm run simulator
```

Or from this folder:

```bash
npx tsx index.ts
```

Ensure the fog node is running on `FOG_URL` so POST requests succeed.
