# Shared payload schema

Single source of truth for sensor and fog→cloud payloads.

- **`types.ts`** – TypeScript types (used by Next.js app, sensor simulator, fog node, backend).
- **`payloads.json`** – JSON Schema for validation and documentation.

## Sensor types

| Type        | Fields (besides sensorId, sensorType, ts, location) |
|------------|------------------------------------------------------|
| temperature | value (number), unit: "celsius"                       |
| humidity    | value (number), unit: "percent"                       |
| pressure    | value (number), unit: "hpa"                           |
| airflow     | value (number), unit: "cfm" (cubic feet per minute)   |
| smoke       | value (number), unit: "index" (0–100, smoke/fire level) |

## Fog envelope

Payload sent from fog node to cloud: `{ fogNodeId, receivedAt, readings: SensorReading[] }`.
