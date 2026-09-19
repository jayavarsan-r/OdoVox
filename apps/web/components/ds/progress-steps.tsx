'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ProgressStep {
  label: string;
  state: 'done' | 'now' | 'ahead';
}

/**
 * A journey with a position on it — the lab case lifecycle, a setup checklist, a treatment
 * plan's sittings.
 *
 * ADVANCING IS THE POINT. The lab case screen already drew six steps, and tapping "Mark
 * ready" simply re-rendered them somewhere else: the single most satisfying moment the app
 * has — work moving forward — passed with no acknowledgement at all. The connector fills,
 * the newly-finished step flips to a tick, and the current step settles with a small
 * overshoot. Roughly 400ms in total, which is long enough to see and short enough that the
 * second tap is never waiting on it.
 *
 * The overshoot is the ONLY place in this component with any bounce, and it is deliberate:
 * it marks "you moved something", which is true of a lab case and is emphatically not true
 * of confirming a clinical record. Do not reach for this to mark a clinical act.
 *
 * `layout` is not used anywhere here — the steps do not move, only their fills change, so
 * there is no layout animation to get wrong on a narrow screen.
 */
export function ProgressSteps({ steps, className }: { steps: ProgressStep[]; className?: string }) {
  const reduced = useReducedMotion();

  return (
    <ol className={cn('flex items-start justify-between', className)}>
      {steps.map((step, i) => {
        const last = i === steps.length - 1;
        return (
          <li key={step.label} className="flex flex-1 flex-col items-center gap-1.5">
            <span className="flex w-full items-center">
              <Connector filled={step.state !== 'ahead'} hidden={i === 0} reduced={reduced} />
              <motion.span
                // Only the step that just became current is worth animating. `done` and
                // `ahead` change appearance without ceremony — a screen where six circles
                // all animate on every render is noise, not feedback.
                initial={false}
                animate={step.state === 'now' && !reduced ? { scale: [1, 1.14, 1] } : { scale: 1 }}
                transition={{ duration: 0.34, ease: [0.34, 1.56, 0.64, 1] }}
                className={cn(
                  'flex size-[26px] shrink-0 items-center justify-center rounded-pill text-3xs font-heavy',
                  step.state === 'done' && 'bg-live text-white',
                  step.state === 'now' && 'bg-lime text-pine',
                  step.state === 'ahead' && 'border border-hair-2 text-pine-3',
                )}
              >
                {step.state === 'done' ? <Check className="size-3.5" strokeWidth={3} /> : i + 1}
              </motion.span>
              <Connector filled={step.state === 'done'} hidden={last} reduced={reduced} />
            </span>
            <span
              className={cn(
                'text-3xs font-heavy transition-colors duration-state',
                step.state === 'ahead' ? 'text-pine-3' : 'text-pine',
              )}
            >
              {step.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/**
 * The line between two steps. It FILLS rather than switching colour, so progress reads as
 * travel along the journey rather than as two independent things changing at once.
 *
 * Scaled from the left on a transform, never animated as a width — width is a layout
 * property and animating it on six connectors at once is six reflows per frame.
 */
function Connector({
  filled,
  hidden,
  reduced,
}: {
  filled: boolean;
  hidden: boolean;
  reduced: boolean | null;
}) {
  if (hidden) return <span className="h-0.5 flex-1 opacity-0" />;
  return (
    <span className="relative h-0.5 flex-1 overflow-hidden bg-hair-2">
      <motion.span
        initial={false}
        animate={{ scaleX: filled ? 1 : 0 }}
        transition={reduced ? { duration: 0 } : { duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        style={{ transformOrigin: 'left' }}
        className="absolute inset-0 bg-live"
      />
    </span>
  );
}
