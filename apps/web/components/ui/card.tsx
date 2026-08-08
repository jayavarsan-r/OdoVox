import * as React from "react";
import { cn } from "@/lib/utils";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * `.card.wash` — the lime radial glow in the top-right corner. The spec uses it to
   * mark the card that is "your turn": the in-chair hero, the day-done celebration,
   * the join code, the first-day nudge. It is a signal, not decoration — do not add it
   * to a card that carries no action.
   */
  wash?: boolean;
}

/**
 * `.card` — the v9 card surface. Radius 26px (`--radius-3xl`), `shadow-card` (which
 * carries the white top highlight). No border: the shadow and the highlight do the
 * separating, which is what keeps a page of cards from reading as a wireframe.
 */
const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, wash = false, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "relative overflow-hidden rounded-3xl bg-card text-card-foreground shadow-card",
        className,
      )}
      {...props}
    >
      {wash ? (
        <span
          aria-hidden
          className="pointer-events-none absolute -right-[70px] -top-[70px] size-[210px] rounded-pill bg-wash-lime"
        />
      ) : null}
      {children}
    </div>
  ),
);
Card.displayName = "Card";

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col gap-1.5 p-5", className)}
    {...props}
  />
));
CardHeader.displayName = "CardHeader";

const CardTitle = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("font-semibold leading-none tracking-tight", className)}
    {...props}
  />
));
CardTitle.displayName = "CardTitle";

const CardDescription = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
));
CardDescription.displayName = "CardDescription";

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-5 pt-0", className)} {...props} />
));
CardContent.displayName = "CardContent";

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center p-5 pt-0", className)}
    {...props}
  />
));
CardFooter.displayName = "CardFooter";

export {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
};
