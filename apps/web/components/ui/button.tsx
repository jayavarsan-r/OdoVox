import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * v9 buttons. Two shapes carry almost every action in the spec:
 *
 *   `.cta`  — 52px lime pill, 15.5/800 pine, lime glow + a white top highlight.
 *             Pressed: fill → `--lime-press`, scale .98. Disabled: #E7EAE0 / pine-3,
 *             no glow — and the spec pairs it with a line explaining WHY it's locked.
 *   `.btn2` — 44px white pill, 1px hair-2 border, 13.5/700. The secondary action.
 *
 * Variant names are unchanged so every existing call site keeps working; only the
 * values move to the spec.
 */
const buttonVariants = cva(
  [
    "inline-flex items-center justify-center gap-[9px] whitespace-nowrap rounded-pill",
    "transition-all duration-press ease-out active:scale-[0.98]",
    "focus-visible:outline-none focus-visible:shadow-[var(--ring-lime)]",
    "disabled:pointer-events-none [&_svg]:shrink-0",
  ].join(" "),
  {
    variants: {
      variant: {
        /* `.cta` */
        primary:
          "bg-lime text-pine shadow-cta active:bg-lime-press disabled:bg-[#E7EAE0] disabled:text-pine-3 disabled:shadow-none",
        /* `.btn2` */
        outline:
          "border border-hair-2 bg-white text-pine shadow-none active:bg-[rgba(31,42,35,0.03)] disabled:opacity-50",
        /* pine fill — "Swap → Azithro", "Apply · delay LB-112" */
        secondary:
          "bg-pine text-white active:brightness-110 disabled:opacity-50",
        ghost:
          "bg-transparent text-pine active:bg-[rgba(31,42,35,0.05)] disabled:opacity-50",
        destructive:
          "bg-crit text-white active:brightness-110 disabled:opacity-50",
      },
      size: {
        /* chip-height action, e.g. "Call in", "Approve" */
        sm: "h-9 px-3 text-body font-bold [&_svg]:size-[13px]",
        /* `.btn2` */
        md: "h-target px-5 text-body font-semibold [&_svg]:size-[15px]",
        /* `.cta` */
        lg: "h-cta px-6 text-[15.5px] font-heavy [&_svg]:size-[17px]",
        icon: "size-target [&_svg]:size-[18px]",
      },
      /** Sticky bottom CTAs and in-card CTAs are full-bleed in the spec. */
      block: { true: "w-full", false: "" },
    },
    defaultVariants: { variant: "primary", size: "md", block: false },
  },
);

export interface ButtonProps
  extends
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  /** When true, the label collapses to a pulsing mono "…" and the button is disabled. */
  loading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      block,
      asChild = false,
      loading = false,
      disabled,
      children,
      ...props
    },
    ref,
  ) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, block, className }))}
        ref={ref}
        disabled={disabled || loading}
        {...props}
      >
        {loading ? (
          <span className="animate-pulse font-mono text-lg leading-none tracking-widest">
            …
          </span>
        ) : (
          children
        )}
      </Comp>
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
