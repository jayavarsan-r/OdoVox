'use client';

import { motion } from 'framer-motion';
import { Check, Mic, Pause } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/badge';
import type { ReactNode } from 'react';
import { IconCircle } from '@/components/ds';
import { useConsultStore } from '@/lib/consult/store';
import { cn, fmtDuration as fmt } from '@/lib/utils';



/**
 * Capture surface for the consultation. Reads the consult store (single source of truth) and only
 * dispatches actions — it owns no state the server also owns. Renders the idle/recording/stopped
 * faces; the page swaps to the progress strip + verification card for the pipeline/verify states.
 */
/**
 * `complaint` is a slot, not data: the page owns the consultation context, and frame 23
 * places the complaint beneath the ring stack. Passing the rendered node keeps the x-ray
 * count chip attached to it without giving the recorder a second data dependency.
 */
export function Recorder({ complaint }: { complaint?: ReactNode }) {
  const state = useConsultStore((s) => s.state);
  const amplitude = useConsultStore((s) => s.amplitude);
  const { beginRecording, pause, resume, stop, sendForReview } = useConsultStore.getState();

  if (state.kind === 'IDLE' || state.kind === 'REQUESTING_PERMISSION') {
    const requesting = state.kind === 'REQUESTING_PERMISSION';
    return (
      <div className="flex flex-col items-center gap-4 text-center">
        <p className="text-base text-text-muted">Tap to record. Speak naturally.</p>
        <button
          type="button"
          onClick={() => void beginRecording()}
          disabled={requesting}
          aria-label="Start recording"
          className="flex size-24 items-center justify-center rounded-pill bg-lime text-ink shadow-lime-glow transition-transform active:scale-95 disabled:opacity-60"
        >
          <Mic className="size-9" />
        </button>
        <p className="max-w-xs text-[13px] text-text-subtle">
          Procedure · sitting · prescription · next visit — Odovox files them automatically.
        </p>
      </div>
    );
  }

  // Frames 23 and 24, RECOMPOSED — not the old waveform layout wearing v9 tokens.
  //
  // The frame's structure, measured: a 56px tabular timer above a 180px ring stack with a
  // 92px lime orb at its centre, the complaint as a chip beneath, and two 62px circular
  // buttons with their labels below. The patient strip lives on the page, above this.
  //
  // Frame 24 is the same screen: "Rings freeze grey ... Resume becomes the big lime
  // target." So pause recolours and swaps the primary, it does not relayout.
  if (state.kind === 'RECORDING' || state.kind === 'PAUSED') {
    const paused = state.kind === 'PAUSED';
    // Peak of the live analyser, so the rings breathe with the doctor's actual voice.
    const level = paused ? 0 : Math.min(1, Math.max(...amplitude, 0));

    return (
      <div className="flex w-full flex-1 flex-col items-center">
        <div className="flex flex-1 flex-col items-center justify-center gap-2">
        <p className="text-[56px] font-heavy leading-none tracking-[-0.03em] tabular-nums text-pine">
          {fmt(state.durationMs)}
        </p>

        <div className="relative flex size-[180px] items-center justify-center">
          {/* Three concentric rings at inset 0 / 21 / 42, opacity .25 / .5 / .85. They
              scale with the input level while recording and hold still when paused. */}
          {[
            { inset: 0, opacity: 0.25 },
            { inset: 21, opacity: 0.5 },
            { inset: 42, opacity: 0.85 },
          ].map((ring, i) => (
            <motion.i
              key={ring.inset}
              aria-hidden
              className={cn(
                'absolute rounded-pill border-[1.5px]',
                paused ? 'border-hair-2' : 'border-lime',
              )}
              style={{ inset: ring.inset, opacity: paused ? 0.6 : ring.opacity }}
              animate={{ scale: paused ? 1 : 1 + level * 0.06 * (3 - i) }}
              transition={{ type: 'spring', stiffness: 260, damping: 24 }}
            />
          ))}
          <div
            className={cn(
              'relative flex size-[92px] items-center justify-center rounded-pill',
              paused ? 'bg-hair-2 text-pine-2' : 'bg-lime text-pine shadow-orb',
            )}
          >
            {paused ? <Pause className="size-9" /> : <Mic className="size-9" />}
          </div>
        </div>

          {/* The complaint sits BELOW the ring in frame 23, not above it: the doctor
              glances down at what they are recording about, they do not read past it to
              reach the orb. The page hands it down so the x-ray count travels with it. */}
          {complaint ? <div className="mt-4 w-full">{complaint}</div> : null}

          {!paused && state.durationMs > 150_000 ? (
            <Chip tone="warn">Wrap up soon</Chip>
          ) : null}
        </div>

        {/* Two 62px circles, 34px apart, labels beneath — the frame's control row, held
            near the bottom of the screen rather than floating under the ring. */}
        <div className="flex items-center justify-center gap-[34px] pb-11">
          <div className="flex flex-col items-center gap-[7px]">
            <IconCircle
              size="xl"
              tone={paused ? 'lime' : 'surface'}
              aria-label={paused ? 'Resume recording' : 'Pause recording'}
              onClick={() => (paused ? resume() : pause())}
            >
              {paused ? <Mic /> : <Pause />}
            </IconCircle>
            <span className="text-[12px] font-heavy text-pine-2">
              {paused ? 'Resume' : 'Pause'}
            </span>
          </div>
          <div className="flex flex-col items-center gap-[7px]">
            <IconCircle
              size="xl"
              tone="pine"
              aria-label="Finish recording"
              onClick={() => stop()}
            >
              <Check />
            </IconCircle>
            <span className="text-[12px] font-heavy text-pine-2">Finish</span>
          </div>
        </div>
      </div>
    );
  }

  if (state.kind === 'STOPPED') {
    return (
      <div className="flex flex-col items-center gap-5">
        <div className="flex h-16 items-center justify-center gap-1.5" aria-hidden>
          {Array.from({ length: 24 }, (_, i) => (
            <span
              key={i}
              className={cn('w-1 rounded-pill bg-sage-soft')}
              style={{ height: `${8 + ((i * 7) % 28)}px` }}
            />
          ))}
        </div>
        <p className="font-mono text-base tabular-nums text-text-muted">{fmt(state.durationMs)} captured</p>
        <div className="flex items-center gap-3">
          <Button variant="ghost" onClick={() => void beginRecording()}>
            Re-record
          </Button>
          <Button variant="primary" onClick={() => void sendForReview()}>
            Save findings
          </Button>
        </div>
      </div>
    );
  }

  return null;
}
