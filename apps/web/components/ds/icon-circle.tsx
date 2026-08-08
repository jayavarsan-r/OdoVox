import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * `.icirc` — the spec's circular icon button. Appears ~40× across v9: back chevrons,
 * header actions, list-row glyphs, recording controls.
 *
 * Spec: 44px, full round, card background, pine icon,
 * `0 6px 16px rgba(31,42,35,.08)` + the white top highlight.
 * Tinted variants drop the shadow — they read as a glyph chip, not a raised control.
 */
const iconCircle = cva(
  "flex shrink-0 items-center justify-center rounded-pill transition-all duration-press active:scale-[0.94]",
  {
    variants: {
      tone: {
        surface: "bg-surface text-pine shadow-icirc",
        lime: "bg-lime text-pine shadow-cta",
        pine: "bg-pine text-lime",
        sky: "bg-sky-soft text-sky",
        live: "bg-live-soft text-live",
        warn: "bg-warn-soft text-warn",
        lav: "bg-lav-soft text-lav",
        crit: "bg-crit-soft text-crit",
        muted: "bg-[rgba(31,42,35,0.06)] text-pine-2",
      },
      size: {
        sm: "size-9 [&_svg]:size-4",
        md: "size-10 [&_svg]:size-[18px]",
        lg: "size-target [&_svg]:size-[18px]",
        xl: "size-12 [&_svg]:size-[19px]",
      },
      /** `.icirc` is round by default; the spec squares it for 32–50px glyph chips. */
      shape: {
        round: "rounded-pill",
        square: "rounded-xs",
      },
    },
    defaultVariants: { tone: "surface", size: "lg", shape: "round" },
  },
);

export interface IconCircleProps
  extends
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof iconCircle> {
  /** Render a non-interactive span instead of a button (list-row glyphs). */
  asSpan?: boolean;
}

export const IconCircle = React.forwardRef<HTMLButtonElement, IconCircleProps>(
  (
    { className, tone, size, shape, asSpan = false, children, ...props },
    ref,
  ) => {
    const classes = cn(iconCircle({ tone, size, shape }), className);
    if (asSpan) {
      return (
        <span className={cn(classes, "active:scale-100")} aria-hidden>
          {children}
        </span>
      );
    }
    return (
      <button ref={ref} type="button" className={classes} {...props}>
        {children}
      </button>
    );
  },
);
IconCircle.displayName = "IconCircle";
