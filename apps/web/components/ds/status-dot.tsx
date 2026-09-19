import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * `.statdot` — a 10px state dot. Trailing marker on patient rows, unread markers in
 * the inbox, the live indicator in reception headers.
 *
 * Spec: 10×10, radius 6, never shrinks. `sm` (7–8px) is the inline variant used
 * inside chips ("● Live", "● REC").
 */
const statusDot = cva("shrink-0 rounded-pill", {
  variants: {
    tone: {
      lime: "bg-lime",
      live: "bg-live",
      sky: "bg-sky",
      warn: "bg-warn",
      crit: "bg-crit",
      lav: "bg-lav",
      neutral: "bg-hair-2",
    },
    size: {
      sm: "size-2",
      md: "size-2.5",
    },
  },
  defaultVariants: { tone: "neutral", size: "md" },
});

export interface StatusDotProps extends VariantProps<typeof statusDot> {
  className?: string;
  /** Screen-reader text; the dot is decorative without it. */
  label?: string;
}

export function StatusDot({ tone, size, className, label }: StatusDotProps) {
  return (
    <span
      className={cn(statusDot({ tone, size }), className)}
      aria-hidden={!label}
    >
      {label ? <span className="sr-only">{label}</span> : null}
    </span>
  );
}
