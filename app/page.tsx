'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useSensorData } from '@/hooks/useSensorData';
import SystemMetricsDisplay from '@/components/SystemMetrics';
import RackMonitor from '@/components/RackMonitor';
import TemperatureTrends from '@/components/TemperatureTrends';
import BackendSensorPanel from '@/components/BackendSensorPanel';
import BackendAveragesCards from '@/components/BackendAveragesCards';
import AwsArchitectureSection from '@/components/AwsArchitectureSection';
import ApiBackendToggle from '@/components/ApiBackendToggle';
import { AlertCircle } from 'lucide-react';

export type SimulationKey = 'ac' | 'humidity' | 'pressure' | 'airflow' | 'smoke';

const SIMULATION_CONFIG: Record<
  SimulationKey,
  { label: string; activeLabel: string; restoreLabel: string; bannerTitle: string; bannerMessage: string }
> = {
  ac: {
    label: 'AC Failure',
    activeLabel: 'AC Failure Active',
    restoreLabel: 'Restore AC',
    bannerTitle: 'AC System Failure Detected',
    bannerMessage: 'Temperature is rising rapidly. Immediate action required to prevent hardware damage.',
  },
  humidity: {
    label: 'Humidity Spike',
    activeLabel: 'Humidity Anomaly',
    restoreLabel: 'Restore Humidity',
    bannerTitle: 'Humidity Anomaly Detected',
    bannerMessage: 'High humidity levels detected. Risk of condensation and equipment corrosion.',
  },
  pressure: {
    label: 'Pressure Drop',
    activeLabel: 'Pressure Anomaly',
    restoreLabel: 'Restore Pressure',
    bannerTitle: 'Data Center Pressure Drop',
    bannerMessage: 'Differential pressure outside normal range. Check HVAC and containment integrity.',
  },
  airflow: {
    label: 'Airflow Loss',
    activeLabel: 'Airflow Anomaly',
    restoreLabel: 'Restore Airflow',
    bannerTitle: 'Cooling Airflow Compromised',
    bannerMessage: 'Airflow below threshold. Hot spots and equipment overheating possible.',
  },
  smoke: {
    label: 'Smoke / Fire',
    activeLabel: 'Smoke Detected',
    restoreLabel: 'Clear Smoke Alert',
    bannerTitle: 'Smoke / Fire Detected',
    bannerMessage: 'Smoke or fire sensors triggered. Evacuate if needed and initiate fire response.',
  },
};

