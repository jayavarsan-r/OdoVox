'use client';

import * as React from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ChipOption<T extends string | number> {
  label: string;
  value: T;
}

export interface ChipMultiSelectProps<T extends string | number> {
  options: ChipOption<T>[];
  selected: T[];
  onChange: (next: T[]) => void;
  disabled?: boolean;
}

/** Multi-select pill group (used for weekly off-days and specializations). */
export function ChipMultiSelect<T extends string | number>({
  options,
  selected,
  onChange,
  disabled,
}: ChipMultiSelectProps<T>) {
  const toggle = (value: T) => {
    if (disabled) return;
    onChange(
      selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value],
    );
  };

  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const active = selected.includes(opt.value);
        return (
          <button
            key={String(opt.value)}
            type="button"
            aria-pressed={active}
            disabled={disabled}
            onClick={() => toggle(opt.value)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-pill border px-3.5 py-2 text-sm font-medium transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              active
                ? 'border-ink bg-ink text-paper'
                : 'border-border bg-surface text-foreground hover:bg-muted',
            )}
          >
            {active ? <Check className="size-3.5" /> : null}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
