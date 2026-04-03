const PORT = Number(process.env.PORT) || 4000;
const CLOUD_PORT = process.env.CLOUD_PORT || '3000';
const CLOUD_URL =
  process.env.CLOUD_URL || `http://localhost:${CLOUD_PORT}/api/ingest`;
const FOG_NODE_ID = process.env.FOG_NODE_ID || 'fog-node-1';
const FOG_INPUT_MODE = (process.env.FOG_INPUT_MODE || 'mqtt').toLowerCase(); // mqtt (default) | http | both
const MQTT_BROKER_URL = process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883';
const MQTT_TOPIC_FILTER = process.env.MQTT_TOPIC_FILTER || 'library/sensors/#';
const MQTT_FLUSH_MS = Number(process.env.MQTT_FLUSH_MS || '2000');

export {
  PORT,
  CLOUD_URL,
  FOG_NODE_ID,
  FOG_INPUT_MODE,
  MQTT_BROKER_URL,
  MQTT_TOPIC_FILTER,
  MQTT_FLUSH_MS,
};
