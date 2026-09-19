"use client";

import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

/**
 * `.tl` — the patient history timeline (v9 frame 42).
 *
 * "History is a spine of Odo moods: happy tooth = completed treatment, calm = routine
 *  visit, red node = permanent medical fact (rides the timeline forever, styled like
 *  the verification rail)."
 *
 * That last one matters clinically: an allergy recorded in 2019 is not an event that
 * scrolled away, it is a standing fact — so it keeps the crit rail wherever it appears,
 * exactly as the drug-conflict row does.
 *
 * Motion (spec): spine draws over --spine-draw, cards stagger --stagger-timeline,
 * nodes pop last. Reduced motion → everything appears static, per §12 and governance §1.
 */
export interface TimelineEntry {
  id: string;
  /** Month heading above this entry, when it starts a new month. */
  monthLabel?: string;
  title: React.ReactNode;
  /** Right-aligned date, e.g. "TODAY" or "28 JUN". */
  stamp?: string;
  /** <Mini> chips: tooth, fee, doctor, confirmation. */
  glyphs?: React.ReactNode;
  /** Node contents — a mascot mood, or an alert glyph for a medical fact. */
  node?: React.ReactNode;
  /** A permanent medical fact: keeps the crit rail, like the conflict row. */
  permanent?: boolean;
  onClick?: () => void;
}

export function Timeline({
  entries,
  className,
}: {
  entries: TimelineEntry[];
  className?: string;
}) {
  const reduced = useReducedMotion();

  if (entries.length === 0) return null;

  return (
    <div className={cn("relative mt-1.5 pl-[38px]", className)}>
      {/* `.tl:before` — the spine, drawn downward on mount */}
      <motion.span
        aria-hidden
        className="absolute bottom-[14px] left-[13px] top-2.5 w-[2.5px] origin-top rounded-sm bg-[#E2E7D6]"
        initial={reduced ? false : { scaleY: 0 }}
        animate={{ scaleY: 1 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      />

      <ol>
        {entries.map((entry, i) => (
          <li key={entry.id}>
            {entry.monthLabel ? (
              <h3 className="mb-[7px] mt-[13px] text-micro font-heavy tracking-eyebrow text-pine-3">
                {entry.monthLabel}
              </h3>
            ) : null}

            <motion.div
              className="relative"
              initial={reduced ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: reduced ? 0 : i * 0.045, duration: 0.24 }}
            >
              {/* `.tlnode` — pops in last */}
              <motion.span
                aria-hidden
                className={cn(
                  "absolute left-0 top-1 flex size-7 items-center justify-center rounded-pill bg-white shadow-[0_4px_10px_rgba(31,42,35,0.12)]",
                  entry.permanent && "bg-[#FBEDEC] text-crit",
                )}
                style={{ left: -38 + 13 - 14 }}
                initial={reduced ? false : { scale: 0 }}
                animate={{ scale: 1 }}
                transition={{
                  delay: reduced ? 0 : 0.35 + i * 0.045,
                  type: "spring",
                  stiffness: 420,
                  damping: 24,
                }}
              >
                {entry.node}
              </motion.span>

              {/* `.tlcard` — a mini bento: procedure, tooth, fee, doctor */}
              <Card
                onClick={entry.onClick}
                permanent={entry.permanent}
                title={entry.title}
                stamp={entry.stamp}
                glyphs={entry.glyphs}
              />
            </motion.div>
          </li>
        ))}
      </ol>
    </div>
  );
}

function Card({
  title,
  stamp,
  glyphs,
  permanent,
  onClick,
}: Pick<
  TimelineEntry,
  "title" | "stamp" | "glyphs" | "permanent" | "onClick"
>) {
  const inner = (
    <>
      <span className="flex items-center justify-between gap-3">
        <b
          className={cn(
            "text-sm font-heavy",
            permanent ? "text-crit" : "text-pine",
          )}
        >
          {title}
        </b>
        {stamp ? (
          <span className="shrink-0 text-micro font-heavy text-pine-3">
            {stamp}
          </span>
        ) : null}
      </span>
      {glyphs ? (
        <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
          {glyphs}
        </span>
      ) : null}
    </>
  );

  const classes = cn(
    "mb-[9px] block w-full rounded-lg bg-white px-[13px] py-[11px] text-left shadow-elev-1",
    // Same rail as the drug-conflict row: red means "standing fact you must act on".
    permanent && "shadow-[inset_3.5px_0_0_var(--crit),var(--elev-1)]",
  );

  if (!onClick) return <div className={classes}>{inner}</div>;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        classes,
        "focus-visible:outline-none focus-visible:shadow-[var(--ring-lime)]",
      )}
    >
      {inner}
    </button>
  );
}
