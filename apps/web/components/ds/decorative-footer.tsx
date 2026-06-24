'use client';

import { motion } from 'framer-motion';
import { MascotMoment } from '@/components/illustrations/mascot-moment';
import { cn } from '@/lib/utils';

/**
 * Lower-half decoration that fills dead space on sparse screens. Pointer-events
 * none, behind content. See design-system.md §6.
 */
export type DecorativeFooterVariant = 'waveform' | 'tooth-grid' | 'mascot-peek' | 'dots';

export function DecorativeFooter({
  variant = 'waveform',
  className,
}: {
  variant?: DecorativeFooterVariant;
  className?: string;
}) {
  return (
    <div
      aria-hidden
      className={cn(
        'pointer-events-none absolute inset-x-0 bottom-0 flex justify-center overflow-hidden',
        className,
      )}
      style={{ paddingBottom: 'var(--safe-bottom)' }}
    >
      {variant === 'waveform' ? <Waveform /> : null}
      {variant === 'dots' ? <Dots /> : null}
      {variant === 'tooth-grid' ? <ToothGrid /> : null}
      {variant === 'mascot-peek' ? (
        <div className="translate-y-1/3">
          <MascotMoment pose="smile" size="lg" animation="none" background="none" />
        </div>
      ) : null}
    </div>
  );
}

function Waveform() {
  // Faint horizontal sound-wave (lime, opacity 0.2), subtly breathing.
  const bars = Array.from({ length: 40 });
  return (
    <div className="flex h-16 w-full max-w-mobile items-center justify-center gap-1 px-6 opacity-20">
      {bars.map((_, i) => {
        const h = 8 + Math.abs(Math.sin(i * 0.6)) * 36;
        return (
          <motion.span
            key={i}
            className="w-1 rounded-pill bg-lime"
            style={{ height: h }}
            animate={{ scaleY: [1, 0.6 + Math.abs(Math.cos(i)) * 0.6, 1] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut', delay: i * 0.04 }}
          />
        );
      })}
    </div>
  );
}

function Dots() {
  return (
    <svg viewBox="0 0 360 120" className="h-28 w-full max-w-mobile opacity-30" aria-hidden>
      {Array.from({ length: 7 }).map((_, row) =>
        Array.from({ length: 18 }).map((__, col) => (
          <circle key={`${row}-${col}`} cx={10 + col * 20} cy={10 + row * 16} r={1.6} className="fill-sage" />
        )),
      )}
    </svg>
  );
}

function ToothGrid() {
  return (
    <svg viewBox="0 0 360 120" className="h-28 w-full max-w-mobile opacity-10" aria-hidden>
      {Array.from({ length: 5 }).map((_, col) => (
        <path
          key={col}
          transform={`translate(${20 + col * 80}, 60) scale(0.5)`}
          d="M30 0c-7 0-9 3-13 3-3 0-5 2-5 7 0 5 2 8 3 12 1 4 1 7 2 11 1 2 2 4 3 4s2-2 3-5c0-4 0-7 3-7h4c2 0 2 3 3 7 0 3 1 5 2 5s2-2 3-4c1-4 1-7 2-11 1-4 3-7 3-12 0-5-2-7-5-7-4 0-6-3-13-3Z"
          className="fill-ink"
        />
      ))}
    </svg>
  );
}
