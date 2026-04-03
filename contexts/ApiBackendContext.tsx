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
  buildPublicApiUrl,
  getLambdaApiBase,
  resolveApiBaseForMode,
  type ApiBackendMode,
} from '@/lib/public-api-base';

/** Bumped so hosted users get default Local without an old "lambda" preference. */
const STORAGE_KEY = 'thermosentinel-api-backend-v2';

export type ApiBackendContextValue = {
  mode: ApiBackendMode;
  setMode: (m: ApiBackendMode) => void;
  apiBase: string;
  publicApiUrl: (path: string) => string;
  /** True when Lambda mode is selected but no Lambda URL was set at build time. */
  lambdaMisconfigured: boolean;
};

const ApiBackendContext = createContext<ApiBackendContextValue | null>(null);

export function ApiBackendProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ApiBackendMode>('local');

  useEffect(() => {
    try {
      const s = localStorage.getItem(STORAGE_KEY);
      if (s === 'lambda' || s === 'local') setModeState(s);
    } catch {
      /* ignore */
    }
  }, []);

  const setMode = useCallback((m: ApiBackendMode) => {
    setModeState(m);
    try {
      localStorage.setItem(STORAGE_KEY, m);
    } catch {
      /* ignore */
    }
  }, []);

  const lambdaConfigured = Boolean(getLambdaApiBase());
  const lambdaMisconfigured = mode === 'lambda' && !lambdaConfigured;

  const apiBase = useMemo(() => resolveApiBaseForMode(mode), [mode]);

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
      lambdaMisconfigured,
    }),
    [mode, setMode, apiBase, publicApiUrl, lambdaMisconfigured],
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
