/**
 * <EmptyState> media-resolution logic. Mascot and illustration are mutually
 * exclusive: mascot is for emotional moments, illustration for "coming soon".
 * Unit-tested under node. See docs/design-system.md §11.
 */

import type { MascotPose } from './mascot';

export type EmptyStateVariant = 'page' | 'card' | 'inline';
export type EmptyStateMascot = MascotPose | 'none';
export type EmptyMediaKind = 'mascot' | 'illustration' | 'none';

/** Container tones for the small icon used by the `inline` (and icon-only) variants. */
export type EmptyStateIconTone = 'sky' | 'info' | 'sage' | 'peach' | 'neutral';

/**
 * Decide which medium <EmptyState> renders. Illustration wins if both are
 * supplied (defensive — that combination is a caller error per §11/§12).
 */
export function resolveEmptyMedia(opts: {
  mascot?: EmptyStateMascot;
  hasIllustration?: boolean;
}): EmptyMediaKind {
  if (opts.hasIllustration) return 'illustration';
  if (opts.mascot && opts.mascot !== 'none') return 'mascot';
  return 'none';
}
