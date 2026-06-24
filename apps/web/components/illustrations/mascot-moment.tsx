'use client';

import { motion } from 'framer-motion';
import {
  mascotSizePx,
  type MascotAnimation,
  type MascotBackground,
  type MascotPose,
  type MascotSize,
} from '@/lib/ds/mascot';
import { floatLoop, gentlePulse, springScale } from '@/components/ds/motion';
import { cn } from '@/lib/utils';

/**
 * Odo, the Odovox mascot. Renders the pose PNG via `background-image:
 * var(--illu-mascot-<pose>)` over a graceful inline-SVG placeholder, so the
 * moment reads intentionally until the real AI-generated art is dropped in.
 * Only use in approved moments (splash, onboarding s1, /done, empty/success).
 * See design-system.md §7.
 */

function OdoPlaceholder({ pose }: { pose: MascotPose }) {
  // Tiny "happy/closed eyes" expression hint so each pose differs at a glance.
  const eyesClosed = pose === 'celebrate' || pose === 'sleeping';
  return (
    <svg viewBox="0 0 100 100" className="size-full" fill="none" aria-hidden>
      <path
        d="M50 18c-11 0-15 5-21 5-5 0-9 4-9 11 0 8 3 13 5 20 2 5 1 11 3 17 1 4 3 8 5 8s3-4 4-9c1-6 1-11 5-11h6c4 0 4 5 5 11 1 5 2 9 4 9s4-4 5-8c2-6 1-12 3-17 2-7 5-12 5-20 0-7-4-11-9-11-6 0-10-5-21-5Z"
        className="fill-paper-warm stroke-ink"
        strokeWidth="2"
      />
      {eyesClosed ? (
        <path
          d="M40 46c2 2 5 2 7 0M53 46c2 2 5 2 7 0"
          className="stroke-ink"
          strokeWidth="2"
          strokeLinecap="round"
        />
      ) : (
        <>
          <circle cx="43" cy="46" r="2.4" className="fill-ink" />
          <circle cx="57" cy="46" r="2.4" className="fill-ink" />
        </>
      )}
      <path d="M44 56c2 2.5 10 2.5 12 0" className="stroke-lime" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

const bgClass: Record<MascotBackground, string> = {
  none: '',
  cream: 'bg-paper-cream rounded-full',
  glass: 'backdrop-blur-glass-md bg-glass-light rounded-full border border-[var(--glass-border-light)]',
};

export function MascotMoment({
  pose,
  size = 'md',
  animation = 'float',
  background = 'none',
  className,
}: {
  pose: MascotPose;
  size?: MascotSize;
  animation?: MascotAnimation;
  background?: MascotBackground;
  className?: string;
}) {
  const px = mascotSizePx(size);
  const padded = background === 'none' ? px : Math.round(px * 1.25);

  const anim =
    animation === 'float'
      ? floatLoop
      : animation === 'gentle-pulse'
        ? gentlePulse
        : animation === 'bounce-in'
          ? { initial: springScale.initial, animate: springScale.animate, transition: springScale.transition }
          : {};

  return (
    <motion.div
      {...anim}
      aria-hidden
      style={{ width: padded, height: padded }}
      className={cn('relative flex items-center justify-center', bgClass[background], className)}
    >
      {/* base placeholder — covered once a real opaque PNG ships */}
      <div style={{ width: px, height: px }} className="absolute">
        <OdoPlaceholder pose={pose} />
      </div>
      {/* the pose PNG (transparent placeholder today) */}
      <div
        style={{
          width: px,
          height: px,
          backgroundImage: `var(--illu-mascot-${pose})`,
          backgroundSize: 'contain',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }}
        className="relative"
      />
    </motion.div>
  );
}
