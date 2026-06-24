'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import {
  resolveEmptyMedia,
  type EmptyStateIconTone,
  type EmptyStateMascot,
  type EmptyStateVariant,
} from '@/lib/ds/empty-state';
import { MascotMoment } from '@/components/illustrations/mascot-moment';
import { Button } from '@/components/ui/button';
import { fadeInUp } from './motion';
import { cn } from '@/lib/utils';

/**
 * The universal empty-state pattern. Three shapes:
 *  • `inline` — a small icon + title + body in a horizontal paper-warm card,
 *    for inside-section empties on working screens (Home Today/Needs You, media).
 *  • `card`   — centered, inside an existing section box.
 *  • `page`   — full-screen, for empty tabs.
 * Mascots are for emotional moments only (never inline on working screens);
 * "coming soon" tabs use an illustration; working-screen empties use `icon`.
 * Logic in lib/ds/empty-state (tested). See design-system.md §6 + §11.
 */

const TONE: Record<EmptyStateIconTone, string> = {
  sky: 'bg-sky-soft text-info',
  info: 'bg-info-soft text-info',
  sage: 'bg-sage-tint text-sage-deep',
  peach: 'bg-peach-soft text-tool-patient',
  neutral: 'bg-paper text-text-muted',
};

export function EmptyState({
  mascot = 'none',
  illustration,
  icon,
  iconTone = 'sky',
  title,
  body,
  cta,
  variant = 'card',
  className,
}: {
  mascot?: EmptyStateMascot;
  illustration?: React.ReactNode;
  icon?: React.ReactNode;
  iconTone?: EmptyStateIconTone;
  title: string;
  body?: string;
  cta?: { label: string; onClick: () => void };
  variant?: EmptyStateVariant;
  className?: string;
}) {
  // Inline: horizontal small-icon card, never a mascot.
  if (variant === 'inline') {
    return (
      <motion.div
        initial={fadeInUp.initial}
        animate={fadeInUp.animate}
        transition={fadeInUp.transition}
        className={cn(
          'flex items-center gap-3 rounded-2xl bg-paper-warm px-5 py-4 text-left shadow-elev-1',
          className,
        )}
      >
        {icon ? (
          <span
            className={cn(
              'flex size-9 shrink-0 items-center justify-center rounded-md [&_svg]:size-[18px]',
              TONE[iconTone],
            )}
          >
            {icon}
          </span>
        ) : null}
        <div className="min-w-0">
          <h3 className="text-base font-semibold tracking-tight text-ink">{title}</h3>
          {body ? <p className="text-sm text-text-muted">{body}</p> : null}
        </div>
      </motion.div>
    );
  }

  const media = resolveEmptyMedia({ mascot, hasIllustration: Boolean(illustration) });
  const isPage = variant === 'page';
  const showIcon = media === 'none' && Boolean(icon);

  return (
    <motion.div
      initial={fadeInUp.initial}
      animate={fadeInUp.animate}
      transition={fadeInUp.transition}
      className={cn(
        'flex flex-col items-center justify-center text-center',
        isPage ? 'min-h-[60vh] px-8 py-12' : 'px-6 py-10',
        className,
      )}
    >
      {media === 'mascot' && mascot !== 'none' ? (
        <div className="mb-5">
          <MascotMoment pose={mascot} size={isPage ? 'lg' : 'md'} animation="float" background="cream" />
        </div>
      ) : null}
      {media === 'illustration' ? <div className="mb-5">{illustration}</div> : null}
      {showIcon ? (
        <span
          className={cn(
            'mb-4 flex size-14 items-center justify-center rounded-xl [&_svg]:size-6',
            TONE[iconTone],
          )}
        >
          {icon}
        </span>
      ) : null}

      <h3 className={cn('font-semibold tracking-tight text-ink', isPage ? 'text-xl' : 'text-lg')}>
        {title}
      </h3>
      {body ? <p className="mt-1.5 max-w-xs text-sm text-text-muted">{body}</p> : null}
      {cta ? (
        <Button variant="secondary" size="sm" className="mt-5" onClick={cta.onClick}>
          {cta.label}
        </Button>
      ) : null}
    </motion.div>
  );
}
