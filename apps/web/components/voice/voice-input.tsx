'use client';

import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Mic, Square, X } from 'lucide-react';
import { useDictation } from '@/lib/voice/use-dictation';
import {
  MAX_DICTATION_MS,
  VOICE_SIZE_CLASSES,
  resolveEndpoint,
  voiceErrorMessage,
  voiceStatusCopy,
  type VoiceInputMode,
  type VoiceInputPlacement,
  type VoiceInputSize,
} from '@/lib/voice/voice-input';
import { useToast } from '@/lib/toast';
import { cn } from '@/lib/utils';

export interface VoiceInputProps<T = unknown> {
  mode: VoiceInputMode;
  /** Dictate endpoint — required for extraction mode; single-shot/notes default to transcribe. */
  endpoint?: string;
  /** Extra body fields for the dictate POST (e.g. { patientId }). */
  extraBody?: Record<string, unknown>;
  /** single-shot / notes: receives the trimmed transcript. */
  onTranscript?: (text: string) => void;
  /** extraction: receives the endpoint's structured response. */
  onExtraction?: (data: T) => void;
  /** Surface recording-state changes (e.g. swap an input placeholder to "Listening…"). */
  onStateChange?: (kind: 'idle' | 'recording' | 'processing' | 'done' | 'error') => void;
  size?: VoiceInputSize;
  placement?: VoiceInputPlacement;
  /** Idle label (sheet/fab placements; aria-label everywhere). */
  label?: string;
  /** Helper copy shown while recording ("name · phone · complaint"). */
  hint?: string;
  /** Begin listening as soon as the surface opens (voice walk-in FAB path). */
  autoStart?: boolean;
  /** Render the Listening/Making-sense status line under an inline button. */
  showStatus?: boolean;
  disabled?: boolean;
  className?: string;
}

/** Live 5-bar lime waveform (mirrors the consult recorder). */
function WaveBars({ bars, className }: { bars: number[]; className?: string }) {
  return (
    <span className={cn('flex h-6 items-center gap-1', className)} aria-hidden>
      {bars.map((amp, i) => (
        <motion.span
          key={i}
          className="w-1 rounded-pill bg-lime"
          animate={{ height: `${Math.max(4, amp * 24)}px` }}
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        />
      ))}
    </span>
  );
}

/**
 * The one voice control (Phase 9.7 W1.1). Three modes — single-shot (transcribe → callback),
 * extraction (transcribe + extract via `endpoint`, caller shows a verification surface), notes
 * (transcribe → append into a text field). Long-press or tap to start; auto-stops on ~1.5s
 * silence or the 60s cap; cancel discards the clip entirely.
 */
