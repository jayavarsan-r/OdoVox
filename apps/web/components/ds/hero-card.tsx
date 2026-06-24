'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

/**
 * The elevated hero surface — never flat. The `dark` variant carries real depth:
 * a 135° gradient, a top inner highlight, a layered drop shadow, and a glowing
 * lime icon block (Phase 2.6). Glass variants float over photos/gradients.
 * See design-system.md §6 + §12.1.
 */
const heroCard = cva(
  'relative block w-full overflow-hidden rounded-xl text-left transition-all duration-base ease-spring-soft',
  {
    variants: {
      variant: {
        dark: 'text-paper shadow-hero-dark',
        light: 'bg-paper-warm text-ink border border-border',
        'glass-dark':
          'backdrop-blur-glass-md bg-glass-dark text-paper border border-[var(--glass-border-dark)]',
        'glass-light':
          'backdrop-blur-glass-md bg-glass-light text-ink border border-[var(--glass-border-light)]',
      },
      size: {
        compact: 'p-3.5 rounded-lg',
        md: 'p-5',
        lg: 'p-6',
      },
      glow: {
        none: '',
        lime: 'shadow-lime-glow',
        sage: 'shadow-sage-glow',
      },
      interactive: {
        true: 'active:scale-[0.98] cursor-pointer',
        false: '',
      },
    },
    compoundVariants: [
      { glow: 'none', variant: 'light', class: 'shadow-elev-2' },
      { glow: 'none', variant: 'glass-dark', class: 'shadow-elev-3' },
      { glow: 'none', variant: 'glass-light', class: 'shadow-elev-2' },
    ],
    defaultVariants: { variant: 'dark', size: 'md', glow: 'none', interactive: false },
  },
);

export interface HeroCardProps extends Omit<VariantProps<typeof heroCard>, 'interactive'> {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  trailing?: React.ReactNode;
  onClick?: () => void;
  className?: string;
  children?: React.ReactNode;
}

const iconToneByVariant: Record<NonNullable<HeroCardProps['variant']>, string> = {
  dark: 'bg-white/10 text-lime',
  light: 'bg-ink text-lime',
  'glass-dark': 'bg-white/10 text-lime',
  'glass-light': 'bg-ink text-lime',
};

export function HeroCard({
  variant = 'dark',
  size = 'md',
  glow = 'none',
  title,
  subtitle,
  icon,
  trailing,
  onClick,
  className,
  children,
}: HeroCardProps) {
  const interactive = Boolean(onClick);
  const isDark = variant === 'dark';
  const gap = size === 'compact' ? 'gap-3' : 'gap-4';

  const content = (
    <>
      {isDark ? (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/[0.05] to-transparent"
        />
      ) : null}
      <span className={cn('relative z-10 flex items-center', gap)}>
        {icon ? (
          isDark ? (
            <span
              className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-ink-soft/60 text-lime backdrop-blur-sm [&_svg]:size-5"
              style={{ boxShadow: 'var(--hero-icon-glow)' }}
            >
              {icon}
            </span>
          ) : (
            <span
              className={cn(
                'flex size-11 shrink-0 items-center justify-center rounded-lg [&_svg]:size-5',
                iconToneByVariant[variant ?? 'dark'],
              )}
            >
              {icon}
            </span>
          )
        ) : null}
        <span className="min-w-0 flex-1">
          <span className={cn('block truncate font-semibold tracking-tight', isDark && 'text-lg')}>
            {title}
          </span>
          {subtitle ? (
            <span className={cn('mt-0.5 block truncate text-sm', isDark ? 'text-white/60' : 'opacity-70')}>
              {subtitle}
            </span>
          ) : null}
          {children}
        </span>
        {trailing ? (
          <span className={cn('shrink-0 [&_svg]:size-5', isDark ? 'text-white/40' : 'opacity-80')}>
            {trailing}
          </span>
        ) : null}
      </span>
    </>
  );

  const style = isDark ? { background: 'var(--hero-dark-grad)' } : undefined;

  if (interactive) {
    return (
      <motion.button
        type="button"
        onClick={onClick}
        whileTap={{ scale: 0.98 }}
        style={style}
        className={cn(heroCard({ variant, size, glow, interactive: true }), className)}
      >
        {content}
      </motion.button>
    );
  }
  return (
    <div style={style} className={cn(heroCard({ variant, size, glow, interactive: false }), className)}>
      {content}
    </div>
  );
}
