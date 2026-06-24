'use client';

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

/**
 * Light glassmorphic surface. Use ONLY where specified (modal/sheet headers, dev
 * banner, /done celebration, certain stat tiles) — never on lists/forms (perf).
 * See design-system.md §2 + §12.
 */
const glassCard = cva('rounded-xl backdrop-blur-glass-md shadow-elev-2', {
  variants: {
    tone: {
      light: 'bg-glass-light text-ink',
      dark: 'bg-glass-dark text-paper',
      lime: 'bg-glass-lime text-ink',
      sage: 'bg-glass-sage text-ink',
    },
    border: {
      soft: 'border',
      none: 'border-0',
    },
  },
  compoundVariants: [
    { tone: 'dark', border: 'soft', class: 'border-[var(--glass-border-dark)]' },
    { tone: 'light', border: 'soft', class: 'border-[var(--glass-border-light)]' },
    { tone: 'lime', border: 'soft', class: 'border-[var(--glass-border-light)]' },
    { tone: 'sage', border: 'soft', class: 'border-[var(--glass-border-light)]' },
  ],
  defaultVariants: { tone: 'light', border: 'soft' },
});

export interface GlassCardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof glassCard> {}

export function GlassCard({ tone, border, className, children, ...props }: GlassCardProps) {
  return (
    <div className={cn(glassCard({ tone, border }), className)} {...props}>
      {children}
    </div>
  );
}
