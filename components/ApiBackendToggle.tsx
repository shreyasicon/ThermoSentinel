'use client';

import { useApiBackend } from '@/contexts/ApiBackendContext';

export default function ApiBackendToggle() {
  const { mode, setMode, apiBase } = useApiBackend();

  return (
    <div className="flex flex-col items-end gap-2 text-right max-w-[min(100%,280px)]">
      <p className="text-[10px] uppercase tracking-wide text-white/40 font-medium">Data source</p>
      <div className="flex flex-wrap items-center justify-end gap-1.5">
        <button
          type="button"
          onClick={() => setMode('local')}
          className={`rounded-lg px-3 py-2 text-xs font-semibold shadow-sm transition-colors border ${
            mode === 'local'
              ? 'bg-cyan-600 text-white border-cyan-500/80'
              : 'bg-white/5 text-white/60 border-white/15 hover:border-white/30 hover:text-white/90'
          }`}
        >
          This PC (local API)
        </button>
        <button
          type="button"
          onClick={() => setMode('lambda')}
          className={`rounded-lg px-3 py-2 text-xs font-semibold shadow-sm transition-colors border ${
            mode === 'lambda'
              ? 'bg-orange-600 text-white border-orange-500/80'
              : 'bg-white/5 text-white/60 border-white/15 hover:border-white/30 hover:text-white/90'
          }`}
        >
          AWS Lambda
        </button>
      </div>
      <p
        className="text-[10px] text-white/35 leading-tight font-mono truncate w-full"
        title={apiBase || '(same origin)'}
      >
        {apiBase ? apiBase : 'same origin'}
      </p>
      {mode === 'local' && (
        <p className="text-[10px] text-white/40 leading-tight">
          Run <span className="text-white/60 font-mono">npm run dev</span> locally for live numbers; no demo data.
        </p>
      )}
      {mode === 'lambda' && (
        <p className="text-[10px] text-white/40 leading-tight">
          Uses API Gateway + Lambda. Override the base URL with{' '}
          <span className="text-white/60 font-mono">NEXT_PUBLIC_LAMBDA_API_URL</span> at build time if needed.
        </p>
      )}
    </div>
  );
}
