/**
 * API base resolution for the dashboard (client-side).
 *
 * - Local (default): same-origin when the UI is opened on localhost; otherwise
 *   NEXT_PUBLIC_LOCAL_API_URL or http://127.0.0.1:3000 (typical when UI is on Amplify).
 * - Lambda: NEXT_PUBLIC_LAMBDA_API_URL, or legacy NEXT_PUBLIC_API_URL.
 *
 * Fog / MQTT paths are unchanged: point CLOUD_URL at your chosen ingest URL separately.
 */

export type ApiBackendMode = 'local' | 'lambda';

export function getLambdaApiBase(): string {
  return (process.env.NEXT_PUBLIC_LAMBDA_API_URL || process.env.NEXT_PUBLIC_API_URL || '').replace(
    /\/$/,
    '',
  );
}

/** Base URL for the machine-hosted Next API (or tunnel). */
export function getLocalApiBase(): string {
  const env = (process.env.NEXT_PUBLIC_LOCAL_API_URL || '').replace(/\/$/, '');
  if (env) return env;
  if (typeof window !== 'undefined') {
    const { hostname } = window.location;
    if (hostname === 'localhost' || hostname === '127.0.0.1') return '';
  }
  return 'http://127.0.0.1:3000';
}

export function resolveApiBaseForMode(mode: ApiBackendMode): string {
  if (mode === 'lambda') {
    const lambda = getLambdaApiBase();
    if (lambda) return lambda;
    return getLocalApiBase();
  }
  return getLocalApiBase();
}

export function buildPublicApiUrl(path: string, base: string): string {
  const b = base.replace(/\/$/, '');
  const p = path.startsWith('/') ? path : `/${path}`;
  return b ? `${b}${p}` : p;
}

/**
 * @deprecated Prefer useApiBackend().publicApiUrl or buildPublicApiUrl with a resolved base.
 * Build-time single URL for scripts that cannot use React context.
 */
export function publicApiUrl(path: string): string {
  const base = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '');
  return buildPublicApiUrl(path, base);
}
