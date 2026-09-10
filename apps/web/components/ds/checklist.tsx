import * as React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * `.chk` — the first-day setup checklist (v9 frame 12).
 *
 * Spec: done = a 26px lime circle with a check; todo = a 26px dashed hair-2 ring.
 * The dashed ring is deliberate — an empty solid circle reads as a disabled control,
 * whereas dashed reads as "not yet".
 */
export interface ChecklistItemProps {
  title: string;
  subtitle?: string;
  done?: boolean;
  /** The row's action — a <Chip> in the spec ("Add", "Set", "Invite", share). */
  action?: React.ReactNode;
  className?: string;
}

export function ChecklistItem({
  title,
  subtitle,
  done = false,
  action,
  className,
}: ChecklistItemProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-[11px] px-gutter py-[11px]",
        "[&:not(:last-child)]:border-b [&:not(:last-child)]:border-hair",
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          "flex size-[26px] shrink-0 items-center justify-center rounded-pill",
          done ? "bg-lime text-pine" : "border-2 border-dashed border-hair-2",
        )}
      >
        {done ? <Check className="size-[13px]" /> : null}
      </span>
      <span className="min-w-0 flex-1">
        <b className="block text-[14.5px] font-heavy text-pine">{title}</b>
        {subtitle ? (
          <p className="mt-px text-2xs font-medium leading-[1.35] text-pine-2">
            {subtitle}
          </p>
        ) : null}
      </span>
      <span className="sr-only">{done ? "Done" : "Not done"}</span>
      {action}
    </div>
  );
}

export function Checklist({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn("py-[3px]", className)}>{children}</div>;
}
