'use client';

import { useApiBackend } from '@/contexts/ApiBackendContext';

export default function ApiBackendToggle() {
  const { mode, setMode, apiBase, lambdaMisconfigured } = useApiBackend();

  return (
    <div className="flex flex-col items-end gap-1 text-right">
      <div className="flex items-center gap-1 rounded-lg border border-white/15 bg-black/20 p-0.5">
        <button
          type="button"
          onClick={() => setMode('local')}
          className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
            mode === 'local'
              ? 'bg-cyan-600/90 text-white'
              : 'text-white/55 hover:text-white/80'
          }`}
        >
          Local API
        </button>
        <button
          type="button"
          onClick={() => setMode('lambda')}
          className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
            mode === 'lambda'
              ? 'bg-orange-600/90 text-white'
              : 'text-white/55 hover:text-white/80'
          }`}
        >
          Lambda
        </button>
      </div>
      <p className="text-[10px] text-white/35 max-w-[220px] leading-tight font-mono truncate" title={apiBase || '(same origin)'}>
        {apiBase ? apiBase : 'same origin'}
      </p>
      {lambdaMisconfigured && (
        <p className="text-[10px] text-amber-400/90 max-w-[220px] leading-tight">
          Set NEXT_PUBLIC_LAMBDA_API_URL for Lambda; using local base until then.
        </p>
      )}
    </div>
  );
}
