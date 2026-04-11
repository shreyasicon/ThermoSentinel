'use client';

import { Sensor } from '@/hooks/useSensorData';
import { formatTemperatureCelsius, getStatusBadgeClass, getTemperatureGauge } from '@/lib/thermoutils';

interface SensorCardProps {
  sensor: Sensor;
}

export default function SensorCard({ sensor }: SensorCardProps) {
  const t = sensor.temperature;
  const { percentage, color } = getTemperatureGauge(t ?? 20);

  return (
    <div className={`border rounded-lg p-4 backdrop-blur-sm ${getStatusBadgeClass(sensor.status)}`}>
      <div className="flex justify-between items-start mb-3">
        <div>
          <h4 className="text-sm font-semibold">{sensor.name}</h4>
          <p className="text-xs opacity-70 mt-1">{sensor.location}</p>
        </div>
        <span
          className={`px-2 py-1 rounded text-xs font-medium capitalize ${
            sensor.status === 'critical'
              ? 'bg-red-500/30'
              : sensor.status === 'warning'
                ? 'bg-yellow-500/30'
                : 'bg-green-500/30'
          }`}
        >
          {sensor.status}
        </span>
      </div>

      <div className="space-y-3">
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span>Temperature</span>
            <span className="font-semibold">
              {t == null ? '—' : `${formatTemperatureCelsius(t)}°C`}
            </span>
          </div>
          <div className="w-full h-2 bg-black/40 rounded-full overflow-hidden">
            {t != null && (
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{ width: `${percentage}%`, backgroundColor: color }}
              />
            )}
          </div>
        </div>

        <div>
          <div className="flex justify-between text-sm mb-1">
            <span>Humidity</span>
            <span className="font-semibold">{sensor.humidity.toFixed(1)}%</span>
          </div>
          <div className="w-full h-2 bg-black/40 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{ width: `${sensor.humidity}%`, backgroundColor: '#06b6d4' }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
