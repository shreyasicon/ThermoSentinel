'use client';

import { useState, useEffect } from 'react';
import { AlertCircle, AlertTriangle, CheckCircle } from 'lucide-react';

interface Alert {
  id: string;
  type: 'critical' | 'warning' | 'info';
  message: string;
  timestamp: Date;
}

/** Format time for display. Only use after mount to avoid server/client mismatch. */
function AlertTime({ date }: { date: Date }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <span className="text-xs opacity-70 mt-1 inline-block w-20 h-4 animate-pulse bg-white/10 rounded" />;
  return (
    <p className="text-xs opacity-70 mt-1 tabular-nums">
      {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
    </p>
  );
}

export default function AlertSystem() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setAlerts([
      {
        id: '1',
        type: 'info',
        message: 'System initialized - ThermoSentinel monitoring started',
        timestamp: new Date(Date.now() - 5 * 60000),
      },
    ]);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const interval = setInterval(() => {
      const alertTypes = ['info', 'warning'] as const;
      const messages = [
        'Fog layer aggregated data from edge sensors',
        'Cloud sync completed successfully',
        'Humidity levels within optimal range',
        'Edge node 2 synchronized',
        'Archive operation completed',
      ];

      setAlerts((prev) => [
        {
          id: Date.now().toString(),
          type: alertTypes[Math.floor(Math.random() * alertTypes.length)],
          message: messages[Math.floor(Math.random() * messages.length)],
          timestamp: new Date(),
        },
        ...prev.slice(0, 9),
      ]);
    }, 20000);
    return () => clearInterval(interval);
  }, [mounted]);

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'critical':
        return <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-yellow-400 shrink-0" />;
      default:
        return <CheckCircle className="w-4 h-4 text-green-400 shrink-0" />;
    }
  };

  const getAlertClass = (type: string) => {
    switch (type) {
      case 'critical':
        return 'bg-red-500/10 border-red-500/30 text-red-200';
      case 'warning':
        return 'bg-yellow-500/10 border-yellow-500/30 text-yellow-200';
      default:
        return 'bg-green-500/10 border-green-500/30 text-green-200';
    }
  };

  return (
    <div className="border border-white/10 rounded-2xl p-8 backdrop-blur-sm mt-8">
      <h3 className="text-xl font-bold text-white mb-4">System Alerts & Events</h3>

      <div className="space-y-2 max-h-96 overflow-y-auto pr-1 scrollbar-thin scrollbar-track-white/5 scrollbar-thumb-white/20">
        {alerts.length === 0 ? (
          <div className="py-8 text-center text-white/50 text-sm">
            Loading alerts…
          </div>
        ) : (
          alerts.map((alert) => (
            <div
              key={alert.id}
              className={`flex items-start gap-3 p-3 rounded-lg border ${getAlertClass(alert.type)}`}
            >
              <div className="mt-0.5 shrink-0">{getAlertIcon(alert.type)}</div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium break-words">{alert.message}</p>
                <AlertTime date={alert.timestamp} />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
