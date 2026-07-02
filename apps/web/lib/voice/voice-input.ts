import { ApiError } from '../api-client';

/**
 * Pure logic for the shared <VoiceInput> component (Phase 9.7 W1.1) — one component, three modes,
 * replacing the scattered per-surface mic buttons. The component wires MediaRecorder (via
 * useDictation) to these helpers; everything here is testable in node.
 */

export type VoiceInputMode = 'single-shot' | 'extraction' | 'notes';
export type VoiceInputSize = 'sm' | 'md' | 'lg';
export type VoiceInputPlacement = 'inline' | 'sheet' | 'fab';

/** Safety cap — a dictation never runs past 60s; the user can dismiss and restart. */
export const MAX_DICTATION_MS = 60_000;

/** Round-button + icon sizing per size (keeps every migrated surface pixel-identical). */
export const VOICE_SIZE_CLASSES: Record<VoiceInputSize, { button: string; icon: string }> = {
  sm: { button: 'size-9', icon: 'size-4' },
  md: { button: 'size-10', icon: 'size-5' },
  lg: { button: 'size-12', icon: 'size-6' },
};

/**
 * The transcribe-only endpoint used by single-shot and notes modes. Extraction surfaces must name
 * their own dictate endpoint.
 */
export const TRANSCRIBE_ENDPOINT = '/dictate/transcribe';

export function resolveEndpoint(mode: VoiceInputMode, endpoint?: string): string {
  if (mode === 'extraction') {
    if (!endpoint) throw new Error('<VoiceInput mode="extraction"> requires an endpoint');
    return endpoint;
  }
  return endpoint ?? TRANSCRIBE_ENDPOINT;
}

/** Phase 9.5 friendly copy per dictation state (null = no status line). */
export function voiceStatusCopy(kind: 'idle' | 'recording' | 'processing' | 'done' | 'error'): string | null {
  if (kind === 'recording') return 'Listening…';
  if (kind === 'processing') return 'Making sense of it…';
  return null;
}

/**
 * Shared error UX (spec W1.1): a provider/server failure means voice itself is down — steer the
 * user back to typing. Anything transport-shaped (fetch TypeError, timeouts) is retryable.
 */
export function voiceErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status >= 500 || err.code === 'EXTRACTION_FAILED' || err.code === 'STT_FAILED' || err.code.endsWith('_MISCONFIGURED')) {
      return 'Voice unavailable — try typing instead.';
    }
    return err.message;
  }
  return 'Could not reach the server — try again.';
}

/** Notes mode: append a freshly-dictated transcript to the existing field text. */
export function appendTranscript(existing: string, transcript: string): string {
  const addition = transcript.trim();
  if (!addition) return existing;
  return [existing.trim(), addition].filter(Boolean).join(' ');
}
