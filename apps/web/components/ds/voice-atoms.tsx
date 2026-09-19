"use client";

import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

/**
 * The seven atoms unique to `odovox-v10-talk.html`.
 *
 * v10's `:root` token block is byte-identical to v9's, so the second spec needs no new
 * tokens — only these seven surfaces:
 *
 *   .wave · .tsc · .intent · .pf · .obub · .saychip · .cmdrow
 *
 * They compose the Talk-to-Odo sheet (frames v10-01…05), built in Task 32.
 */

/* ── .wave — live amplitude bars ─────────────────────────────────────────────── */

export interface WaveProps {
  /** Normalised 0–1 amplitudes, newest last. */
  amplitudes: number[];
  /** Smaller variant used in the "still listening" footer (v10-03). */
  size?: "md" | "sm";
  className?: string;
}

export function Wave({ amplitudes, size = "md", className }: WaveProps) {
  const reduced = useReducedMotion();
  const maxH = size === "md" ? 26 : 13;

  // Reduced motion gets a STATIC level bar, not a slower animation — a moving
  // waveform is exactly the kind of continuous motion the preference asks us to drop.
  if (reduced) {
    const avg = amplitudes.length
      ? amplitudes.reduce((a, b) => a + b, 0) / amplitudes.length
      : 0;
    return (
      <div
        className={cn(
          "h-[3px] w-full max-w-40 rounded-sm bg-hair-2",
          className,
        )}
        role="img"
        aria-label="Listening"
      >
        <div
          className="h-full rounded-sm bg-pine"
          style={{ width: `${Math.round(avg * 100)}%` }}
        />
      </div>
    );
  }

  return (
    <div
      className={cn("flex items-end gap-[3px]", className)}
      style={{ height: maxH }}
      role="img"
      aria-label="Listening"
    >
      {amplitudes.map((a, i) => (
        <motion.span
          key={i}
          className="w-[3.5px] rounded-sm bg-pine"
          animate={{ height: Math.max(4, Math.min(1, a) * maxH) }}
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
        />
      ))}
    </div>
  );
}

/* ── .tsc — the live transcript ──────────────────────────────────────────────── */

export interface TranscriptProps {
  /** Words already finalised by the recogniser. */
  text: string;
  /** Interim words — rendered ghosted, because they may still change. */
  pending?: string;
  /** Substrings Odo has recognised as entities; each gets the soft lime lift. */
  entities?: string[];
  className?: string;
}

export function Transcript({
  text,
  pending,
  entities = [],
  className,
}: TranscriptProps) {
  return (
    <p
      className={cn(
        "text-[19.5px] font-bold leading-[1.5] tracking-[-0.015em] text-pine",
        className,
      )}
      aria-live="polite"
    >
      {highlightEntities(text, entities)}
      {pending ? (
        <span className="font-medium text-pine-3">{pending}</span>
      ) : null}
      <span className="ml-px inline-block h-5 w-0.5 -translate-y-[3px] bg-sky align-middle" />
    </p>
  );
}

/** Wrap each recognised entity in the lime lift, leaving the rest untouched. */
function highlightEntities(text: string, entities: string[]): React.ReactNode {
  const found = entities.filter((e) => e && text.includes(e));
  if (found.length === 0) return text;

  // Longest-first so "Rajasimhan Kumar" wins over "Rajasimhan".
  const pattern = new RegExp(
    `(${found
      .slice()
      .sort((a, b) => b.length - a.length)
      .map((e) => e.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      .join("|")})`,
  );

  return text.split(pattern).map((part, i) =>
    found.includes(part) ? (
      <b key={i} className="rounded-[5px] bg-lime-soft px-[3px] font-bold">
        {part}
      </b>
    ) : (
      <React.Fragment key={i}>{part}</React.Fragment>
    ),
  );
}

/* ── .intent — the parsed-intent chip ────────────────────────────────────────── */

export function IntentChip({
  icon,
  children,
  className,
}: {
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-[27px] items-center gap-[7px] rounded-[9px] bg-pine px-3",
        "text-micro font-heavy tracking-[0.09em] text-lime [&_svg]:size-[13px]",
        className,
      )}
    >
      {icon}
      {children}
    </span>
  );
}

/* ── .pf — a parsed field row ────────────────────────────────────────────────── */

