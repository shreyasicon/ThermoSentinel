'use client';

import Link from 'next/link';
import { ArrowLeft, BarChart3 } from 'lucide-react';
import { AllSensorVisuals } from '@/components/sensor-visuals/SensorVisualCards';
import ApiBackendToggle from '@/components/ApiBackendToggle';

export default function AnalyticsPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-white/10 backdrop-blur-sm sticky top-0 z-40 bg-background/80">
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
          <div className="flex items-start gap-3">
            <BarChart3 className="w-8 h-8 text-cyan-400 shrink-0 mt-1" />
            <div>
              <h1 className="text-3xl font-bold text-white">Analytics</h1>
              <p className="text-sm text-white/60 mt-1 max-w-2xl">
                Data follows the fog to cloud API; charts refresh every 30 seconds.
                Time axis shows one point per minute for readability.
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <AllSensorVisuals />
      </main>
    </div>
  );
}
