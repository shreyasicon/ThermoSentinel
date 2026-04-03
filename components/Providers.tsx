'use client';

import type { ReactNode } from 'react';
import { ApiBackendProvider } from '@/contexts/ApiBackendContext';

export function Providers({ children }: { children: ReactNode }) {
  return <ApiBackendProvider>{children}</ApiBackendProvider>;
}
