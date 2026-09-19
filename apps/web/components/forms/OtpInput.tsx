"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

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
 *
 * Boxes follow the spec's `.otp i`, measured: 56px tall, radius 16, white, lifted by
 * shadow with no border, 22px/800 with tabular numerals. The active box takes a 2.5px
 * sky outline inset by 1px; on a wrong code every box takes the same outline in crit.
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
    const digits = next.replace(/\D+/g, "").slice(0, length);
    onChange(digits);
    // Fire only on the TRANSITION to complete, never on every edit while already full.
    // Frame 05 keeps a wrong code in its boxes so one digit can be corrected — but with
    // `digits.length === length` alone, correcting that digit re-submits on the keystroke
    // and walks straight into the verify rate limit. Growing into completeness is what
    // "complete" actually means; a correction is submitted with the Verify button.
    if (digits.length === length && value.length < length) onComplete?.(digits);
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
      <div className="flex justify-between gap-[9px]">
        {Array.from({ length }).map((_, i) => {
          const char = value[i] ?? "";
          const isActive =
            focused &&
            (i === value.length ||
              (i === length - 1 && value.length === length));
          return (
            <div
              key={i}
              className={cn(
                "flex h-14 flex-1 items-center justify-center rounded-[16px] bg-card text-[22px] font-heavy tabular-nums text-pine shadow-stat transition-[outline-color]",
                "outline-offset-[-1px]",
                invalid
                  ? "outline outline-[2.5px] outline-crit"
                  : isActive
                    ? "outline outline-[2.5px] outline-sky"
                    : "outline-none",
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
