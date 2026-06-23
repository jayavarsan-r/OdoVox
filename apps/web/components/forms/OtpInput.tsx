'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export interface OtpInputProps {
  value: string; // up to `length` digits
  onChange: (otp: string) => void;
  onComplete?: (otp: string) => void;
  length?: number;
  autoFocus?: boolean;
  invalid?: boolean;
  disabled?: boolean;
}

/**
 * Accessible 6-box OTP entry: a single visually-hidden input drives focus, paste and
 * keyboard, while the boxes are presentational. Auto-advances and supports paste.
 */
export function OtpInput({
  value,
  onChange,
  onComplete,
  length = 6,
  autoFocus,
  invalid,
  disabled,
}: OtpInputProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [focused, setFocused] = React.useState(false);

  const setValue = (next: string) => {
    const digits = next.replace(/\D+/g, '').slice(0, length);
    onChange(digits);
    if (digits.length === length) onComplete?.(digits);
  };

  return (
    <div
      className="relative"
      onClick={() => inputRef.current?.focus()}
      role="group"
      aria-label={`${length}-digit verification code`}
    >
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={length}
        autoFocus={autoFocus}
        disabled={disabled}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        aria-label="Verification code"
      />
      <div className="flex justify-between gap-2">
        {Array.from({ length }).map((_, i) => {
          const char = value[i] ?? '';
          const isActive = focused && (i === value.length || (i === length - 1 && value.length === length));
          return (
            <div
              key={i}
              className={cn(
                'flex h-14 flex-1 items-center justify-center rounded-md border bg-surface text-xl font-semibold shadow-soft transition-colors',
                invalid
                  ? 'border-danger'
                  : isActive
                    ? 'border-ink ring-2 ring-ring'
                    : char
                      ? 'border-border-strong'
                      : 'border-input',
              )}
            >
              {char}
            </div>
          );
        })}
      </div>
    </div>
  );
}
