/**
 * Fog HTTP listen port. Use `FOG_PORT` only — a shared `.env` often sets `PORT=3000` for Next.js,
 * which previously made the fog node bind to 3000, fail with EADDRINUSE, or never expose :4000.
 */
const PORT = Number(process.env.FOG_PORT) || 4000;
const CLOUD_PORT = process.env.CLOUD_PORT || '3000';
const CLOUD_URL =
  process.env.CLOUD_URL || `http://localhost:${CLOUD_PORT}/api/ingest`;
const FOG_NODE_ID = process.env.FOG_NODE_ID || 'fog-node-1';
/** Default `http` matches `npm run fog` (MQTT: `npm run fog:mqtt` or set `FOG_INPUT_MODE`). */
const FOG_INPUT_MODE = (process.env.FOG_INPUT_MODE || 'http').toLowerCase(); // mqtt | http | both

/** Inbound MQTT — use AWS IoT Core (mqtts://…iot….amazonaws.com:8883). Set in .env; no default. */
const MQTT_BROKER_URL = (process.env.MQTT_BROKER_URL || '').trim();
/** Default matches IoT lab topics (override e.g. library/sensors/# for hierarchical local broker). */
const MQTT_TOPIC_FILTER = process.env.MQTT_TOPIC_FILTER || 'sensors/#';
const MQTT_FLUSH_MS = Number(process.env.MQTT_FLUSH_MS || '2000');

/** Optional: mirror envelopes to a second broker/topic (e.g. IoT Rule → Lambda). */
const FOG_MQTT_PUBLISH = (process.env.FOG_MQTT_PUBLISH || 'false').toLowerCase() === 'true';
const MQTT_PUBLISH_BROKER_URL = process.env.MQTT_PUBLISH_BROKER_URL || MQTT_BROKER_URL;
const MQTT_TO_CLOUD_TOPIC =
  process.env.MQTT_TO_CLOUD_TOPIC || 'fog/out/envelopes';

/** Optional AWS SQS — same JSON body as HTTP ingest (Lambda consumes queue). */
const FOG_SQS_QUEUE_URL = (process.env.FOG_SQS_QUEUE_URL || '').trim();

/** CORS for browser calling fog directly (dashboard uses Next proxy by default). */
const FOG_CORS_ORIGIN = process.env.FOG_CORS_ORIGIN || 'http://localhost:3000';

export {
  PORT,
  CLOUD_URL,
  FOG_NODE_ID,
  FOG_INPUT_MODE,
  MQTT_BROKER_URL,
  MQTT_TOPIC_FILTER,
  MQTT_FLUSH_MS,
  FOG_MQTT_PUBLISH,
  MQTT_PUBLISH_BROKER_URL,
  MQTT_TO_CLOUD_TOPIC,
  FOG_SQS_QUEUE_URL,
  FOG_CORS_ORIGIN,
};
