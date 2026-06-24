'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { fadeInUp } from './motion';
import { cn } from '@/lib/utils';

/**
 * Large display header for page tops / greetings. Optional uppercase eyebrow,
 * a display title, a muted subtitle, and a trailing slot (avatar, action).
 * See design-system.md §3 + §6.
 */
export function EditorialHeading({
  eyebrow,
  title,
  subtitle,
  trailing,
  className,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  trailing?: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      initial={fadeInUp.initial}
      animate={fadeInUp.animate}
      transition={fadeInUp.transition}
      className={cn('flex items-start justify-between gap-3', className)}
    >
      <div className="min-w-0">
        {eyebrow ? (
          <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-text-subtle">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="text-[28px] font-semibold leading-tight tracking-tight text-ink">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-text-muted">{subtitle}</p> : null}
      </div>
      {trailing ? <div className="shrink-0">{trailing}</div> : null}
    </motion.div>
  );
}
