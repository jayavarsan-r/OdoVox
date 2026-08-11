'use client';

import { motion } from 'framer-motion';
import { Mic, Pause, Play, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Chip, Mini } from '@/components/ui/badge';
import { useConsultStore } from '@/lib/consult/store';
import { cn } from '@/lib/utils';

function fmt(ms: number): string {
  const total = Math.floor(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

/**
 * Live 5-bar waveform driven by the analyser amplitudes in the store.
 *
 * `muted` is frame 24's "rings freeze grey": the bars hold a shape but lose their colour,
 * so a paused recording still reads as CAPTURED rather than empty.
 */
function Waveform({ bars, muted }: { bars: number[]; muted?: boolean }) {
  return (
    <div className="flex h-20 items-center justify-center gap-2" aria-hidden>
      {bars.map((amp, i) => (
        <motion.span
          key={i}
          className={cn('w-3 rounded-pill', muted ? 'bg-hair-2' : 'bg-lime')}
          animate={{ height: `${Math.max(8, amp * 80)}px` }}
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        />
      ))}
    </div>
  );
}

/**
 * Capture surface for the consultation. Reads the consult store (single source of truth) and only
 * dispatches actions — it owns no state the server also owns. Renders the idle/recording/stopped
 * faces; the page swaps to the progress strip + verification card for the pipeline/verify states.
 */
export function Recorder() {
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

  // Frames 23 and 24. One surface, two faces — the frame's note is explicit that pause is
  // "the same screen ... minus the call banner", so this is a state on one screen rather
  // than two layouts.
  if (state.kind === 'RECORDING' || state.kind === 'PAUSED') {
    const paused = state.kind === 'PAUSED';
    return (
      <div className="flex w-full max-w-mobile flex-col items-center gap-4 px-gutter">
        <Chip tone={paused ? 'neutral' : 'crit'}>
          {paused ? (
            <>
              <Pause className="size-3" /> PAUSED
            </>
          ) : (
            <>
              <span className="size-2 animate-pulse rounded-pill bg-crit" /> REC
            </>
          )}
        </Chip>

        {/* Frame 24: "Rings freeze grey". The bars hold their last shape rather than
            dropping to a flat line — a flat line reads as "nothing was captured", and
            the whole point of this state is that the audio is safe. */}
        <Waveform bars={paused ? amplitude.map(() => 0.35) : amplitude} muted={paused} />

        <p className="font-mono text-[32px] font-heavy tabular-nums leading-none text-pine">
          {fmt(state.durationMs)}
        </p>

        {paused ? (
          /* The frame's call banner. Only shown for an AUTOMATIC pause — a doctor who
             tapped Pause knows why it paused, and telling them "paused for a phone call"
             would be a lie. */
          <p className="text-center text-[12.5px] font-semibold leading-[1.5] text-pine-2">
            Paused · audio safe on this phone
          </p>
        ) : state.durationMs > 150_000 ? (
          <Mini tone="warn">Wrap up soon</Mini>
        ) : null}

        <div className="mt-1 flex w-full items-center gap-[9px]">
          {paused ? (
            /* Frame 24: "Resume becomes the big lime target." */
            <Button block className="h-12 flex-1" onClick={() => resume()}>
              <Play /> Resume
            </Button>
          ) : (
            <Button variant="outline" className="h-12 flex-1" onClick={() => pause()}>
              <Pause /> Pause
            </Button>
          )}
          <Button
            variant={paused ? 'outline' : 'primary'}
            className="h-12 flex-1"
            onClick={() => stop()}
          >
            <Square /> Finish
          </Button>
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
