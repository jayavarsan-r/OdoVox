'use client';

import { useEffect } from 'react';
import { RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Route error boundary for every (app)/* screen (Phase 9.7 §3.4). Friendly copy + one-tap
 * retry — a render crash never strands the user on a white screen. Next.js resets the
 * segment on `reset()`, so retry re-renders in place without losing navigation state.
 */
export default function AppRouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Surface in the console for local debugging; Sentry catches it via the global handler.
    console.error('Route error boundary:', error);
  }, [error]);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-8 py-24 text-center">
      <p className="text-lg font-semibold text-ink">Something went wrong</p>
      <p className="max-w-xs text-sm text-text-muted">
        That screen hit a snag. Your data is safe — try again, or head back if it keeps happening.
      </p>
      <Button onClick={() => reset()}>
        <RotateCcw className="size-4" /> Try again
      </Button>
    </div>
  );
}
