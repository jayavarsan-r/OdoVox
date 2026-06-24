'use client';

import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { stepperStates, type StepDef } from '@/lib/ds/stepper';
import { cn } from '@/lib/utils';

/**
 * Multi-step wizard indicator: numbered circles joined by lines. Filled lime +
 * check when complete, lime-outlined when current, muted when upcoming.
 * Logic lives in lib/ds/stepper (tested). See design-system.md §6.
 */
export function StepperHeader({
  steps,
  current,
  className,
}: {
  steps: StepDef[];
  current: string;
  className?: string;
}) {
  const states = stepperStates(steps, current);
  return (
    <nav aria-label="Progress" className={cn('flex items-center', className)}>
      {states.map((step, i) => (
        <div key={step.id} className="flex flex-1 items-center last:flex-none">
          <div className="flex flex-col items-center gap-1.5">
            <motion.span
              initial={false}
              animate={{
                backgroundColor:
                  step.status === 'complete' ? 'var(--color-lime)' : 'var(--color-surface)',
                borderColor:
                  step.status === 'upcoming' ? 'var(--color-border)' : 'var(--color-lime)',
                scale: step.status === 'current' ? 1.05 : 1,
              }}
              transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
              className={cn(
                'flex size-7 items-center justify-center rounded-pill border-2 text-xs font-semibold',
                step.status === 'complete' ? 'text-ink' : 'text-text-muted',
                step.status === 'current' && 'text-ink',
              )}
            >
              {step.status === 'complete' ? <Check className="size-3.5" /> : step.index + 1}
            </motion.span>
            <span
              className={cn(
                'text-[11px] font-medium',
                step.status === 'upcoming' ? 'text-text-subtle' : 'text-ink',
              )}
            >
              {step.label}
            </span>
          </div>
          {i < states.length - 1 ? (
            <span className="mx-1.5 -mt-5 h-0.5 flex-1 overflow-hidden rounded-pill bg-border">
              <motion.span
                initial={false}
                animate={{ scaleX: step.status === 'complete' ? 1 : 0 }}
                transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                className="block h-full origin-left bg-lime"
              />
            </span>
          ) : null}
        </div>
      ))}
    </nav>
  );
}
