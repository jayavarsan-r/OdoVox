'use client';

import { useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MotionConfig } from 'framer-motion';
import { Toaster } from 'sonner';

/**
 * App-wide client providers. TanStack Query for server state; a CSS-variable-based
 * theme is handled purely via globals.css (no next-themes needed yet).
 *
 * Phase 9.7 §3.3/§3.4 cross-cutting polish:
 * - Toasts: bottom of the screen, 3s auto-dismiss, ONE at a time, safe-area aware.
 * - MotionConfig reducedMotion="user": every Framer animation respects prefers-reduced-motion.
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
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
      <Toaster
        position="bottom-center"
        richColors
        visibleToasts={1}
        offset="calc(96px + env(safe-area-inset-bottom))"
        toastOptions={{ duration: 3000 }}
      />
    </QueryClientProvider>
  );
}
