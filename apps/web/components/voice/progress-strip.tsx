'use client';

import { motion } from 'framer-motion';
import { Check, Loader2 } from 'lucide-react';
import type { ConsultState } from '@/lib/consult/machine';
import { cn } from '@/lib/utils';

type StepState = 'done' | 'active' | 'pending' | 'failed';

const STEPS = [
  { key: 'upload', label: 'Uploading' },
  { key: 'stt', label: 'Transcribing', note: 'Sarvam · saarika:v2.5' },
  { key: 'extract', label: 'Understanding', note: 'Gemini Flash' },
] as const;

function stepStates(kind: ConsultState['kind']): StepState[] {
  switch (kind) {
    case 'UPLOADING':
      return ['active', 'pending', 'pending'];
    case 'TRANSCRIBING':
      return ['done', 'active', 'pending'];
    case 'TRANSCRIBED':
      return ['done', 'done', 'pending'];
    case 'EXTRACTING':
      return ['done', 'done', 'active'];
    case 'VERIFY':
    case 'CONFIRMING':
    case 'CONFIRMED':
      return ['done', 'done', 'done'];
    case 'FAILED':
      return ['done', 'failed', 'pending'];
    default:
      return ['pending', 'pending', 'pending'];
  }
}

/** The 3-step pipeline strip. Honest: it animates only as far as the server has actually progressed. */
export function ProgressStrip({ state }: { state: ConsultState }) {
  const states = stepStates(state.kind);
  const transcript = state.kind === 'TRANSCRIBED' ? state.transcript : undefined;

  return (
    <div className="w-full space-y-4">
      <div className="space-y-3">
        {STEPS.map((step, i) => {
          const st = states[i]!;
          return (
            <div key={step.key} className="flex items-center gap-3">
              <span
                className={cn(
                  'flex size-7 shrink-0 items-center justify-center rounded-pill border',
                  st === 'done' && 'border-lime bg-lime text-ink',
                  st === 'active' && 'border-lime text-lime',
                  st === 'failed' && 'border-danger text-danger',
                  st === 'pending' && 'border-border text-text-subtle',
                )}
              >
                {st === 'done' ? (
                  <Check className="size-4" />
                ) : st === 'active' ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <span className="text-xs font-medium">{i + 1}</span>
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className={cn('text-sm font-medium', st === 'pending' ? 'text-text-subtle' : 'text-ink')}>
                  {step.label}
                </p>
                {'note' in step && st === 'active' ? (
                  <p className="text-xs text-text-muted">{step.note}</p>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      {transcript ? (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl bg-paper-warm p-4"
        >
          <p className="text-xs font-semibold tracking-widest text-text-subtle">HERE&apos;S WHAT WE HEARD</p>
          <p className="mt-1 text-sm text-ink">{transcript}</p>
        </motion.div>
      ) : null}
    </div>
  );
}
