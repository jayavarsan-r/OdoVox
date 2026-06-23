'use client';

import * as React from 'react';
import { Minus, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface StepperProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  disabled?: boolean;
}

/** Numeric stepper with clamped +/- controls (e.g. chair count). */
export function Stepper({ value, onChange, min = 0, max = 99, disabled }: StepperProps) {
  const clamp = (n: number) => Math.max(min, Math.min(max, n));
  const set = (n: number) => !disabled && onChange(clamp(n));

  return (
    <div className="inline-flex items-center rounded-md border border-input bg-surface shadow-soft">
      <button
        type="button"
        aria-label="Decrease"
        disabled={disabled || value <= min}
        onClick={() => set(value - 1)}
        className={cn(
          'flex size-11 items-center justify-center rounded-l-md transition-colors hover:bg-muted',
          'disabled:pointer-events-none disabled:opacity-40',
        )}
      >
        <Minus className="size-4" />
      </button>
      <div className="flex h-11 w-14 items-center justify-center border-x border-border text-base font-semibold tabular-nums">
        {value}
      </div>
      <button
        type="button"
        aria-label="Increase"
        disabled={disabled || value >= max}
        onClick={() => set(value + 1)}
        className={cn(
          'flex size-11 items-center justify-center rounded-r-md transition-colors hover:bg-muted',
          'disabled:pointer-events-none disabled:opacity-40',
        )}
      >
        <Plus className="size-4" />
      </button>
    </div>
  );
}
