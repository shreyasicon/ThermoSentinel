'use client';

import { useBackendSensorReadings } from '@/hooks/useBackendSensorReadings';
import type { SensorType } from '@/shared/schema/types';

const SENSOR_LABELS: Record<SensorType, string> = {
  temperature: 'Temperature',
  humidity: 'Humidity',
  pressure: 'Pressure',
  airflow: 'Airflow',
  smoke: 'Smoke / Fire',
};

type BackendReading = {
  sensorId: string;
  sensorType: string;
  ts: string;
  value?: number;
  unit?: string;
  location?: string;
};

function formatReading(r: BackendReading): string {
  if ('value' in r && r.value !== undefined) return `${r.value} ${r.unit ?? ''}`.trim();
  return '—';
}

/** One dashboard row per sensor type with main metric (avg/peak) highlighted. */
function SensorTypeRow({ type }: { type: SensorType }) {
  const { readings, loading, error, isDemo } = useBackendSensorReadings(type, 30);

  const latest = readings[0];
  const bySensor = new Map<string, BackendReading>();
  readings.forEach((r) => {
    if (!bySensor.has(r.sensorId)) bySensor.set(r.sensorId, r);
  });
  const sensorEntries = [...bySensor.entries()];

  const numericValues = readings
    .map((r) => ('value' in r ? r.value : undefined))
    .filter((v): v is number => typeof v === 'number');
  const avg = numericValues.length ? numericValues.reduce((a, b) => a + b, 0) / numericValues.length : null;
  const peak = numericValues.length ? Math.max(...numericValues) : null;
  const unit = type === 'temperature' ? '°C' : type === 'humidity' ? '%' : type === 'pressure' ? ' hPa' : type === 'airflow' ? ' cfm' : type === 'smoke' ? ' index' : '';

  const mainFeature =
    avg != null && peak != null ? (
      <span className="text-cyan-400 font-semibold tabular-nums">
        Avg {avg.toFixed(1)}{unit} · Peak {peak.toFixed(1)}{unit}
      </span>
    ) : null;

  return (
    <div className="grid grid-cols-1 gap-1 py-3 border-b border-white/10 last:border-0 md:grid-cols-[140px_1fr_auto] md:gap-4 md:items-center">
      <div className="font-semibold text-white/90">{SENSOR_LABELS[type]}</div>
      <div className="min-w-0 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        {loading && <span className="text-white/50">Loading…</span>}
        {error && <span className="text-red-400">{error}</span>}
        {!loading && !error && readings.length === 0 && (
          <span className="text-amber-400/90">No readings yet</span>
        )}
        {!loading && !error && readings.length > 0 && (
          <>
            {isDemo && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs">
                Demo stream
              </span>
            )}
            {mainFeature && (
              <span className="inline-flex items-center gap-2 px-2 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/20">
                {mainFeature}
              </span>
            )}
            <span className="text-white/70">
              Latest: {latest ? formatReading(latest) : '—'}
            </span>
            {sensorEntries.length > 0 && (
              <span className="text-white/50 text-xs">
                {sensorEntries.map(([id, r]) => (
                  <span key={id} className="mr-3 inline">
                    {id}: <span className="tabular-nums text-white/70">{formatReading(r)}</span>
                  </span>
                ))}
              </span>
            )}
          </>
        )}
      </div>
      <div className="text-xs text-white/50 tabular-nums md:text-right">
        {readings.length} reading{readings.length !== 1 ? 's' : ''}
      </div>
    </div>
  );
}

export default function BackendSensorPanel() {
  const types: SensorType[] = ['temperature', 'humidity', 'pressure', 'airflow', 'smoke'];

  return (
    <div className="rounded-xl border border-white/10 p-6 backdrop-blur-sm">
      <h3 className="mb-2 text-xl font-bold text-white">Backend sensor data (fog → cloud)</h3>
      <p className="mb-4 text-sm text-white/60">
        One line per sensor type with main metric highlighted.
      </p>

      <div className="rounded-lg border border-white/10 bg-white/5 overflow-hidden">
        {types.map((type) => (
          <SensorTypeRow key={type} type={type} />
        ))}
      </div>
    </div>
  );
}
