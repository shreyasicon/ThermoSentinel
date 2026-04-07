'use client';

import type { ReactNode } from 'react';
import { ApiBackendProvider } from '@/contexts/ApiBackendContext';

export function Providers({
  children,
  requestHost,
}: {
  children: ReactNode;
  requestHost?: string | null;
}) {
  return (
    <ApiBackendProvider requestHost={requestHost}>{children}</ApiBackendProvider>
  );
}
