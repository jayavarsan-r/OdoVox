'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export interface PhoneInputProps {
  value: string; // up to 10 raw digits
  onChange: (digits: string) => void;
  autoFocus?: boolean;
  disabled?: boolean;
  invalid?: boolean;
  id?: string;
}

function format(digits: string): string {
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)} ${digits.slice(5, 10)}`;
}

/** +91-locked 10-digit mobile input, auto-formatted as "XXXXX XXXXX". */
export function PhoneInput({
  value,
  onChange,
  autoFocus,
  disabled,
  invalid,
  id,
}: PhoneInputProps) {
  const handle = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D+/g, '').slice(0, 10);
    onChange(digits);
  };

  return (
    <div
      className={cn(
        'flex h-12 items-center rounded-md border bg-surface shadow-soft transition-colors',
        'focus-within:ring-2 focus-within:ring-ring',
        invalid ? 'border-danger' : 'border-input',
        disabled && 'opacity-50',
      )}
    >
      <span className="flex items-center gap-1 border-r border-border px-3 text-sm font-medium text-muted-foreground">
        <span aria-hidden>🇮🇳</span> +91
      </span>
      <input
        id={id}
        type="tel"
        inputMode="numeric"
        autoComplete="tel-national"
        autoFocus={autoFocus}
        disabled={disabled}
        value={format(value)}
        onChange={handle}
        placeholder="98765 43210"
        className="h-full flex-1 rounded-r-md bg-transparent px-3 text-base tracking-wide outline-none placeholder:text-muted-foreground"
        aria-label="Mobile number"
      />
    </div>
  );
}
