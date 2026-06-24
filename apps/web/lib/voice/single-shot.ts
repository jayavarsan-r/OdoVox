/**
 * Single-shot dictation logic (the patient-list search mic): record a short clip, auto-stop after a
 * brief silence, transcribe, drop the text into the search box. Pure + testable; the component wires
 * MediaRecorder + the analyser to these helpers.
 */

export interface SilenceConfig {
  /** Peak amplitude (0-1) below which a frame counts as silence. */
  thresholdAmp: number;
  /** How long continuous silence must last before we auto-stop. */
  silenceMs: number;
}

export const DEFAULT_SILENCE: SilenceConfig = { thresholdAmp: 0.06, silenceMs: 1500 };

export function isSilent(amplitudes: number[], cfg: SilenceConfig = DEFAULT_SILENCE): boolean {
  return Math.max(0, ...amplitudes) < cfg.thresholdAmp;
}

export function shouldAutoStop(consecutiveSilentMs: number, cfg: SilenceConfig = DEFAULT_SILENCE): boolean {
  return consecutiveSilentMs >= cfg.silenceMs;
}

/** Tidy a raw transcript for a search field — trim + strip trailing sentence punctuation. */
export function normalizeForSearch(transcript: string): string {
  return transcript.trim().replace(/[.?!,;\s]+$/, '');
}

export type SingleShotState =
  | { kind: 'idle' }
  | { kind: 'recording' }
  | { kind: 'processing' }
  | { kind: 'done'; transcript: string }
  | { kind: 'error'; error: string };

export type SingleShotAction =
  | { type: 'START' }
  | { type: 'STOP' }
  | { type: 'RESULT'; transcript: string }
  | { type: 'FAIL'; error: string }
  | { type: 'RESET' };

export function singleShotReducer(state: SingleShotState, action: SingleShotAction): SingleShotState {
  switch (action.type) {
    case 'START':
      return { kind: 'recording' };
    case 'STOP':
      return state.kind === 'recording' ? { kind: 'processing' } : state;
    case 'RESULT':
      return { kind: 'done', transcript: action.transcript };
    case 'FAIL':
      return { kind: 'error', error: action.error };
    case 'RESET':
      return { kind: 'idle' };
    default:
      return state;
  }
}
