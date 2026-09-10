import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * `.paper` — the clinical record block (frames 27–30, 43).
 *
 * v9 pulled findings and procedure OUT of the bento and gave them their own surface:
 * a hairline left rule on the canvas, reading like a chart note rather than a data
 * tile. The size is the point — **16.5px / 1.7** is the chair-side legibility rule,
 * and the spec makes it the standard for record text everywhere, not just here.
 *
 * Never nest this inside a bento tile. That is the arrangement the frame explicitly
 * replaced.
 */
export interface PaperBlockProps {
  children: React.ReactNode;
  className?: string;
}

export function PaperBlock({ children, className }: PaperBlockProps) {
  return (
    <div
      className={cn(
        "mt-[15px] border-l-[2.5px] border-[#DCE3CE] pl-[15px]",
        className,
      )}
    >
      {children}
    </div>
  );
}

export interface PaperSectionProps {
  /** FINDINGS · PROCEDURE · INSTRUCTIONS TO PATIENT */
  label: string;
  children: React.ReactNode;
  className?: string;
}

export function PaperSection({
  label,
  children,
  className,
}: PaperSectionProps) {
  return (
    <div className={cn("[&+&]:mt-[15px]", className)}>
      <span className="block text-micro font-heavy tracking-eyebrow text-pine-3">
        {label}
      </span>
      <p
        className="mt-[5px] font-regular text-pine"
        style={{
          fontSize: "var(--prose-record-size)",
          lineHeight: "var(--prose-record-leading)",
        }}
      >
        {children}
      </p>
    </div>
  );
}

/**
 * `.vfy2` — an uncertain value the doctor must confirm, inline in the prose
 * ("Working length ⟨21 mm · verify⟩").
 *
 * Amber, not red: this is "check me", not "act now". Red is reserved for the
 * conflict rail (Global Constraint 8). Tapping puts the cursor on the number —
 * the chip is an affordance, not a decoration, so it renders as a button whenever
 * an onClick is supplied.
 */
export interface VerifyChipProps {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
}

export function VerifyChip({ children, onClick, className }: VerifyChipProps) {
  const classes = cn(
    "whitespace-nowrap rounded-[6px] bg-[#FFF6E8] px-[7px] py-px text-sm font-heavy text-warn",
    className,
  );
  if (!onClick) return <span className={classes}>{children}</span>;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        classes,
        "focus-visible:outline-none focus-visible:shadow-[var(--ring-lime)]",
      )}
    >
      {children}
    </button>
  );
}