export interface ParsedFieldProps {
  label: string;
  /** The parsed value, or undefined for a field Odo did not hear. */
  value?: React.ReactNode;
  /**
   * Below Odo's confidence threshold. Gets the dotted warn underline — NEVER silently
   * guessed. This underline is the correction affordance (v10-04).
   */
  lowConfidence?: boolean;
  /** Mic affordance or a status <Mini>. */
  trailing?: React.ReactNode;
  onClick?: () => void;
  className?: string;
}

export function ParsedField({
  label,
  value,
  lowConfidence = false,
  trailing,
  onClick,
  className,
}: ParsedFieldProps) {
  const body = (
    <>
      <span className="w-[86px] shrink-0 text-eyebrow font-heavy tracking-[0.1em] text-pine-3">
        {label}
      </span>
      <span
        className={cn(
          "min-w-0 flex-1 text-md font-heavy tracking-snug",
          value ? "text-pine" : "text-pine-3",
        )}
      >
        {value ? (
          lowConfidence ? (
            <em className="not-italic border-b-[2.5px] border-dotted border-warn pb-px">
              {value}
            </em>
          ) : (
            value
          )
        ) : (
          "—"
        )}
      </span>
      {trailing}
    </>
  );

  const classes = cn(
    "flex w-full items-center gap-[11px] px-gutter py-[11px] text-left",
    "[&:not(:last-child)]:border-b [&:not(:last-child)]:border-hair",
    className,
  );

  if (!onClick) return <div className={classes}>{body}</div>;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Edit ${label}${lowConfidence ? " — not heard clearly" : ""}`}
      className={cn(
        classes,
        "focus-visible:outline-none focus-visible:shadow-[var(--ring-lime)]",
      )}
    >
      {body}
    </button>
  );
}

/* ── .obub — Odo's speech bubble ─────────────────────────────────────────────── */

/**
 * The ONLY surface in the product where Odo speaks — it was invited. Everywhere else
 * the mascot is silent decoration, and the doc's mascot law keeps it away from money
 * and safety entirely.
 */
export function OdoBubble({
  avatar,
  children,
  className,
}: {
  avatar?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mt-3 flex items-start gap-2.5 px-gutter", className)}>
      {avatar}
      <div className="rounded-[5px_18px_18px_18px] bg-white px-3.5 py-[11px] text-sm font-bold leading-[1.45] text-pine shadow-[0_7px_18px_rgba(31,42,35,0.08)]">
        {children}
      </div>
    </div>
  );
}

/* ── .saychip — a suggestion / next-act chip ─────────────────────────────────── */

export function SayChip({
  children,
  primary = false,
  onClick,
  className,
}: {
  children: React.ReactNode;
  primary?: boolean;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex h-[38px] items-center rounded-[19px] px-[15px] text-body font-heavy text-pine",
        "shadow-[0_6px_14px_rgba(31,42,35,0.08)] transition-transform duration-press active:scale-[0.97]",
        "focus-visible:outline-none focus-visible:shadow-[var(--ring-lime)]",
        primary ? "bg-lime" : "bg-white",
        className,
      )}
    >
      {children}
    </button>
  );
}

/* ── .cmdrow — a "what can I say" grammar row ────────────────────────────────── */

export function CmdRow({
  icon,
  iconTone = "lime",
  title,
  example,
  onClick,
  className,
}: {
  icon: React.ReactNode;
  iconTone?: "lime" | "sky" | "lav" | "warn" | "live" | "neutral";
  title: string;
  /** Rendered italic — it is a quotation of speech, not UI copy. */
  example: string;
  onClick?: () => void;
  className?: string;
}) {
  const tone = {
    lime: "bg-lime-soft text-pine",
    sky: "bg-sky-soft text-sky",
    lav: "bg-lav-soft text-lav",
    warn: "bg-warn-soft text-warn",
    live: "bg-live-soft text-live",
    neutral: "bg-[rgba(31,42,35,0.05)] text-pine-2",
  }[iconTone];

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-start gap-3 px-gutter py-[11px] text-left",
        "[&:not(:last-child)]:border-b [&:not(:last-child)]:border-hair",
        "focus-visible:outline-none focus-visible:shadow-[var(--ring-lime)]",
        className,
      )}
    >
      <span
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-sm [&_svg]:size-4",
          tone,
        )}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <b className="block text-sm font-heavy text-pine">{title}</b>
        <p className="mt-0.5 text-xs font-medium italic text-pine-2">
          {example}
        </p>
      </span>
    </button>
  );
}