export default function Dashboard() {
  const [simulations, setSimulations] = useState<Record<SimulationKey, boolean>>({
    ac: false,
    humidity: false,
    pressure: false,
    airflow: false,
    smoke: false,
  });
  const toggleSimulation = (key: SimulationKey) => {
    setSimulations((prev) => ({ ...prev, [key]: !prev[key] }));
  };
  const activeSimulations = (Object.entries(simulations) as [SimulationKey, boolean][]).filter(
    ([, v]) => v
  );
  const { racks, metrics, hasData, hasTemperatureReadings } = useSensorData();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-white/10 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white">ThermoSentinel</h1>
              <p className="text-sm text-white/60 mt-1">Real-time Cloud Monitoring System</p>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-3 sm:gap-4">
              <ApiBackendToggle />
              <Link
                href="/analytics"
                className="px-4 py-2 rounded-lg border border-white/20 hover:border-white/40 text-white/80 hover:text-white transition-colors text-sm font-medium"
              >
                Analytics
              </Link>
              <Link
                href="/architecture"
                className="px-4 py-2 rounded-lg border border-white/20 hover:border-white/40 text-white/80 hover:text-white transition-colors text-sm font-medium"
              >
                Architecture
              </Link>
              <div className="text-right">
                <div className="text-sm font-semibold text-cyan-400">
                  {activeSimulations.length === 0
                    ? '🟢 System Normal'
                    : `🔴 ${activeSimulations.length} scenario(s): ${activeSimulations.map(([k]) => SIMULATION_CONFIG[k].activeLabel).join(', ')}`}
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Alert Banners for active simulations */}
        {(Object.entries(SIMULATION_CONFIG) as [SimulationKey, typeof SIMULATION_CONFIG[SimulationKey]][])
          .filter(([key]) => simulations[key])
          .map(([key, config]) => (
            <div
              key={key}
              className="mb-4 p-4 rounded-lg bg-red-900/20 border border-red-500/50 flex items-start gap-3"
            >
              <AlertCircle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <h3 className="font-semibold text-red-200">{config.bannerTitle}</h3>
                <p className="text-sm text-red-200/70 mt-1">{config.bannerMessage}</p>
              </div>
              <button
                type="button"
                onClick={() => toggleSimulation(key)}
                className="px-3 py-1.5 rounded-lg bg-red-600/80 hover:bg-red-600 text-white text-sm font-medium shrink-0"
              >
                {config.restoreLabel}
              </button>
            </div>
          ))}

        {/* Backend averages (pressure, humidity, airflow, smoke) */}
        <BackendAveragesCards />

        {/* Metrics Dashboard */}
        <SystemMetricsDisplay metrics={metrics} hasLiveData={hasTemperatureReadings} />

        {/* Racks Monitoring — live from fog pipeline */}
        <div className="space-y-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:justify-between sm:items-center">
            <h2 className="text-2xl font-bold text-white">Server Racks</h2>
            {hasData && (
              <div className="flex flex-wrap gap-2">
                {(Object.keys(SIMULATION_CONFIG) as SimulationKey[]).map((key) => {
                  const cfg = SIMULATION_CONFIG[key];
                  const isActive = simulations[key];
                  return (
                    <button
                      key={key}
                      onClick={() => toggleSimulation(key)}
                      className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        isActive
                          ? 'bg-red-600 hover:bg-red-700 text-white'
                          : 'bg-white/10 hover:bg-white/20 text-white border border-white/20'
                      }`}
                    >
                      {isActive ? cfg.restoreLabel : `Simulate ${cfg.label}`}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          {!hasData ? (
            <div className="rounded-xl border border-white/10 bg-white/5 p-8 text-center">
              <p className="text-white/80 mb-2">No live sensor data yet</p>
              <p className="text-sm text-white/50">
                Data appears when the fog pipeline is sending temperature and humidity to the cloud. Run the sensor simulator and fog node, or point your edge ingest at this app.
              </p>
            </div>
          ) : (
            racks.map((rack) => (
              <RackMonitor key={rack.id} rack={rack} />
            ))
          )}
        </div>

        {/* Temperature Trends */}
        <TemperatureTrends />

        {/* Backend pipeline: sensor → fog → cloud */}
        <BackendSensorPanel />

        {/* System Information */}
        <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
          <div className="border border-white/10 rounded-xl p-6 backdrop-blur-sm flex flex-col h-full">
            <h3 className="font-semibold text-white mb-4">About ThermoSentinel</h3>
            <p className="text-sm text-white/70 leading-relaxed flex-1">
              ThermoSentinel is a cloud datacenter monitoring system built on edge fog cloud
              architecture principles. The system continuously monitors server racks across distributed
              sensors, calculates dynamic risk scores and provides real time alerts.
            </p>
          </div>

          <div className="border border-white/10 rounded-xl p-6 backdrop-blur-sm flex flex-col h-full">
            <h3 className="font-semibold text-white mb-4">Interactive Features</h3>
            <ul className="text-sm text-white/70 space-y-2 flex-1">
              <li className="flex items-center gap-2">
                <span className="text-cyan-400">✓</span>
                <span>Real time sensor simulation updates</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="text-cyan-400">✓</span>
                <span>Scenarios dealt with: AC failure, humidity spike, pressure drop, airflow loss, smoke/fire</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="text-cyan-400">✓</span>
                <span>Dynamic risk scoring system</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="text-cyan-400">✓</span>
                <span>Multi layer architecture visualization</span>
              </li>
            </ul>
          </div>
        </div>

        <AwsArchitectureSection />
      </main>
    </div>
  );
}
