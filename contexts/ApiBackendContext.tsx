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
import { buildPublicApiUrl, resolveApiBaseForMode, type ApiBackendMode } from '@/lib/public-api-base';

/** Bumped so hosted users get default Local without an old "lambda" preference. */
const STORAGE_KEY = 'thermosentinel-api-backend-v2';

export type ApiBackendContextValue = {
  mode: ApiBackendMode;
  setMode: (m: ApiBackendMode) => void;
  apiBase: string;
  publicApiUrl: (path: string) => string;
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
    }),
    [mode, setMode, apiBase, publicApiUrl],
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
