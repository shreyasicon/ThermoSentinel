# MQTT + Mosquitto Flow

This project supports MQTT pub/sub for sensor-to-fog communication, with Mosquitto as broker.

## Topic structure

Sensors publish to:

`library/sensors/<room>/<sensorType>`

Example:

`library/sensors/room-101/temperature`

Fog subscribes to:

`library/sensors/#`

(`#` matches all child topics)

## Data flow

1. Sensor simulator generates readings.
2. In MQTT mode, simulator publishes each reading JSON to the topic above.
3. Fog node subscribes with wildcard, validates incoming readings, and batches them.
4. Fog dispatches envelope(s) to cloud ingest API (`/api/ingest`).
5. Dashboard reads live data from `/api/sensors/[type]/readings`.

## Run with MQTT mode

1) Start Mosquitto broker (default port 1883).

2) Start app:

`npm run dev`

3) Start fog in MQTT mode:

`npm run fog:mqtt`

4) Start simulator in MQTT mode:

`npm run simulator:mqtt`

## Environment variables

- `SENSOR_TRANSPORT` = `http` | `mqtt`
- `MQTT_BROKER_URL` (default `mqtt://localhost:1883`)
- `MQTT_TOPIC_ROOT` (default `library/sensors`)
- `FOG_INPUT_MODE` = `http` | `mqtt` | `both`
- `MQTT_TOPIC_FILTER` (default `library/sensors/#`)
- `MQTT_FLUSH_MS` (default `2000`)
