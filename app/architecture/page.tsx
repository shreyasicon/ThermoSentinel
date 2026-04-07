'use client';

import Link from 'next/link';
import { useSensorData } from '@/hooks/useSensorData';
import ArchitectureDiagram from '@/components/ArchitectureDiagram';
import AlertSystem from '@/components/AlertSystem';
import StatusDistribution from '@/components/StatusDistribution';
import FogPipelinePanel from '@/components/FogPipelinePanel';
import { ArrowLeft } from 'lucide-react';
import ApiBackendToggle from '@/components/ApiBackendToggle';

export default function ArchitecturePage() {
  const { metrics } = useSensorData();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-white/10 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-white/60 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Dashboard
            </Link>
            <ApiBackendToggle />
          </div>
          <h1 className="text-3xl font-bold text-white">System Architecture</h1>
          <p className="text-sm text-white/60 mt-1">Understanding the Edge-Fog-Cloud Model</p>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <FogPipelinePanel />

        <ArchitectureDiagram />

        <p className="text-sm text-white/55 mt-6 max-w-3xl">
          Edge sensors publish JSON over MQTT; the fog layer can use <strong className="text-white/80">AWS IoT Core</strong> as the
          broker (e.g. Thing <code className="text-cyan-300/90">mock-sensor-001</code>, topic{' '}
          <code className="text-cyan-300/90">sensors/mock-sensor-001/data</code>). See repo docs{' '}
          <code className="text-white/70">docs/ARCHITECTURE_EDGE_FOG_IOT.md</code> and{' '}
          <code className="text-white/70">docs/AWS_IOT_CORE.md</code>.
        </p>

        {/* Status Distribution */}
        <StatusDistribution metrics={metrics} />

        {/* Educational Section */}
        <div className="mt-12 grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="border border-white/10 rounded-2xl p-8 backdrop-blur-sm">
            <h3 className="text-xl font-bold text-white mb-4">Why Edge-Fog-Cloud?</h3>
            <p className="text-white/70 leading-relaxed mb-4">
              The edge-fog-cloud architecture distributes computing resources across multiple layers, each optimized
              for specific tasks. This approach reduces latency, improves resilience, and optimizes bandwidth usage.
            </p>
            <ul className="space-y-3 text-sm text-white/70">
              <li className="flex gap-3">
                <span className="text-cyan-400 font-bold">▸</span>
                <span>
                  <strong className="text-white">Edge:</strong> Closest to data source, handles real-time collection
                </span>
              </li>
              <li className="flex gap-3">
                <span className="text-purple-400 font-bold">▸</span>
                <span>
                  <strong className="text-white">Fog:</strong> Intermediate processing, local decision making
                </span>
              </li>
              <li className="flex gap-3">
                <span className="text-violet-400 font-bold">▸</span>
                <span>
                  <strong className="text-white">Cloud:</strong> Central storage, long-term analytics
                </span>
              </li>
            </ul>
          </div>

          <div className="border border-white/10 rounded-2xl p-8 backdrop-blur-sm">
            <h3 className="text-xl font-bold text-white mb-4">Real-World Applications</h3>
            <p className="text-white/70 leading-relaxed mb-4">
              This architecture pattern is used in various industries where real-time monitoring and intelligent
              processing are critical.
            </p>
            <ul className="space-y-3 text-sm text-white/70">
              <li className="flex gap-3">
                <span className="text-cyan-400 font-bold">▸</span>
                <span>Data centers and server farms managing thermal conditions</span>
              </li>
              <li className="flex gap-3">
                <span className="text-purple-400 font-bold">▸</span>
                <span>Manufacturing plants with IoT sensors and predictive maintenance</span>
              </li>
              <li className="flex gap-3">
                <span className="text-violet-400 font-bold">▸</span>
                <span>Smart cities managing traffic, utilities, and public services</span>
              </li>
            </ul>
          </div>
        </div>

        {/* System Specifications */}
        <div className="mt-6 border border-white/10 rounded-2xl p-8 backdrop-blur-sm">
          <h3 className="text-xl font-bold text-white mb-6">System Specifications</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-lg p-4">
              <h4 className="text-cyan-400 font-semibold mb-2">Sensor Network</h4>
              <p className="text-sm text-white/70">3 racks with 5 servers each (Server 1–5, 6–10, 11–15) = 15 total monitoring points</p>
              <p className="text-xs text-white/50 mt-2">Distributed across multiple zones</p>
            </div>

            <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-4">
              <h4 className="text-purple-400 font-semibold mb-2">Update Frequency</h4>
              <p className="text-sm text-white/70">Data refresh every 2-3 seconds</p>
              <p className="text-xs text-white/50 mt-2">Real-time responsive monitoring</p>
            </div>

            <div className="bg-violet-500/10 border border-violet-500/30 rounded-lg p-4">
              <h4 className="text-violet-400 font-semibold mb-2">Risk Algorithm</h4>
              <p className="text-sm text-white/70">Dynamic scoring with threshold-based alerts</p>
              <p className="text-xs text-white/50 mt-2">Critical (≥70), Warning (≥40), Caution (≥20)</p>
            </div>

            <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-lg p-4">
              <h4 className="text-cyan-400 font-semibold mb-2">Temperature Range</h4>
              <p className="text-sm text-white/70">Normal: 18-24°C</p>
              <p className="text-xs text-white/50 mt-2">Optimal data center conditions</p>
            </div>

            <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-4">
              <h4 className="text-purple-400 font-semibold mb-2">Failure Simulation</h4>
              <p className="text-sm text-white/70">AC system failure scenario testing</p>
              <p className="text-xs text-white/50 mt-2">Demonstrates system response capability</p>
            </div>

            <div className="bg-violet-500/10 border border-violet-500/30 rounded-lg p-4">
              <h4 className="text-violet-400 font-semibold mb-2">Scalability</h4>
              <p className="text-sm text-white/70">Modular architecture for expansion</p>
              <p className="text-xs text-white/50 mt-2">Easy to add more racks and sensors</p>
            </div>
          </div>
        </div>

        {/* System Alerts */}
        <AlertSystem />

        {/* Footer */}
        <div className="mt-12 text-center text-white/60 text-sm">
          <p>ThermoSentinel © 2024 - Advanced Cloud Monitoring System</p>
        </div>
      </main>
    </div>
  );
}
