"use client";

import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ChoiceCardProps {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  /** Tint for the icon square, e.g. "bg-live-soft text-live". */
  accent?: string;
  /** The chosen option carries a 2.5px pine outline, not a colour change. */
  selected?: boolean;
  onClick: () => void;
}

/**
 * `.rolec` — the large option card (v9 frame 07, and the create-or-join choice).
 *
 * Spec: radius 24 (`--radius-2xl`), white, `shadow-elev-2`, padding 18, gap 14.
 * Icon square 48px at radius 16. Title 16.5/800, body 12.5 pine-2.
 * Selected = `outline-[2.5px] outline-pine outline-offset-[-1px]` — the spec marks
 * choice with a hard edge rather than a fill, so the card's own tint keeps meaning
 * its category rather than its state.
 */
export function ChoiceCard({
  icon,
  title,
  subtitle,
  accent = "bg-lime-soft text-pine",
  selected = false,
  onClick,
}: ChoiceCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "flex w-full items-center gap-3.5 rounded-2xl bg-white p-[18px] text-left shadow-elev-2",
        "transition-all duration-press active:scale-[0.99]",
        "focus-visible:outline-none focus-visible:shadow-[var(--ring-lime)]",
        selected && "outline outline-[2.5px] -outline-offset-1 outline-pine",
      )}
    >
      <span
        className={cn(
          "flex size-12 shrink-0 items-center justify-center rounded-md [&_svg]:size-[23px]",
          accent,
        )}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[16.5px] font-heavy text-pine">
          {title}
        </span>
        <span className="mt-0.5 block text-xs leading-[1.4] text-pine-2">
          {subtitle}
        </span>
      </span>
      <ChevronRight
        className={cn(
          "size-[19px] shrink-0",
          selected ? "text-pine" : "text-pine-3",
        )}
      />
    </button>
  );
}
