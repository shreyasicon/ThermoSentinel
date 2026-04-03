'use client';

import { useMemo } from 'react';
import { useSensorTrendReadings } from '@/hooks/useSensorTrendReadings';
import { aggregatePointsPerMinute } from '@/lib/chart-aggregate';
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

export default function TemperatureTrends() {
  const { data: raw, hasData } = useSensorTrendReadings('temperature', {
    limit: 120,
    pollIntervalMs: 30_000,
  });
  const data = useMemo(() => aggregatePointsPerMinute(raw), [raw]);

  return (
    <div className="border border-white/10 rounded-2xl p-8 backdrop-blur-sm mt-8">
      <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-2 mb-6">
        <h3 className="text-xl font-bold text-white">Temperature Trend (from fog pipeline)</h3>
        <span className="text-xs text-white/45 tabular-nums">Updates every 30s</span>
      </div>
      {!hasData && (
        <p className="text-sm text-amber-400/90 mb-4">
          No temperature data yet. Run the sensor simulator and fog node, or configure ingest to see live data.
        </p>
      )}
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.1)" />
          <XAxis
            stroke="rgba(255, 255, 255, 0.5)"
            dataKey="time"
            minTickGap={28}
            interval="preserveStartEnd"
          />
          <YAxis stroke="rgba(255, 255, 255, 0.5)" domain={[18, 32]} />
          <Tooltip
            contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', border: '1px solid rgba(255, 255, 255, 0.2)' }}
            labelStyle={{ color: '#fff' }}
            formatter={(value: number) => [`${value.toFixed(1)}°C`, 'Temperature']}
          />
          <Legend wrapperStyle={{ color: 'rgba(255, 255, 255, 0.8)' }} />
          <Line
            type="monotone"
            dataKey="value"
            stroke="#06b6d4"
            dot={{ fill: '#06b6d4', r: 4 }}
            activeDot={{ r: 6 }}
            isAnimationActive={true}
            strokeWidth={2}
            name="Temperature"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
