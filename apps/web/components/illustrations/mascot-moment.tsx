"use client";

import { motion } from "framer-motion";
import {
  mascotSizePx,
  type MascotAnimation,
  type MascotBackground,
  type MascotPose,
  type MascotSize,
} from "@/lib/ds/mascot";
import { floatLoop, gentlePulse, springScale } from "@/components/ds/motion";
import { cn } from "@/lib/utils";

/**
 * Odo, the Odovox mascot. Renders the pose PNG via `background-image:
 * var(--illu-mascot-<pose>)` over a graceful inline-SVG placeholder, so the
 * moment reads intentionally until the real AI-generated art is dropped in.
 * Only use in approved moments (splash, onboarding s1, /done, empty/success).
 * See design-system.md §7.
 */

/**
 * Odo's body — the spec's `#odo-body` symbol, traced exactly.
 *
 * The previous artwork was a hand-drawn approximation with a note that it stood in
 * "until the real art is dropped in". The real art was in the spec all along, and Gate B
 * caught the difference on frame 01: the spec draws an OUTLINE tooth with lime blush
 * ovals, the approximation drew a filled grey one with none. Systemic — Odo appears in
 * a dozen frames — so it is one fix here, not one per screen.
 */
const ODO_BODY =
  "M12 22 C12 9 21 5 32 5 C43 5 52 9 52 22 C52 31 50 37 48 44 C46.2 50.5 42.5 59 38.5 59 " +
  "C34.8 59 35.4 47 32 47 C28.6 47 29.2 59 25.5 59 C21.5 59 17.8 50.5 16 44 C14 37 12 31 12 22 Z";

/** Every expression below is lifted from a frame, in the spec's own 64x64 space. */
const MOUTH: Record<MascotPose, string> = {
  hero: "M26.5 33 Q32 38 37.5 33",
  smile: "M27 34 Q32 37.5 37 34",
  celebrate: "M26.5 32.5 A5.5 5.2 0 0 0 37.5 32.5 Z",
  thinking: "M28.5 34.5 h7",
  sleeping: "M29 34.5 h6",
};

/** Sleeping and thinking close the eyes; the rest keep the spec's 2.7r dots. */
const EYES_CLOSED: MascotPose[] = ["sleeping"];

function Odo({ pose }: { pose: MascotPose }) {
  const filled = pose === "celebrate";
  return (
    <svg viewBox="0 0 64 64" className="size-full" fill="none" aria-hidden>
      {/* Celebrate carries the spec's lime sparkle; thinking carries its rising dots. */}
      {pose === "celebrate" && (
        <path
          d="M56 12 l1.4 3 3 1.4-3 1.4-1.4 3-1.4-3-3-1.4 3-1.4z"
          className="fill-lime"
        />
      )}
      {pose === "thinking" && (
        <>
          <circle cx="46" cy="12" r="1.5" className="fill-pine" opacity=".4" />
          <circle cx="51" cy="8.5" r="2" className="fill-pine" opacity=".5" />
          <circle
            cx="56.5"
            cy="4.5"
            r="2.5"
            className="fill-pine"
            opacity=".6"
          />
        </>
      )}

      <path
        d={ODO_BODY}
        fill="#FFFFFF"
        className="stroke-pine"
        strokeWidth="2.6"
        strokeLinejoin="round"
      />

      <ellipse cx="20.5" cy="33" rx="3.4" ry="2.1" className="fill-lime" />
      <ellipse cx="43.5" cy="33" rx="3.4" ry="2.1" className="fill-lime" />

      {EYES_CLOSED.includes(pose) ? (
        <>
          <path
            d="M22 26.5 Q25 28.5 28 26.5"
            className="stroke-pine"
            strokeWidth="2.3"
            strokeLinecap="round"
          />
          <path
            d="M36 26.5 Q39 28.5 42 26.5"
            className="stroke-pine"
            strokeWidth="2.3"
            strokeLinecap="round"
          />
        </>
      ) : (
        <>
          <circle cx="25" cy="26.5" r="2.7" className="fill-pine" />
          <circle cx="39" cy="26.5" r="2.7" className="fill-pine" />
        </>
      )}

      <path
        d={MOUTH[pose]}
        className={filled ? "fill-pine" : "stroke-pine"}
        strokeWidth="2.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

const bgClass: Record<MascotBackground, string> = {
  none: "",
  cream: "bg-paper-cream rounded-full",
  glass:
    "backdrop-blur-glass-md bg-glass-light rounded-full border border-[var(--glass-border-light)]",
};

export function MascotMoment({
  pose,
  size = "md",
  animation = "float",
  background = "none",
  className,
}: {
  pose: MascotPose;
  size?: MascotSize;
  animation?: MascotAnimation;
  background?: MascotBackground;
  className?: string;
}) {
  const px = mascotSizePx(size);
  const padded = background === "none" ? px : Math.round(px * 1.25);

  const anim =
    animation === "float"
      ? floatLoop
      : animation === "gentle-pulse"
        ? gentlePulse
        : animation === "bounce-in"
          ? {
              initial: springScale.initial,
              animate: springScale.animate,
              transition: springScale.transition,
            }
          : {};

  return (
    <motion.div
      {...anim}
      aria-hidden
      style={{ width: padded, height: padded }}
      className={cn(
        "relative flex items-center justify-center",
        bgClass[background],
        className,
      )}
    >
      {/* Odo, drawn from the spec's own geometry. */}
      <div style={{ width: px, height: px }} className="absolute">
        <Odo pose={pose} />
      </div>
      {/* An opaque pose PNG, when one ships, covers the SVG. Transparent today. */}
      <div
        style={{
          width: px,
          height: px,
          backgroundImage: `var(--illu-mascot-${pose})`,
          backgroundSize: "contain",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
        }}
        className="relative"
      />
    </motion.div>
  );
}
