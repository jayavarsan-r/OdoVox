"use client";

import * as React from "react";
import { Mic } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PhoneInputProps {
  value: string; // up to 10 raw digits
  onChange: (digits: string) => void;
  autoFocus?: boolean;
  disabled?: boolean;
  invalid?: boolean;
  /** A value that arrived by voice and has not been reviewed — the lime spine (frame 36). */
  voiced?: boolean;
  id?: string;
  /** The spec's `.mic-a` affordance. Frames 03 and 08 carry it; omit where they don't. */
  onDictate?: () => void;
}

function format(digits: string): string {
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)} ${digits.slice(5, 10)}`;
}

/**
 * +91-locked 10-digit mobile input, auto-formatted as "XXXXX XXXXX".
 *
 * The frame's `.field`, measured: 56px tall, radius 18, white, no border — it lifts off
 * the canvas with `--shadow-field` alone. The `.cc` prefix is 15px/800 pine-2 with a
 * hairline divider; the value is 17.5px/700 with tabular numerals so the digits do not
 * jitter as they are typed.
 */
export function PhoneInput({
  value,
  onChange,
  autoFocus,
  disabled,
  invalid,
  voiced,
  id,
  onDictate,
}: PhoneInputProps) {
  const handle = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D+/g, "").slice(0, 10);
    onChange(digits);
  };

  return (
    <div
      className={cn(
        "flex h-14 min-w-0 items-center gap-2.5 rounded-[18px] bg-card px-4 shadow-field transition-shadow",
        "focus-within:shadow-[var(--ring-lime)]",
        invalid && "shadow-[0_0_0_2px_var(--crit)]",
        // The spine matches <Input voiced> so a voice-filled phone reads the same as every
        // other unreviewed field on the form.
        voiced && "border-l-[3px] border-l-lime pl-[13px]",
        disabled && "opacity-50",
      )}
    >
      <span className="flex shrink-0 items-center gap-1 border-r border-hair-2 pr-2.5 text-[15px] font-heavy text-pine-2">
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
        /* `min-w-0` is load-bearing: a native input carries an intrinsic width from its
           default `size`, and flex-1 alone will not shrink below it — so in any column
           narrower than ~250px the field simply overflowed its container and ran off the
           screen. Only showed up once this sat beside a 96px AGE field. */
        className="h-full min-w-0 flex-1 bg-transparent text-[17.5px] font-bold tabular-nums text-pine outline-none placeholder:font-medium placeholder:text-pine-3"
        aria-label="Mobile number"
      />
      {onDictate ? (
        <button
          type="button"
          onClick={onDictate}
          aria-label="Say your number"
          className="flex size-[38px] shrink-0 items-center justify-center rounded-[13px] bg-lime-soft text-pine"
        >
          <Mic className="size-[17px]" />
        </button>
      ) : null}
    </div>
  );
}
