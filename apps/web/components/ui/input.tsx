import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * v9 fields. Two sizes, and one state that matters more than either:
 *
 *   `.frm`   (size="field") — 48px, radius 16, 15/700. The workhorse form row.
 *   `.field` (size="hero")  — 56px, radius 18, 17.5/700 tabular. Phone entry, clinic
 *                             name — the one field a screen is about.
 *
 *   `.voiced` — a 3px lime spine down the left edge marking a value that arrived by
 *               VOICE and has not been reviewed yet. The spec fades it on first touch:
 *               reviewed means owned. That is the whole trust model of voice intake —
 *               the form IS the review step, so the user must be able to see at a
 *               glance which values they have not yet looked at.
 */
const inputVariants = cva(
  [
    "flex w-full items-center gap-[9px] bg-white text-pine",
    "transition-shadow duration-state ease-out",
    "placeholder:font-regular placeholder:text-pine-3",
    "focus-visible:outline-none focus-visible:shadow-[var(--ring-lime)]",
    "disabled:cursor-not-allowed disabled:opacity-50",
  ].join(" "),
  {
    variants: {
      size: {
        field:
          "h-12 rounded-md px-[14px] text-md font-semibold shadow-[0_5px_14px_rgba(31,42,35,0.05)]",
        hero: "h-14 gap-[10px] rounded-lg px-4 text-[17.5px] font-semibold tabular-nums shadow-[0_8px_22px_rgba(31,42,35,0.07)]",
      },
      voiced: {
        true: "shadow-[0_5px_14px_rgba(31,42,35,0.05),inset_3px_0_0_var(--lime)]",
        false: "",
      },
      invalid: { true: "shadow-[0_0_0_2px_var(--crit)]", false: "" },
    },
    defaultVariants: { size: "field", voiced: false, invalid: false },
  },
);

export interface InputProps
  extends
    Omit<React.InputHTMLAttributes<HTMLInputElement>, "size">,
    VariantProps<typeof inputVariants> {
  /**
   * Marks a voice-filled value. Clears itself on first interaction — the spec fades
   * the spine over 300ms on touch, because reviewing a value is what makes it yours.
   */
  voiced?: boolean;
  onVoicedCleared?: () => void;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      type,
      size,
      voiced = false,
      invalid,
      onVoicedCleared,
      onFocus,
      ...props
    },
    ref,
  ) => (
    <input
      type={type}
      ref={ref}
      aria-invalid={invalid ? true : undefined}
      className={cn(inputVariants({ size, voiced, invalid }), className)}
      onFocus={(e) => {
        if (voiced) onVoicedCleared?.();
        onFocus?.(e);
      }}
      {...props}
    />
  ),
);
Input.displayName = "Input";

export { Input, inputVariants };
