'use client';

import type { TargetAndTransition, Transition, Variants } from 'framer-motion';

/**
 * Shared Framer Motion specs. Consistency across the app comes from sharing these
 * — never hand-roll a transition in a screen. Tuned to the motion tokens in
 * tokens.css (--ease-spring / --ease-spring-soft / --duration-*). See design-system.md §5.
 */

/** A reusable bundle spread onto a <motion.*> element (initial/animate/[exit]/transition). */
export interface MotionBundle {
  initial?: TargetAndTransition;
  animate?: TargetAndTransition;
  exit?: TargetAndTransition;
  transition?: Transition;
}

const easeSpringSoft: [number, number, number, number] = [0.16, 1, 0.3, 1];

export const fadeInUp: MotionBundle = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4, ease: easeSpringSoft },
};

export const springScale: MotionBundle = {
  initial: { scale: 0.92, opacity: 0 },
  animate: { scale: 1, opacity: 1 },
  transition: { type: 'spring', stiffness: 320, damping: 24 },
};

export const slideUpSheet: MotionBundle = {
  initial: { y: '100%' },
  animate: { y: 0 },
  exit: { y: '100%' },
  transition: { type: 'spring', stiffness: 280, damping: 30 },
};

export const fadeIn: MotionBundle = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: 0.24, ease: easeSpringSoft },
};

/** Parent variant that staggers its children's entrance. */
export const staggerChildren = (delay = 0.04): Variants => ({
  animate: { transition: { staggerChildren: delay } },
});

/** Gentle ±4px vertical float for mascots / hero objects. */
export const floatLoop: { animate: TargetAndTransition } = {
  animate: { y: [0, -4, 0], transition: { duration: 4, ease: 'easeInOut', repeat: Infinity } },
};

/** Slow breathing scale for "alive but idle" elements. */
export const gentlePulse: { animate: TargetAndTransition } = {
  animate: { scale: [1, 1.03, 1], transition: { duration: 3, ease: 'easeInOut', repeat: Infinity } },
};
