'use client';

import { RackData } from '@/hooks/useSensorData';
import { formatTemperatureCelsius } from '@/lib/thermoutils';
import SensorCard from './SensorCard';

interface RackMonitorProps {
  rack: RackData;
}

function formatRackMetric(
  value: number | null,
  kind: 'pressure' | 'airflow' | 'smoke',
): string {
  if (value == null) return '—';
  if (kind === 'pressure') return `${value.toFixed(1)} hPa`;
  if (kind === 'airflow') return `${value} cfm`;
  return `${value.toFixed(2)} index`;
}

export default function RackMonitor({ rack }: RackMonitorProps) {
  const criticalCount = rack.sensors.filter((s) => s.status === 'critical').length;
  const warningCount = rack.sensors.filter((s) => s.status === 'warning').length;
  const tempVals = rack.sensors.map((s) => s.temperature).filter((x): x is number => x != null);
  const avgTemp =
    tempVals.length > 0
      ? `${formatTemperatureCelsius(tempVals.reduce((a, b) => a + b, 0) / tempVals.length)}`
      : '—';

  return (
    <div className="border border-white/10 rounded-xl p-6 backdrop-blur-sm hover:border-white/20 transition-colors">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-white mb-2">{rack.name}</h3>
        <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm items-center">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
            <span>Normal</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
            <span>{warningCount} Warning</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            <span>{criticalCount} Critical</span>
          </div>
          <div className="ml-auto font-semibold text-cyan-400 tabular-nums">
            Avg temp: {avgTemp}
            {tempVals.length > 0 ? '°C' : ''}
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm text-white/85 border-t border-white/10 pt-3">
          <div>
            <span className="text-white/55">Pressure</span>{' '}
            <span className="font-semibold text-cyan-400/95 tabular-nums">
              {formatRackMetric(rack.rackPressureHpa, 'pressure')}
            </span>
          </div>
          <div>
            <span className="text-white/55">Airflow</span>{' '}
            <span className="font-semibold text-cyan-400/95 tabular-nums">
              {formatRackMetric(rack.rackAirflowCfm, 'airflow')}
            </span>
          </div>
          <div>
            <span className="text-white/55">Smoke / Fire</span>{' '}
            <span className="font-semibold text-cyan-400/95 tabular-nums">
              {formatRackMetric(rack.rackSmokeIndex, 'smoke')}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
        {rack.sensors.map((sensor) => (
          <SensorCard key={sensor.id} sensor={sensor} />
        ))}
      </div>
    </div>
  );
}
