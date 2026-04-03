'use client';

import { SystemMetrics } from '@/hooks/useSensorData';
import { formatTemperatureCelsius, getRiskColor, calculateSystemHealth } from '@/lib/thermoutils';

interface SystemMetricsDisplayProps {
  metrics: SystemMetrics;
}

export default function SystemMetricsDisplay({ metrics }: SystemMetricsDisplayProps) {
  const health = calculateSystemHealth(metrics.systemRiskScore);
  const healthColor =
    metrics.systemRiskScore >= 70
      ? 'text-red-400'
      : metrics.systemRiskScore >= 40
        ? 'text-yellow-400'
        : 'text-green-400';

  const cardBase =
    'border border-white/10 rounded-lg p-4 backdrop-blur-sm flex flex-col h-full min-h-[140px]';

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 items-stretch">
      <div className={cardBase}>
        <p className="text-sm text-white/60 mb-2">Average Temperature</p>
        <p className="text-3xl font-bold text-cyan-400 mt-auto">{formatTemperatureCelsius(metrics.avgTemperature)}°C</p>
      </div>

      <div className={cardBase}>
        <p className="text-sm text-white/60 mb-2">Peak Temperature</p>
        <p className="text-3xl font-bold text-orange-400 mt-auto">{formatTemperatureCelsius(metrics.maxTemperature)}°C</p>
      </div>

      <div className={cardBase}>
        <p className="text-sm text-white/60 mb-2">Active Alerts</p>
        <p className="text-3xl font-bold text-red-400 mt-auto">{metrics.activeAlerts}</p>
      </div>

      <div className={`border rounded-lg p-4 backdrop-blur-sm flex flex-col h-full min-h-[140px] ${getRiskColor(metrics.systemRiskScore)}`}>
        <p className="text-sm mb-2">System Health</p>
        <div className="flex flex-1 items-end justify-between gap-2 min-h-0 mt-auto">
          <div>
            <p className={`text-3xl font-bold ${healthColor}`}>{health}</p>
            <p className="text-xs mt-1">Risk: {metrics.systemRiskScore}%</p>
          </div>
          <div className="relative w-12 h-12 shrink-0">
            <svg className="transform -rotate-90" viewBox="0 0 100 100">
              <circle
                cx="50"
                cy="50"
                r="45"
                stroke="currentColor"
                strokeWidth="8"
                fill="none"
                opacity="0.2"
              />
              <circle
                cx="50"
                cy="50"
                r="45"
                stroke="currentColor"
                strokeWidth="8"
                fill="none"
                strokeDasharray={`${2.827 * metrics.systemRiskScore} 282.7`}
              />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}
