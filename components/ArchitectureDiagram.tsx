'use client';

import { useState } from 'react';

interface LayerInfo {
  id: string;
  name: string;
  description: string;
  details: string[];
  color: string;
  icon: string;
}

const layers: LayerInfo[] = [
  {
    id: 'edge',
    name: 'Edge Layer',
    description: 'Local IoT sensors and gateways',
    details: ['Real-time sensor data collection', 'Local preprocessing', 'Hardware abstraction', '15 sensors across 3 racks'],
    color: 'from-cyan-500/40 to-cyan-600/20',
    icon: '📡',
  },
  {
    id: 'fog',
    name: 'Fog Layer',
    description: 'Intermediate processing nodes',
    details: ['Data aggregation', 'Local caching', 'Initial analytics', 'Threshold monitoring'],
    color: 'from-purple-500/40 to-purple-600/20',
    icon: '☁️',
  },
  {
    id: 'cloud',
    name: 'Cloud Layer',
    description: 'Centralized storage and analytics',
    details: ['Historical data storage', 'ML predictions', 'Global insights', 'Long-term trending'],
    color: 'from-violet-500/40 to-violet-600/20',
    icon: '🔗',
  },
];

export default function ArchitectureDiagram() {
  const [activeLayer, setActiveLayer] = useState<string | null>(null);

  return (
    <div className="w-full space-y-8">
      {/* Main Architecture Flow */}
      <div className="border border-white/10 rounded-2xl p-8 backdrop-blur-sm">
        <h3 className="text-2xl font-bold mb-8 text-white">Edge-Fog-Cloud Architecture</h3>

        <div className="flex flex-col lg:flex-row items-stretch justify-between gap-6 mb-8">
          {layers.map((layer, idx) => (
            <div key={layer.id} className="flex-1 flex flex-col">
              <button
                onClick={() => setActiveLayer(activeLayer === layer.id ? null : layer.id)}
                className={`relative overflow-hidden rounded-xl p-6 border-2 transition-all duration-300 flex-1 flex flex-col ${
                  activeLayer === layer.id
                    ? 'border-white/40 bg-gradient-to-br ' + layer.color
                    : 'border-white/10 bg-gradient-to-br ' + layer.color + ' hover:border-white/20'
                }`}
              >
                <div className="absolute top-0 right-0 text-4xl opacity-20">{layer.icon}</div>
                <div className="relative z-10">
                  <div className="text-3xl mb-2">{layer.icon}</div>
                  <h4 className="text-lg font-bold text-white mb-1">{layer.name}</h4>
                  <p className="text-sm text-white/70">{layer.description}</p>

                  {activeLayer === layer.id && (
                    <div className="mt-4 pt-4 border-t border-white/20">
                      <ul className="space-y-2">
                        {layer.details.map((detail, i) => (
                          <li key={i} className="text-sm flex items-start gap-2">
                            <span className="text-cyan-400 mt-0.5">▸</span>
                            <span>{detail}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </button>

              {idx < layers.length - 1 && (
                <div className="hidden lg:flex items-center justify-center py-4">
                  <div className="text-2xl text-purple-400 opacity-50">↓</div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Data Flow */}
      <div className="border border-white/10 rounded-2xl p-8 backdrop-blur-sm">
        <h4 className="text-lg font-bold text-white mb-6">Real-Time Data Flow</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="border-l-4 border-cyan-500 pl-4">
            <p className="text-sm text-white/60">Edge Sensors</p>
            <p className="text-sm font-semibold">2-3 second intervals</p>
            <p className="text-xs text-white/40 mt-1">Local acquisition and filtering</p>
          </div>
          <div className="border-l-4 border-purple-500 pl-4">
            <p className="text-sm text-white/60">Fog Processing</p>
            <p className="text-sm font-semibold">5 second aggregation</p>
            <p className="text-xs text-white/40 mt-1">Pattern detection and alerts</p>
          </div>
          <div className="border-l-4 border-violet-500 pl-4">
            <p className="text-sm text-white/60">Cloud Storage</p>
            <p className="text-sm font-semibold">Batch processing</p>
            <p className="text-xs text-white/40 mt-1">Historical analytics and trends</p>
          </div>
        </div>
      </div>

      {/* Risk Calculation Formula */}
      <div className="border border-white/10 rounded-2xl p-8 backdrop-blur-sm">
        <h4 className="text-lg font-bold text-white mb-4">Risk Assessment Formula</h4>
        <div className="bg-black/30 rounded-lg p-6 font-mono text-sm space-y-3">
          <p>
            <span className="text-cyan-400">Risk Score = </span>
            <span className="text-white/70">(Critical Sensors × 40) + (Warning Sensors × 15)</span>
          </p>
          <p className="text-white/50">
            Max Score: 100 | Status: {'Critical (≥70) | Warning (≥40) | Caution (≥20) | Optimal (<20)'}
          </p>
        </div>
      </div>
    </div>
  );
}
