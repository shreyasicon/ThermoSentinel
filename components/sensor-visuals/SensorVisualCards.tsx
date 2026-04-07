'use client';

import { useMemo } from 'react';
import { useSensorTrendReadings } from '@/hooks/useSensorTrendReadings';
import { aggregatePointsPerMinute } from '@/lib/chart-aggregate';
import type { SensorType } from '@/shared/schema/types';
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const POLL_MS = 30_000;

function useAggregatedSensorData(type: SensorType, limit: number) {
  const { data: raw, hasData } = useSensorTrendReadings(type, { limit, pollIntervalMs: POLL_MS });
  const data = useMemo(() => aggregatePointsPerMinute(raw), [raw]);
  return { data, hasData };
}

const xAxisTickProps = { fontSize: 11 } as const;

function EmptyHint({ label }: { label: string }) {
  return (
    <p className="text-sm text-amber-400/90 mb-3">
      No {label} data yet. Start the fog pipeline or use demo mode when the API is empty.
    </p>
  );
}

export function TemperatureVisual() {
  const { data, hasData } = useAggregatedSensorData('temperature', 120);
  return (
    <div className="rounded-2xl border border-cyan-500/20 bg-gradient-to-br from-cyan-950/40 to-slate-950/60 p-6">
      <h3 className="text-lg font-bold text-cyan-200">Temperature</h3>
      <p className="text-xs text-white/45 mb-4">Line trend — thermal drift &amp; AC scenarios (°C)</p>
      {!hasData && <EmptyHint label="temperature" />}
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
          <XAxis
            dataKey="time"
            stroke="rgba(255,255,255,0.45)"
            tick={xAxisTickProps}
            minTickGap={28}
            interval="preserveStartEnd"
          />
          <YAxis stroke="rgba(255,255,255,0.45)" domain={[18, 32]} tick={{ fontSize: 11 }} />
          <Tooltip
            contentStyle={{
              backgroundColor: 'rgba(15, 23, 42, 0.95)',
              border: '1px solid rgba(34, 211, 238, 0.3)',
            }}
            formatter={(v: number) => [`${v.toFixed(2)} °C`, '']}
          />
          <Line
            type="monotone"
            dataKey="value"
            name="°C"
            stroke="#22d3ee"
            strokeWidth={2}
            dot={{ r: 3, fill: '#22d3ee' }}
            isAnimationActive
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function HumidityVisual() {
  const { data, hasData } = useAggregatedSensorData('humidity', 120);
  return (
    <div className="rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-950/35 to-slate-950/60 p-6">
      <h3 className="text-lg font-bold text-emerald-200">Humidity</h3>
      <p className="text-xs text-white/45 mb-4">Filled area — slow-moving moisture (%)</p>
      {!hasData && <EmptyHint label="humidity" />}
      <ResponsiveContainer width="100%" height={220}>
        <ComposedChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="humFillAnalytics" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#34d399" stopOpacity={0.45} />
              <stop offset="100%" stopColor="#34d399" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
          <XAxis
            dataKey="time"
            stroke="rgba(255,255,255,0.45)"
            tick={xAxisTickProps}
            minTickGap={28}
            interval="preserveStartEnd"
          />
          <YAxis stroke="rgba(255,255,255,0.45)" domain={[25, 90]} tick={{ fontSize: 11 }} />
          <Tooltip
            contentStyle={{
              backgroundColor: 'rgba(15, 23, 42, 0.95)',
              border: '1px solid rgba(52, 211, 153, 0.35)',
            }}
            formatter={(v: number) => [`${v.toFixed(1)} %`, '']}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke="#34d399"
            strokeWidth={2}
            fill="url(#humFillAnalytics)"
            name="%"
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export function PressureVisual() {
  const { data, hasData } = useAggregatedSensorData('pressure', 96);
  const bars = data.slice(-32);
  return (
    <div className="rounded-2xl border border-violet-500/20 bg-gradient-to-br from-violet-950/35 to-slate-950/60 p-6">
      <h3 className="text-lg font-bold text-violet-200">Pressure</h3>
      <p className="text-xs text-white/45 mb-4">Bar snapshot — stable room pressure bands (hPa)</p>
      {!hasData && <EmptyHint label="pressure" />}
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={bars} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
          <XAxis
            dataKey="time"
            stroke="rgba(255,255,255,0.45)"
            tick={{ fontSize: 10 }}
            interval="preserveStartEnd"
            minTickGap={28}
          />
          <YAxis stroke="rgba(255,255,255,0.45)" domain={[980, 1030]} tick={{ fontSize: 11 }} />
          <Tooltip
            contentStyle={{
              backgroundColor: 'rgba(15, 23, 42, 0.95)',
              border: '1px solid rgba(167, 139, 250, 0.35)',
            }}
            formatter={(v: number) => [`${v.toFixed(1)} hPa`, '']}
          />
          <Bar dataKey="value" fill="#a78bfa" radius={[4, 4, 0, 0]} name="hPa" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function AirflowVisual() {
  const { data, hasData } = useAggregatedSensorData('airflow', 120);
  return (
    <div className="rounded-2xl border border-amber-500/25 bg-gradient-to-br from-amber-950/30 to-slate-950/60 p-6">
      <h3 className="text-lg font-bold text-amber-200">Airflow</h3>
      <p className="text-xs text-white/45 mb-4">Stepped area — sudden drops are critical (cfm)</p>
      {!hasData && <EmptyHint label="airflow" />}
      <ResponsiveContainer width="100%" height={220}>
        <ComposedChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="airFillAnalytics" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#fb923c" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#fb923c" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
          <XAxis
            dataKey="time"
            stroke="rgba(255,255,255,0.45)"
            tick={xAxisTickProps}
            minTickGap={28}
            interval="preserveStartEnd"
          />
          <YAxis stroke="rgba(255,255,255,0.45)" domain={[200, 950]} tick={{ fontSize: 11 }} />
          <Tooltip
            contentStyle={{
              backgroundColor: 'rgba(15, 23, 42, 0.95)',
              border: '1px solid rgba(251, 146, 60, 0.4)',
            }}
            formatter={(v: number) => [`${Math.round(v)} cfm`, '']}
          />
          <Area
            type="stepAfter"
            dataKey="value"
            stroke="#fb923c"
            strokeWidth={2}
            fill="url(#airFillAnalytics)"
            name="cfm"
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export function SmokeVisual() {
  const { data, hasData } = useAggregatedSensorData('smoke', 120);
  return (
    <div className="rounded-2xl border border-rose-500/30 bg-gradient-to-br from-rose-950/40 to-slate-950/60 p-6 ring-1 ring-rose-500/10">
      <h3 className="text-lg font-bold text-rose-200">Smoke / Fire</h3>
      <p className="text-xs text-white/45 mb-4">Area + alert lines — safety index (0–100)</p>
      {!hasData && <EmptyHint label="smoke" />}
      <ResponsiveContainer width="100%" height={220}>
        <ComposedChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="smokeFillAnalytics" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f43f5e" stopOpacity={0.5} />
              <stop offset="100%" stopColor="#f43f5e" stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
          <XAxis
            dataKey="time"
            stroke="rgba(255,255,255,0.45)"
            tick={xAxisTickProps}
            minTickGap={28}
            interval="preserveStartEnd"
          />
          <YAxis stroke="rgba(255,255,255,0.45)" domain={[0, 100]} tick={{ fontSize: 11 }} />
          <ReferenceLine y={25} stroke="#fbbf24" strokeDasharray="4 4" label={{ value: 'watch', fill: '#fbbf24', fontSize: 10 }} />
          <ReferenceLine y={50} stroke="#f87171" strokeDasharray="4 4" label={{ value: 'alert', fill: '#f87171', fontSize: 10 }} />
          <Tooltip
            contentStyle={{
              backgroundColor: 'rgba(15, 23, 42, 0.95)',
              border: '1px solid rgba(244, 63, 94, 0.4)',
            }}
            formatter={(v: number) => [`${v.toFixed(1)} index`, '']}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke="#f43f5e"
            strokeWidth={2}
            fill="url(#smokeFillAnalytics)"
            name="index"
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export function AllSensorVisuals() {
  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
      <TemperatureVisual />
      <HumidityVisual />
      <PressureVisual />
      <AirflowVisual />
      <SmokeVisual />
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 flex flex-col justify-center xl:col-span-2">
        <p className="text-sm text-white/55 leading-relaxed">
          Charts poll every <span className="text-cyan-300 font-medium">30 seconds</span> and plot{' '}
          <span className="text-cyan-300 font-medium">one sample per minute</span> on the time axis so labels stay
          readable. Each sensor uses a different visual encoding: line (temperature), area (humidity), bars (pressure),
          stepped area (airflow), and threshold bands (smoke).
        </p>
      </div>
    </div>
  );
}
