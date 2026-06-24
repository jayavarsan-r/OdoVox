'use client';

import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

/**
 * Small number + label tile for dashboards (Today stats, Needs You counts).
 * Numbers use tabular figures via the mono face. See design-system.md §3 + §6.
 */
const statTile = cva('rounded-lg border', {
  variants: {
    variant: {
      default: 'bg-surface border-border',
      lime: 'bg-lime-soft border-lime/40',
      sage: 'bg-sage-tint border-sage/30',
      warning: 'bg-peach-soft border-peach/50',
    },
    size: {
      sm: 'p-3',
      md: 'p-4',
    },
  },
  defaultVariants: { variant: 'default', size: 'md' },
});

export interface StatTileProps extends VariantProps<typeof statTile> {
  value: string | number;
  label: string;
  className?: string;
}

export function StatTile({ value, label, variant, size, className }: StatTileProps) {
  return (
    <div className={cn(statTile({ variant, size }), className)}>
      <p className="font-mono text-2xl font-semibold tabular-nums tracking-tight text-ink">
        {value}
      </p>
      <p className="mt-0.5 text-xs font-medium text-text-muted">{label}</p>
    </div>
  );
}
