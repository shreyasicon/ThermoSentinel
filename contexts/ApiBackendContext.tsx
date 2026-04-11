'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  API_BACKEND_STORAGE_KEY,
  LOCAL_API_URL_STORAGE_KEY,
  buildPublicApiUrl,
  isHostedAmplifyHostname,
  readInitialApiMode,
  resolveApiBaseForMode,
  type ApiBackendMode,
} from '@/lib/public-api-base';

export type ApiBackendContextValue = {
  mode: ApiBackendMode;
  setMode: (m: ApiBackendMode) => void;
  apiBase: string;
  publicApiUrl: (path: string) => string;
  /** HTTPS tunnel URL (ngrok) for local API when hosted UI is HTTPS; persisted in localStorage. */
  localApiTunnelUrl: string;
  setLocalApiTunnelUrl: (url: string) => void;
};

const ApiBackendContext = createContext<ApiBackendContextValue | null>(null);

export function ApiBackendProvider({
  children,
  requestHost,
}: {
  children: ReactNode;
  /** From server `headers().get('host')` — keeps local API label in sync during SSR/hydration */
  requestHost?: string | null;
}) {
  const [mode, setModeState] = useState<ApiBackendMode>(() =>
    readInitialApiMode(requestHost),
  );

  const [localApiTunnelUrl, setLocalApiTunnelUrlState] = useState('');

  /** Load saved HTTPS tunnel for local API (ngrok). */
  useEffect(() => {
    try {
      const v = localStorage.getItem(LOCAL_API_URL_STORAGE_KEY);
      if (v) setLocalApiTunnelUrlState(v);
    } catch {
      /* ignore */
    }
  }, []);

  const setLocalApiTunnelUrl = useCallback((url: string) => {
    const trimmed = url.trim();
    setLocalApiTunnelUrlState(trimmed);
    try {
      if (trimmed) localStorage.setItem(LOCAL_API_URL_STORAGE_KEY, trimmed);
      else localStorage.removeItem(LOCAL_API_URL_STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  /** Re-sync persisted choice after mount (SSR could not read localStorage). */
  useEffect(() => {
    try {
      // Same as readInitialApiMode: in dev, don't re-apply `lambda` unless we're on hosted Amplify.
      if (
        process.env.NODE_ENV === 'development' &&
        typeof window !== 'undefined' &&
        !isHostedAmplifyHostname(window.location.hostname)
      ) {
        return;
      }
      const s = localStorage.getItem(API_BACKEND_STORAGE_KEY);
      if (s === 'lambda' || s === 'local' || s === 'localMqtt') setModeState(s);
    } catch {
      /* ignore */
    }
  }, []);

  const setMode = useCallback((m: ApiBackendMode) => {
    setModeState(m);
    try {
      localStorage.setItem(API_BACKEND_STORAGE_KEY, m);
    } catch {
      /* ignore */
    }
  }, []);

  const apiBase = useMemo(
    () => resolveApiBaseForMode(mode, requestHost, localApiTunnelUrl || null),
    [mode, requestHost, localApiTunnelUrl],
  );

  const publicApiUrl = useCallback(
    (path: string) => buildPublicApiUrl(path, apiBase),
    [apiBase],
  );

  const value = useMemo<ApiBackendContextValue>(
    () => ({
      mode,
      setMode,
      apiBase,
      publicApiUrl,
      localApiTunnelUrl,
      setLocalApiTunnelUrl,
    }),
    [mode, setMode, apiBase, publicApiUrl, localApiTunnelUrl, setLocalApiTunnelUrl],
  );

  return <ApiBackendContext.Provider value={value}>{children}</ApiBackendContext.Provider>;
}

export function useApiBackend(): ApiBackendContextValue {
  const ctx = useContext(ApiBackendContext);
  if (!ctx) {
    throw new Error('useApiBackend must be used within ApiBackendProvider');
  }
  return ctx;
}
