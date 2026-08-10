"use client";

import { Delete } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The spec's `.keypad` (frame 03), measured:
 *
 *   .keypad     margin-top:auto; grid 1fr 1fr 1fr; gap:7px; padding-bottom:16px
 *   .key        48px, radius 12, white, box-shadow 0 3px 10px rgba(31,42,35,.06)
 *   .key b      19px/600, line-height 1
 *   .key s      8.5px/700, letter-spacing .14em, --pine-3
 *   .key.ghost  transparent, no shadow
 *
 * It APPENDS to whatever the field already holds and never validates — the caller keeps
 * every rule it had. On /phone that means `IndianPhone.safeParse` still gates the CTA and
 * the rate-limit handling is untouched; this component only produces digits.
 *
 * Real buttons, not divs: the pad is reachable by keyboard and announced by a screen
 * reader, and the native keyboard stays available underneath for anyone who prefers it.
 */
const KEYS: { digit: string; letters?: string }[] = [
  { digit: "1" },
  { digit: "2", letters: "ABC" },
  { digit: "3", letters: "DEF" },
  { digit: "4", letters: "GHI" },
  { digit: "5", letters: "JKL" },
  { digit: "6", letters: "MNO" },
  { digit: "7", letters: "PQRS" },
  { digit: "8", letters: "TUV" },
  { digit: "9", letters: "WXYZ" },
];

export function NumericKeypad({
  onDigit,
  onBackspace,
  className,
}: {
  onDigit: (digit: string) => void;
  onBackspace: () => void;
  className?: string;
}) {
  const key =
    "flex h-12 flex-col items-center justify-center rounded-[12px] bg-card shadow-[0_3px_10px_rgba(31,42,35,0.06)] active:opacity-70";

  return (
    <div
      className={cn("grid grid-cols-3 gap-[7px] pb-4", className)}
      role="group"
      aria-label="Number pad"
    >
      {KEYS.map((k) => (
        <button
          key={k.digit}
          type="button"
          onClick={() => onDigit(k.digit)}
          aria-label={k.digit}
          className={key}
        >
          <b className="text-[19px] font-semibold leading-none text-pine">
            {k.digit}
          </b>
          {k.letters ? (
            <span className="text-[8.5px] font-bold tracking-[0.14em] text-pine-3">
              {k.letters}
            </span>
          ) : (
            <span className="text-[8.5px] leading-none">&nbsp;</span>
          )}
        </button>
      ))}
      {/* The frame's bottom row is ghost · 0 · ghost-with-backspace. */}
      <span aria-hidden />
      <button
        type="button"
        onClick={() => onDigit("0")}
        aria-label="0"
        className={key}
      >
        <b className="text-[19px] font-semibold leading-none text-pine">0</b>
        <span className="text-[8.5px] leading-none">&nbsp;</span>
      </button>
      <button
        type="button"
        onClick={onBackspace}
        aria-label="Delete last digit"
        className="flex h-12 items-center justify-center rounded-[12px] bg-transparent text-pine active:opacity-70"
      >
        <Delete className="size-[19px]" />
      </button>
    </div>
  );
}
