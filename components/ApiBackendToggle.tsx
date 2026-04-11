'use client';

import { useEffect, useState } from 'react';
import { useApiBackend } from '@/contexts/ApiBackendContext';
import {
  isLocalApiMode,
  isMixedContentBlockedLocalApi,
  isHostedAmplifyHostname,
  parseValidHttpsLocalApiUrl,
} from '@/lib/public-api-base';

export default function ApiBackendToggle() {
  const { mode, setMode, apiBase, localApiTunnelUrl, setLocalApiTunnelUrl } = useApiBackend();
  const [tunnelInput, setTunnelInput] = useState('');
  useEffect(() => {
    setTunnelInput(localApiTunnelUrl);
  }, [localApiTunnelUrl]);
  const mixedBlocked = isLocalApiMode(mode) && apiBase && isMixedContentBlockedLocalApi(apiBase);
  const onAmplify =
    typeof window !== 'undefined' && isHostedAmplifyHostname(window.location.hostname);
  const showTunnelField = onAmplify && isLocalApiMode(mode);
  const tunnelInvalid =
    showTunnelField &&
    tunnelInput.trim() !== '' &&
    !parseValidHttpsLocalApiUrl(tunnelInput);

  return (
    <div className="flex flex-col items-end gap-2 text-right max-w-[min(100%,340px)]">
      <p className="text-[10px] uppercase tracking-wide text-white/40 font-medium">Data source</p>
      <div className="flex flex-wrap items-center justify-end gap-1.5">
        <button
          type="button"
          onClick={() => setMode('local')}
          className={`rounded-lg px-2.5 sm:px-3 py-2 text-[11px] sm:text-xs font-semibold shadow-sm transition-colors border ${
            mode === 'local'
              ? 'bg-cyan-600 text-white border-cyan-500/80'
              : 'bg-white/5 text-white/60 border-white/15 hover:border-white/30 hover:text-white/90'
          }`}
        >
          This PC (local API)
        </button>
        <button
          type="button"
          onClick={() => setMode('localMqtt')}
          className={`rounded-lg px-2.5 sm:px-3 py-2 text-[11px] sm:text-xs font-semibold shadow-sm transition-colors border ${
            mode === 'localMqtt'
              ? 'bg-emerald-600 text-white border-emerald-500/80'
              : 'bg-white/5 text-white/60 border-white/15 hover:border-white/30 hover:text-white/90'
          }`}
        >
          Local MQTT
        </button>
        <button
          type="button"
          onClick={() => setMode('lambda')}
          className={`rounded-lg px-2.5 sm:px-3 py-2 text-[11px] sm:text-xs font-semibold shadow-sm transition-colors border ${
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
      {showTunnelField && (
        <div className="w-full max-w-[min(100%,320px)] space-y-1.5 text-left">
          <label className="block text-[10px] uppercase tracking-wide text-white/40 font-medium">
            Local API (HTTPS tunnel)
          </label>
          <div className="flex flex-col gap-1.5">
            <input
              type="url"
              inputMode="url"
              autoComplete="off"
              placeholder="https://xxxx.ngrok-free.app"
              value={tunnelInput}
              onChange={(e) => setTunnelInput(e.target.value)}
              className={`w-full rounded-md border bg-black/30 px-2 py-1.5 text-[11px] font-mono text-white/90 placeholder:text-white/25 outline-none focus:ring-1 ${
                tunnelInvalid
                  ? 'border-red-500/50 focus:ring-red-500/40'
                  : 'border-white/15 focus:ring-cyan-500/40'
              }`}
            />
            <div className="flex flex-wrap gap-1.5 justify-end">
              <button
                type="button"
                disabled={!parseValidHttpsLocalApiUrl(tunnelInput)}
                onClick={() => {
                  const parsed = parseValidHttpsLocalApiUrl(tunnelInput);
                  if (parsed) setLocalApiTunnelUrl(parsed);
                }}
                className="rounded-md px-2.5 py-1 text-[10px] font-semibold bg-cyan-700/90 text-white border border-cyan-500/50 hover:bg-cyan-600 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-cyan-700/90"
              >
                Save tunnel URL
              </button>
              <button
                type="button"
                onClick={() => {
                  setLocalApiTunnelUrl('');
                  setTunnelInput('');
                }}
                className="rounded-md px-2.5 py-1 text-[10px] font-semibold bg-white/10 text-white/80 border border-white/15 hover:bg-white/15"
              >
                Clear
              </button>
            </div>
          </div>
          <p className="text-[9px] text-white/35 leading-tight">
            Paste the <span className="text-white/50">https</span> URL from ngrok (or Cloudflare Tunnel) that forwards to{' '}
            <span className="font-mono text-white/45">localhost:3000</span>, then Save. No redeploy needed when the URL changes.
          </p>
        </div>
      )}
      {mixedBlocked && (
        <p className="text-[10px] text-amber-200/90 leading-tight rounded-md border border-amber-500/35 bg-amber-950/30 px-2 py-1.5 text-left max-w-[min(100%,320px)]">
          This page is HTTPS but &quot;local API&quot; points at <span className="font-mono text-amber-100/90">http://127.0.0.1</span> — the browser blocks that. Set
          your HTTPS tunnel above (or bake <span className="font-mono text-amber-100/80">NEXT_PUBLIC_LOCAL_API_URL</span> at build time).
        </p>
      )}
      {mode === 'local' && !mixedBlocked && (
        <p className="text-[10px] text-white/40 leading-tight">
          Run <span className="text-white/60 font-mono">npm run dev</span> for Next + fog + simulator (HTTP pipeline). Charts use your PC API when the pipeline
          runs; <span className="text-white/60 font-mono">npm run dev:next</span> is UI only.
          {onAmplify && !localApiTunnelUrl && process.env.NEXT_PUBLIC_LOCAL_API_URL && (
            <>
              {' '}
              Using build-time <span className="font-mono text-white/50">NEXT_PUBLIC_LOCAL_API_URL</span> for the API base.
            </>
          )}
        </p>
      )}
      {mode === 'localMqtt' && !mixedBlocked && (
        <p className="text-[10px] text-white/40 leading-tight">
          Same API base as &quot;This PC&quot; — charts read <span className="font-mono text-white/55">/api/sensors/…/readings</span> from your machine. Run{' '}
          <span className="text-white/60 font-mono">npm run dev:iot</span> (simulator → AWS IoT MQTT → fog →{' '}
          <span className="font-mono text-white/55">POST /api/ingest</span>
          ). On Amplify, set the HTTPS tunnel to the PC running Next. Fog <span className="font-mono text-white/50">CLOUD_URL</span> must reach that same origin.
          {onAmplify && !localApiTunnelUrl && process.env.NEXT_PUBLIC_LOCAL_API_URL && (
            <>
              {' '}
              Using build-time <span className="font-mono text-white/50">NEXT_PUBLIC_LOCAL_API_URL</span> for the API base.
            </>
          )}
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
