import type { ReactNode } from 'react';

/**
 * Authenticated app shell. Placeholder for Phase 1 — no bottom tabs yet (Phase 2). Each
 * screen renders its own MobileShell; route protection is handled per-screen via /auth/me.
 */
export default function AppLayout({ children }: { children: ReactNode }) {
  return children;
}
