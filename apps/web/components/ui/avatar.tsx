"use client";

import * as React from "react";
import * as AvatarPrimitive from "@radix-ui/react-avatar";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { initialsOf } from "@/lib/ds/avatar";

/**
 * `.av` — the spec's avatar. The ring is not decoration: it encodes state, and the
 * same colour means the same thing everywhere.
 *
 *   live → in the chair now   ·   sky → waiting / booked
 *   lime → the focused identity (patient detail)   ·   none → neutral
 *
 * Spec ring is a double box-shadow: a 2.5px white gap, then a 5px state colour, so
 * the ring floats clear of the avatar rather than touching it.
 */
const avatarRing = cva(
  "relative flex shrink-0 items-center justify-center overflow-hidden rounded-pill bg-[#EDEFE8] font-heavy text-pine-2",
  {
    variants: {
      ring: {
        none: "shadow-ring-none",
        lime: "shadow-ring-lime",
        live: "shadow-ring-live",
        sky: "shadow-ring-sky",
        bare: "",
      },
      size: {
        xs: "size-6 text-tiny",
        sm: "size-[34px] text-3xs",
        md: "size-11 text-sm",
        lg: "size-[52px] text-[17px]",
        xl: "size-[72px] text-[22px]",
      },
    },
    defaultVariants: { ring: "bare", size: "md" },
  },
);

export interface AvatarProps
  extends
    React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root>,
    VariantProps<typeof avatarRing> {}

const Avatar = React.forwardRef<
  React.ComponentRef<typeof AvatarPrimitive.Root>,
  AvatarProps
>(({ className, ring, size, ...props }, ref) => (
  <AvatarPrimitive.Root
    ref={ref}
    className={cn(avatarRing({ ring, size }), className)}
    {...props}
  />
));
Avatar.displayName = AvatarPrimitive.Root.displayName;

const AvatarImage = React.forwardRef<
  React.ComponentRef<typeof AvatarPrimitive.Image>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Image>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Image
    ref={ref}
    className={cn("aspect-square size-full", className)}
    {...props}
  />
));
AvatarImage.displayName = AvatarPrimitive.Image.displayName;

const AvatarFallback = React.forwardRef<
  React.ComponentRef<typeof AvatarPrimitive.Fallback>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Fallback>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Fallback
    ref={ref}
    className={cn(
      "flex size-full items-center justify-center rounded-pill",
      className,
    )}
    {...props}
  />
));
AvatarFallback.displayName = AvatarPrimitive.Fallback.displayName;

/** Initials-only avatar — the spec's default; photos are rare in clinic data. */
export function InitialsAvatar({
  name,
  ring,
  size,
  className,
}: { name: string; className?: string } & VariantProps<typeof avatarRing>) {
  return (
    <span className={cn(avatarRing({ ring, size }), className)} aria-hidden>
      {initialsOf(name)}
    </span>
  );
}

export { Avatar, AvatarImage, AvatarFallback, avatarRing };
