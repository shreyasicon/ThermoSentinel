'use client';

import { RackData } from '@/hooks/useSensorData';
import SensorCard from './SensorCard';

interface RackMonitorProps {
  rack: RackData;
}

export default function RackMonitor({ rack }: RackMonitorProps) {
  const criticalCount = rack.sensors.filter((s) => s.status === 'critical').length;
  const warningCount = rack.sensors.filter((s) => s.status === 'warning').length;
  const avgTemp = (rack.sensors.reduce((sum, s) => sum + s.temperature, 0) / rack.sensors.length).toFixed(1);

  return (
    <div className="border border-white/10 rounded-xl p-6 backdrop-blur-sm hover:border-white/20 transition-colors">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-white mb-2">{rack.name}</h3>
        <div className="flex gap-4 text-sm">
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
          <div className="ml-auto font-semibold text-cyan-400">Avg: {avgTemp}°C</div>
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
