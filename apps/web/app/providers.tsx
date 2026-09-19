"use client";

import { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MotionConfig } from "framer-motion";
import { Toaster } from "sonner";

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
      {/* v9 frame 79: one at a time, above the nav, newest wins. Duration is set
          per-voice by lib/toast.ts — a problem or offline toast must never
          auto-dismiss, so no global duration is set here. */}
      <Toaster
        position="bottom-center"
        visibleToasts={1}
        offset="calc(96px + env(safe-area-inset-bottom))"
        toastOptions={{
          classNames: {
            toast:
              "rounded-xl bg-sheet text-pine shadow-toast border-0 px-[15px] py-[13px] gap-3",
            title: "text-sm font-heavy text-pine",
            description: "text-2xs font-medium text-pine-2",
            actionButton:
              "h-8 rounded-pill bg-[rgba(31,42,35,0.05)] px-3 text-3xs font-heavy text-pine",
            error: "outline outline-2 -outline-offset-1 outline-crit",
            success: "",
          },
        }}
      />
    </QueryClientProvider>
  );
}
