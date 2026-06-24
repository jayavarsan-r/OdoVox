'use client';

import { useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';

/**
 * App-wide client providers. TanStack Query for server state; a CSS-variable-based
 * theme is handled purely via globals.css (no next-themes needed yet).
 */
export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <Toaster
        position="top-center"
        richColors
        offset="calc(16px + env(safe-area-inset-top))"
        toastOptions={{ duration: 5000 }}
      />
    </QueryClientProvider>
  );
}