export function VoiceInput<T = unknown>({
  mode,
  endpoint,
  extraBody,
  onTranscript,
  onExtraction,
  onStateChange,
  size = 'md',
  placement = 'inline',
  label,
  hint,
  autoStart = false,
  showStatus = false,
  disabled = false,
  className,
}: VoiceInputProps<T>) {
  const toast = useToast();
  const resolved = resolveEndpoint(mode, endpoint);

  const { state, bars, start, stop, cancel } = useDictation<T & { transcript?: string }>(
    resolved,
    (data) => {
      if (mode === 'extraction') onExtraction?.(data);
      else onTranscript?.((data.transcript ?? '').trim());
    },
    extraBody ?? {},
    { maxDurationMs: MAX_DICTATION_MS, onError: (err) => toast.error(voiceErrorMessage(err)) },
  );

  const recording = state.kind === 'recording';
  const processing = state.kind === 'processing';
  const busy = recording || processing;

  // Notify listeners of state changes (placeholder swaps etc.).
  const lastKind = useRef(state.kind);
  useEffect(() => {
    if (lastKind.current !== state.kind) {
      lastKind.current = state.kind;
      onStateChange?.(state.kind);
    }
  }, [state.kind, onStateChange]);

  // Auto-start once per open (voice walk-in). Re-arms when autoStart flips off.
  const autoStarted = useRef(false);
  useEffect(() => {
    if (!autoStart) {
      autoStarted.current = false;
      return;
    }
    if (!autoStarted.current && state.kind === 'idle') {
      autoStarted.current = true;
      void start();
    }
  }, [autoStart, state.kind, start]);

  // Long-press to start (fallback: tap) — holding ≥400ms starts while held; a quick tap starts on
  // click. Both land in the same recording flow, so the affordance is forgiving.
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startedByHold = useRef(false);
  const onPointerDown = () => {
    if (busy || disabled) return;
    startedByHold.current = false;
    holdTimer.current = setTimeout(() => {
      startedByHold.current = true;
      void start();
    }, 400);
  };
  const clearHold = () => {
    if (holdTimer.current) clearTimeout(holdTimer.current);
    holdTimer.current = null;
  };
  const onClick = () => {
    if (disabled) return;
    if (recording) {
      stop();
      return;
    }
    if (!busy && !startedByHold.current) void start();
    startedByHold.current = false;
  };

  const status = voiceStatusCopy(state.kind);
  const ariaLabel = recording ? 'Stop dictation' : (label ?? 'Start dictation');

  if (placement === 'sheet') {
    // Full-width dark bar — the prescription-sheet / intake-hero form factor.
    return (
      <div className={cn('space-y-2', className)}>
        <button
          type="button"
          onPointerDown={onPointerDown}
          onPointerUp={clearHold}
          onPointerLeave={clearHold}
          onClick={onClick}
          disabled={disabled || processing}
          aria-label={ariaLabel}
          className={cn(
            'flex w-full items-center justify-center gap-2 rounded-pill py-2.5 text-sm font-medium transition-colors',
            busy ? 'bg-ink text-lime' : 'bg-lime text-ink shadow-lime-glow',
            processing && 'animate-pulse',
          )}
        >
          {recording ? <WaveBars bars={bars} /> : <Mic className="size-4" />}
          {status ?? label ?? 'Speak'}
        </button>
        {recording ? (
          <div className="flex items-center justify-center gap-3">
            {hint ? <p className="text-xs text-text-muted">{hint}</p> : null}
            <button
              type="button"
              onClick={cancel}
              className="inline-flex items-center gap-1 rounded-pill bg-paper-warm px-2.5 py-1 text-xs font-medium text-text-muted"
            >
              <X className="size-3.5" /> Cancel
            </button>
          </div>
        ) : null}
      </div>
    );
  }

  const sizes = VOICE_SIZE_CLASSES[size];
  return (
    <div className={cn('flex flex-col items-center gap-1.5', placement === 'fab' && 'shadow-lime-glow rounded-pill', className)}>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onPointerDown={onPointerDown}
          onPointerUp={clearHold}
          onPointerLeave={clearHold}
          onClick={onClick}
          disabled={disabled || processing}
          aria-label={ariaLabel}
          className={cn(
            'flex shrink-0 items-center justify-center rounded-pill transition-colors',
            sizes.button,
            recording ? 'bg-ink text-lime' : processing ? 'animate-pulse bg-ink text-lime' : 'bg-lime text-ink shadow-lime-glow',
          )}
        >
          {recording ? <Square className={cn(sizes.icon, 'fill-current')} /> : <Mic className={sizes.icon} />}
        </button>
        {recording ? (
          <button
            type="button"
            onClick={cancel}
            aria-label="Cancel dictation"
            className="flex size-7 items-center justify-center rounded-pill bg-paper-warm text-text-muted"
          >
            <X className="size-3.5" />
          </button>
        ) : null}
      </div>
      {showStatus && status ? (
        <p className="text-center text-xs text-text-muted">
          {status}
          {recording && hint ? ` ${hint}` : ''}
        </p>
      ) : null}
    </div>
  );
}
