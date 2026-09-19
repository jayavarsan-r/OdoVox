import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * v9 has two chip sizes, and they are not interchangeable:
 *
 *   `.gchip` (size="chip") — 28px pill, 12.5/700. Filters, actions, status you tap.
 *   `.mini`  (size="mini") — 22px, radius 7, 11/800. The dense glyph strip under a
 *                            patient name: tooth number, sitting dots, dues, ETA.
 *
 * Every tone is a {soft background, saturated same-hue text} pair — the regularity is
 * what makes the chip language read as one system rather than assorted badges.
 *
 * `pine` is selection (a filter chip that is ON). The semantic tones are STATUS, not
 * selection — the spec is explicit that the two must never be confused.
 */
const badgeVariants = cva(
  "inline-flex shrink-0 items-center whitespace-nowrap [&_svg]:shrink-0",
  {
    variants: {
      tone: {
        neutral: "bg-[rgba(31,42,35,0.05)] text-pine",
        pine: "bg-pine text-white",
        lime: "bg-lime text-pine",
        "lime-soft": "bg-lime-soft text-[#5c7013]",
        sky: "bg-sky-soft text-sky",
        live: "bg-live-soft text-live",
        warn: "bg-warn-soft text-warn",
        crit: "bg-crit-soft text-crit",
        lav: "bg-lav-soft text-lav",
        white: "bg-white text-pine",
      },
      size: {
        chip: "h-7 gap-[5px] rounded-pill px-[11px] text-xs font-semibold [&_svg]:size-[13px]",
        mini: "h-[22px] gap-1 rounded-2xs px-2 text-3xs font-heavy [&_svg]:size-3",
      },
    },
    defaultVariants: { tone: "neutral", size: "mini" },
  },
);

export interface BadgeProps
  extends
    React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, tone, size, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ tone, size }), className)} {...props} />
  );
}

/** `.gchip` — 28px tappable chip. */
function Chip({ className, tone, ...props }: Omit<BadgeProps, "size">) {
  return <Badge size="chip" tone={tone} className={className} {...props} />;
}

/** `.mini` — 22px dense glyph. */
function Mini({ className, tone, ...props }: Omit<BadgeProps, "size">) {
  return <Badge size="mini" tone={tone} className={className} {...props} />;
}

export { Badge, Chip, Mini, badgeVariants };
