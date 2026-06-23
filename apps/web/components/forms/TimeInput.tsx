'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export interface TimeInputProps {
  value: string; // HH:mm
  onChange: (value: string) => void;
  id?: string;
  disabled?: boolean;
  invalid?: boolean;
}

/** Mobile-friendly HH:mm picker backed by the native time input. */
export function TimeInput({ value, onChange, id, disabled, invalid }: TimeInputProps) {
  return (
    <input
      id={id}
      type="time"
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        'flex h-11 w-full rounded-md border bg-surface px-3 text-sm shadow-soft transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        'disabled:cursor-not-allowed disabled:opacity-50',
        invalid ? 'border-danger' : 'border-input',
      )}
    />
  );
}
