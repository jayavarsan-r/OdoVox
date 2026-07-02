'use client';

import { motion } from 'framer-motion';
import { Mic, Pause, Play, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useConsultStore } from '@/lib/consult/store';
import { cn } from '@/lib/utils';

function fmt(ms: number): string {
  const total = Math.floor(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

/** Live 5-bar lime waveform driven by the analyser amplitudes in the store. */
function Waveform({ bars }: { bars: number[] }) {
  return (
    <div className="flex h-20 items-center justify-center gap-2" aria-hidden>
      {bars.map((amp, i) => (
        <motion.span
          key={i}
          className="w-3 rounded-pill bg-lime"
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

  if (state.kind === 'RECORDING' || state.kind === 'PAUSED') {
    const paused = state.kind === 'PAUSED';
    return (
      <div className="flex flex-col items-center gap-5">
        <Waveform bars={paused ? [0.1, 0.1, 0.1, 0.1, 0.1] : amplitude} />
        <p className="font-mono text-2xl tabular-nums text-ink">
          {fmt(state.durationMs)} <span className="text-base text-text-subtle">/ 3:00</span>
        </p>
        {state.durationMs > 150_000 ? (
          <p className="text-sm font-medium text-warning">Wrap up soon</p>
        ) : null}
        <div className="flex items-center gap-3">
          {paused ? (
            <Button variant="ghost" onClick={() => resume()}>
              <Play /> Resume
            </Button>
          ) : (
            <Button variant="ghost" onClick={() => pause()}>
              <Pause /> Pause
            </Button>
          )}
          <Button variant="destructive" onClick={() => stop()}>
            <Square /> Stop
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
