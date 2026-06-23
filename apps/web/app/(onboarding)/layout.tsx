import type { ReactNode } from 'react';

/**
 * Onboarding route-group layout. Each screen renders its own MobileShell + background so it
 * can control full-bleed slides vs padded forms; this layout is the shared mounting point.
 */
export default function OnboardingLayout({ children }: { children: ReactNode }) {
  return children;
}
