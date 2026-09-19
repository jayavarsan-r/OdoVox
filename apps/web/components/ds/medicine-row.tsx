"use client";

import * as React from "react";
import { AlertTriangle } from "lucide-react";
import { DoseDots } from "@/components/ds/dose-dots";
import { Mini } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * `.meds` / `.medrow` — the medicine list (v9 frames 27–29).
 *
 * Frame 29 is the requirement that shaped this component:
 *
 *   "Medicines were never a bento tile's job — they're a full-width list that grows
 *    row by row, one line each, dose chips right-aligned. 7, 10, 12 — same anatomy,
 *    no squeezing."
 *
 * So the row must render identically at n=2 and n=12. Nothing here sizes to the count.
 */
export function MedicineList({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn("rounded-xl bg-white py-[3px] shadow-elev-1", className)}
    >
      {children}
    </div>
  );
}

export interface MedicineRowProps {
  name: string;
  /** "1-1-1 · 5 days" — right-aligned, one line. */
  dose?: string;
  /** Frequency code (OD/BD/TID/QID/SOS) for the ●○● dots when expanded. */
  frequency?: string | null;
  /** "AFTER FOOD", "2 DAYS · IF PAIN" */
  doseCaption?: string;
  /**
   * A safety conflict. The spec is emphatic about the treatment (frame 27):
   * "The flag is on the drug, not in a banner — a Persian-red rail + red drug name +
   *  one factual line (WHAT the allergy is, WHEN recorded), the way a chart annotation
   *  reads. No pink washes, no AI voice."
   */
  conflict?: {
    /** e.g. "Penicillin allergy — recorded 2019, reaction: rash" */
    fact: string;
    /** The inline resolution, e.g. a "Swap → Azithro 500" chip. */
    action?: React.ReactNode;
  };
  /** Shown after a swap: a one-line green fact plus Undo. No celebration banner. */
  resolved?: {
    note: string;
    onUndo?: () => void;
  };
  onClick?: () => void;
  className?: string;
}

export function MedicineRow({
  name,
  dose,
  frequency,
  doseCaption,
  conflict,
  resolved,
  onClick,
  className,
}: MedicineRowProps) {
  const body = (
    <>
      <span className="flex items-center justify-between gap-3">
        <b
          className={cn(
            "text-[14.5px] font-heavy tracking-snug",
            conflict ? "text-crit" : "text-pine",
          )}
        >
          {name}
        </b>
        {dose ? <Mini tone="neutral">{dose}</Mini> : null}
      </span>

      {conflict ? (
        <span className="mt-1.5 flex items-center gap-2">
          <AlertTriangle className="size-3.5 shrink-0 text-crit" />
          <span className="flex-1 text-xs font-bold text-crit">
            {conflict.fact}
          </span>
          <span className="pointer-events-auto relative z-10">
            {conflict.action}
          </span>
        </span>
      ) : resolved ? (
        <span className="mt-[5px] flex items-center gap-2">
          <DoseDots frequency={frequency} />
          <span className="flex-1 text-3xs font-bold text-live">
            {resolved.note}
          </span>
          {resolved.onUndo ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                resolved.onUndo?.();
              }}
              className="pointer-events-auto relative z-10 text-2xs font-heavy text-pine-2"
            >
              Undo
            </button>
          ) : null}
        </span>
      ) : frequency || doseCaption ? (
        <span className="mt-[5px] block">
          <DoseDots frequency={frequency} caption={doseCaption} />
        </span>
      ) : null}
    </>
  );

  const classes = cn(
    "block w-full px-[18px] py-2.5 text-left [&:not(:last-child)]:border-b [&:not(:last-child)]:border-hair",
    // Global Constraint 8: a RAIL on the offending row. Never a wash, never a banner.
    conflict && "shadow-[inset_3.5px_0_0_var(--crit)]",
    className,
  );

  if (!onClick) return <div className={classes}>{body}</div>;

  /**
   * The row is a DIV with a stretched hit-area button behind its content — not a <button>
   * wrapping everything.
   *
   * It used to be the wrapper, which put the conflict's "Remove" chip and the resolved
   * row's "Undo" INSIDE a button. That is invalid HTML (React said so in the console) and
   * it broke the row's accessible name: a button's name is the concatenation of everything
   * inside it, so the row announced itself as "Amoxicillin 500mg TID 5 days Allergy
   * conflict … Remove". A screen-reader user could not tell the row from the action, and
   * `getByRole("button", { name: /remove/i })` matched the ROW first — which is how this
   * was found.
   *
   * Now the hit area sits at z-0 under content that ignores pointer events, and the real
   * action buttons opt back in with `pointer-events-auto z-10`. Visually identical; the
   * row gets an explicit name of its own, and the actions are siblings rather than
   * descendants.
   */
  return (
    <div className={cn(classes, "relative")}>
      <button
        type="button"
        onClick={onClick}
        aria-label={`Edit ${name}`}
        className="absolute inset-0 z-0 rounded-[inherit] focus-visible:outline-none focus-visible:shadow-[var(--ring-lime)]"
      />
      <span className="pointer-events-none relative block">{body}</span>
    </div>
  );
}
