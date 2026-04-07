/**
 * API base resolution for the dashboard (client-side).
 *
 * - Local (default): same-origin on localhost **or** a dev tunnel (ngrok, etc.); otherwise
 *   NEXT_PUBLIC_LOCAL_API_URL or http://127.0.0.1:3000 (typical when UI is on Amplify).
 * - Lambda: NEXT_PUBLIC_LAMBDA_API_URL, or legacy NEXT_PUBLIC_API_URL.
 *
 * Fog / MQTT paths are unchanged: point CLOUD_URL at your chosen ingest URL separately.
 */

export type ApiBackendMode = 'local' | 'lambda';

/** Must match `STORAGE_KEY` in `ApiBackendContext` (persisted user choice). */
export const API_BACKEND_STORAGE_KEY = 'thermosentinel-api-backend-v2';

/**
 * Initial data-source mode: avoids Amplify/static builds starting as `local` (which points
 * fetches at 127.0.0.1:3000 in the user's browser) before `useEffect` runs.
 */
export function readInitialApiMode(requestHost?: string | null): ApiBackendMode {
  const hostFromRequest = (h: string | null | undefined): string | undefined => {
    if (!h) return undefined;
    return h.startsWith('[') ? h.split(']')[0].slice(1) : h.split(':')[0];
  };

  // `next dev` on any non-Amplify host (localhost, LAN IP, ngrok, …): always "This PC" so `/api/*` is same-origin.
  // Otherwise localStorage `lambda` forces API Gateway while fog POSTs to local ingest only.
  if (process.env.NODE_ENV === 'development') {
    if (typeof window !== 'undefined') {
      if (!isHostedAmplifyHostname(window.location.hostname)) return 'local';
    } else {
      const rh = hostFromRequest(requestHost);
      if (rh && !isHostedAmplifyHostname(rh)) return 'local';
    }
  }

  try {
    if (typeof window !== 'undefined') {
      const s = localStorage.getItem(API_BACKEND_STORAGE_KEY);
      if (s === 'lambda' || s === 'local') return s;
    }
  } catch {
    /* ignore */
  }

  const baked = getLambdaApiBase();
  if (!baked) return 'local';

  if (typeof window !== 'undefined') {
    const h = window.location.hostname;
    if (isSameOriginLocalApiHost(h)) return 'local';
    if (h.includes('amplifyapp.com') || h.endsWith('.amplifyaws.com')) return 'lambda';
    return 'lambda';
  }

  const rh = hostFromRequest(requestHost);
  if (rh && isSameOriginLocalApiHost(rh)) return 'local';
  if (rh && (rh.includes('amplifyapp.com') || rh.endsWith('.amplifyaws.com'))) return 'lambda';

  // SSG / static export build: no `window` — if the Lambda URL was baked in, assume deployed UI.
  return 'lambda';
}

/**
 * Lambda/API Gateway base URL from build-time env (required for Amplify static hosting).
 * Set `NEXT_PUBLIC_LAMBDA_API_URL` in Amplify Console (same as CloudFormation `HttpApiUrl`, no trailing slash).
 * No default URL — avoids calling someone else’s API by mistake.
 */
export function getLambdaApiBase(): string {
  return (process.env.NEXT_PUBLIC_LAMBDA_API_URL || process.env.NEXT_PUBLIC_API_URL || '').replace(
    /\/$/,
    '',
  );
}

/** Direct loopback only (not ngrok). */
export function isLoopbackHostname(hostname: string): boolean {
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '::1'
  );
}

/** Hosted Amplify / AWS Console preview hostnames (not `next dev`). */
export function isHostedAmplifyHostname(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return h.includes('amplifyapp.com') || h.endsWith('.amplifyaws.com');
}

function isLocalHostname(hostname: string): boolean {
  return isLoopbackHostname(hostname);
}

/** Dev tunnels (ngrok, etc.): treat like localhost so the UI calls same-origin `/api/*` through the tunnel. */
function isTunnelDevHostname(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return (
    h.endsWith('.ngrok-free.dev') ||
    h.endsWith('.ngrok.io') ||
    h.endsWith('.ngrok.app') ||
    h.endsWith('.localtunnel.me') ||
    h.endsWith('.loca.lt')
  );
}

function isSameOriginLocalApiHost(hostname: string): boolean {
  return isLocalHostname(hostname) || isTunnelDevHostname(hostname);
}

/**
 * Base URL for the machine-hosted Next API (or tunnel).
 * @param requestHost — optional `Host` header from the server (e.g. from `headers().get('host')`) so SSR matches the browser on localhost.
 */
export function getLocalApiBase(requestHost?: string | null): string {
  const env = (process.env.NEXT_PUBLIC_LOCAL_API_URL || '').replace(/\/$/, '');
  if (env) return env;
  if (typeof window !== 'undefined') {
    const { hostname } = window.location;
    if (isSameOriginLocalApiHost(hostname)) return '';
  }
  if (requestHost) {
    const hostname = requestHost.startsWith('[')
      ? requestHost.split(']')[0].slice(1)
      : requestHost.split(':')[0];
    if (isSameOriginLocalApiHost(hostname)) return '';
  }
  return 'http://127.0.0.1:3000';
}

export function resolveApiBaseForMode(
  mode: ApiBackendMode,
  requestHost?: string | null,
): string {
  if (mode === 'lambda') {
    const lambda = getLambdaApiBase();
    if (lambda) return lambda;
    return getLocalApiBase(requestHost);
  }
  return getLocalApiBase(requestHost);
}

export function buildPublicApiUrl(path: string, base: string): string {
  const b = base.replace(/\/$/, '');
  const p = path.startsWith('/') ? path : `/${path}`;
  return b ? `${b}${p}` : p;
}

/**
 * True when the page is HTTPS but the resolved local API base is `http://` to loopback — browsers block this (mixed content).
 * Hosted Amplify (and any HTTPS origin) needs `NEXT_PUBLIC_LOCAL_API_URL` set to an **HTTPS** tunnel (ngrok, Cloudflare Tunnel) to your PC.
 */
export function isMixedContentBlockedLocalApi(apiBase: string): boolean {
  if (typeof window === 'undefined') return false;
  if (window.location.protocol !== 'https:') return false;
  if (!apiBase.startsWith('http://')) return false;
  try {
    const u = new URL(apiBase);
    return u.hostname === 'localhost' || u.hostname === '127.0.0.1' || u.hostname === '[::1]';
  } catch {
    return false;
  }
}

/**
 * @deprecated Prefer useApiBackend().publicApiUrl or buildPublicApiUrl with a resolved base.
 * Build-time single URL for scripts that cannot use React context.
 */
export function publicApiUrl(path: string): string {
  const base = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '');
  return buildPublicApiUrl(path, base);
}
