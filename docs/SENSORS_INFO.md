# Sensor Information for ThermoSentinel

This document lists real-world sensor/device names relevant to the sensors used in this project and a recommended fog-layer device.

## Sensors used in this application

### Temperature sensors (2-3 examples)

- Sensirion SHT35
- Texas Instruments TMP117
- Maxim/Analog Devices DS18B20

### Humidity sensors (2-3 examples)

- Sensirion SHT35
- Honeywell HIH-6130 (HIH-6000 family)
- TE Connectivity HTU31D

### Pressure sensors (differential/static air pressure)

- Sensirion SDP31 / SDP810
- Honeywell TruStability HSC/SSC series
- Amphenol NovaSensor NPA series

### Airflow sensors

- Sensirion SFM3000 / SFM3300
- Honeywell Zephyr HAF series
- Omron D6F-PH series

### Smoke/Fire detection sensors

- Honeywell VESDA-E VEP (aspirating smoke detection)
- Siemens FDA241 / FDAI92 family
- Notifier FAAST series

## Recommended fog-layer device

For this project, the most relevant single device for the fog layer is:

- Advantech UNO-1372G (Industrial IoT Edge Gateway PC)

Why this fits as fog layer:

- Designed as an industrial edge/fog gateway.
- Can aggregate data from multiple sensor types (temperature, humidity, pressure, airflow, smoke/fire) via serial/field/IP interfaces.
- Supports local processing (buffering, filtering, alerting, protocol translation) before cloud forwarding.
- Rugged and production-oriented for infrastructure environments.

## Important note

A fog layer is usually a gateway/edge computer, not a single sensor. The right "one unit" is an edge gateway that ingests data from many sensors and forwards processed data to the cloud.
