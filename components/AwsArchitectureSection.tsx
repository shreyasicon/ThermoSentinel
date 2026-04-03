'use client';

import type { ComponentType } from 'react';

/**
 * AWS services used by ThermoSentinel in production-style deployment.
 * Iconography: simplified brand marks (orange/dark per AWS console feel) — not official trademark assets.
 */

const ORANGE = '#FF9900';
const DARK = '#232F3E';

function IconAmplify() {
  return (
    <svg viewBox="0 0 48 48" className="w-10 h-10" aria-hidden>
      <rect width="48" height="48" rx="8" fill={DARK} />
      <path
        fill={ORANGE}
        d="M14 14h8v20H14V14zm12 0h8v8h-8v-8zm0 12h8v8h-8v-8z"
      />
    </svg>
  );
}

function IconApiGateway() {
  return (
    <svg viewBox="0 0 48 48" className="w-10 h-10" aria-hidden>
      <rect width="48" height="48" rx="8" fill={DARK} />
      <path
        fill="#FF4F8B"
        d="M12 22h6v4h-6v-4zm30 0h-6v4h6v-4zM22 18h4v12h-4V18z"
      />
      <path fill={ORANGE} d="M18 24h12v2H18v-2z" />
    </svg>
  );
}

function IconLambda() {
  return (
    <svg viewBox="0 0 48 48" className="w-10 h-10" aria-hidden>
      <rect width="48" height="48" rx="8" fill={DARK} />
      <path fill={ORANGE} d="M30 14L18 34h4l3-6h8l3 6h4L26 14h4zm-8 12l4-8 4 8h-8z" />
    </svg>
  );
}

function IconCloudWatch() {
  return (
    <svg viewBox="0 0 48 48" className="w-10 h-10" aria-hidden>
      <rect width="48" height="48" rx="8" fill={DARK} />
      <path
        fill="#87C5A0"
        d="M12 30c4-8 8-12 12-12s8 4 12 12H12z"
        opacity={0.85}
      />
      <path stroke={ORANGE} strokeWidth="2" fill="none" d="M14 26h6l4-8 4 10 6-6h6" />
    </svg>
  );
}

function IconS3() {
  return (
    <svg viewBox="0 0 48 48" className="w-10 h-10" aria-hidden>
      <rect width="48" height="48" rx="8" fill={DARK} />
      <path fill="#569A31" d="M14 20h20v12H14V20z" />
      <path fill="#7AAE45" d="M14 20l10-6 10 6v12H14V20z" />
    </svg>
  );
}

function IconTurso() {
  return (
    <svg viewBox="0 0 48 48" className="w-10 h-10" aria-hidden>
      <rect width="48" height="48" rx="8" fill="#1e293b" />
      <circle cx="24" cy="24" r="12" stroke="#38bdf8" strokeWidth="2" fill="none" />
      <text x="24" y="28" textAnchor="middle" fill="#38bdf8" fontSize="11" fontWeight="700" fontFamily="system-ui">
        SQL
      </text>
    </svg>
  );
}

const SERVICES: {
  name: string;
  role: string;
  Icon: ComponentType;
}[] = [
  { name: 'Amplify', role: 'Static Next.js UI', Icon: IconAmplify },
  { name: 'API Gateway', role: 'HTTP API routes', Icon: IconApiGateway },
  { name: 'Lambda', role: 'Sensor API handler', Icon: IconLambda },
  { name: 'CloudWatch', role: 'Logs & metrics', Icon: IconCloudWatch },
  { name: 'S3', role: 'Deploy artifacts', Icon: IconS3 },
  { name: 'Turso (libSQL)', role: 'Optional datastore', Icon: IconTurso },
];

export default function AwsArchitectureSection() {
  return (
    <section className="mt-10 border border-white/10 rounded-2xl p-6 sm:p-8 backdrop-blur-sm bg-white/[0.02]">
      <h3 className="text-lg font-semibold text-white mb-1">AWS architecture in use</h3>
      <p className="text-sm text-white/50 mb-6 max-w-3xl">
        Production-style stack: hosted dashboard, serverless API, and optional managed persistence. Fog/simulator run
        outside AWS; they POST to API Gateway.
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {SERVICES.map(({ name, role, Icon }) => (
          <div
            key={name}
            className="flex flex-col items-center text-center rounded-xl border border-white/10 bg-slate-950/50 p-4 min-h-[128px] justify-between"
          >
            <div className="flex justify-center mb-2">
              <Icon />
            </div>
            <div className="space-y-0.5">
              <p className="text-xs font-semibold text-white leading-tight">{name}</p>
              <p className="text-[10px] text-white/45 leading-snug">{role}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
