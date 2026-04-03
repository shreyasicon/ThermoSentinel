'use client';

import { PieChart, Pie, Cell, Legend, Tooltip, ResponsiveContainer } from 'recharts';
import { SystemMetrics } from '@/hooks/useSensorData';

interface StatusDistributionProps {
  metrics: SystemMetrics;
  totalSensors?: number;
}

export default function StatusDistribution({ metrics, totalSensors = 15 }: StatusDistributionProps) {
  const normalCount = totalSensors - metrics.activeAlerts;
  const data = [
    { name: 'Normal', value: normalCount, color: '#10b981' },
    { name: 'Alert', value: metrics.activeAlerts, color: '#f59e0b' },
  ];

  const healthPercentage = ((normalCount / totalSensors) * 100).toFixed(0);

  return (
    <div className="border border-white/10 rounded-2xl p-8 backdrop-blur-sm">
      <h3 className="text-xl font-bold text-white mb-6">Server Status Distribution</h3>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Pie Chart */}
        <div className="lg:col-span-2">
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={80}
                outerRadius={120}
                paddingAngle={2}
                dataKey="value"
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', border: '1px solid rgba(255, 255, 255, 0.2)' }}
                labelStyle={{ color: '#fff' }}
              />
              <Legend wrapperStyle={{ color: 'rgba(255, 255, 255, 0.8)' }} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Statistics */}
        <div className="space-y-4">
          <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
            <p className="text-sm text-white/60 mb-1">Normal Servers</p>
            <p className="text-3xl font-bold text-green-400">{normalCount}</p>
            <p className="text-xs text-white/40 mt-2">{healthPercentage}% healthy</p>
          </div>

          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
            <p className="text-sm text-white/60 mb-1">Servers with Issues</p>
            <p className="text-3xl font-bold text-yellow-400">{metrics.activeAlerts}</p>
            <p className="text-xs text-white/40 mt-2">Requires attention</p>
          </div>

          <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
            <p className="text-sm text-white/60 mb-1">Total Servers</p>
            <p className="text-3xl font-bold text-blue-400">{totalSensors}</p>
            <p className="text-xs text-white/40 mt-2">Actively monitored</p>
          </div>
        </div>
      </div>
    </div>
  );
}
