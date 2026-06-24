'use client';

/**
 * Voice-to-text via the browser's Web Speech API. SSR-safe and degrades gracefully when the
 * API is unavailable. Phase 3 will swap `createRecognizer` for a Sarvam STT implementation —
 * the rest of the app only depends on the `VoiceRecognizer` interface, so it's a one-call swap.
 *
 * TODO(Phase 3): replace the Web Speech implementation with Sarvam streaming STT.
 */

export interface VoiceRecognizer {
  start(): void;
  stop(): void;
}

export interface RecognizerCallbacks {
  onTranscript: (text: string, isFinal: boolean) => void;
  onError?: (message: string) => void;
  onEnd?: () => void;
  lang?: string;
}

interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}

/** Is speech recognition available in this browser? Always false during SSR. */
export function isVoiceSupported(): boolean {
  if (typeof window === 'undefined') return false;
  const w = window as unknown as Record<string, unknown>;
  return Boolean(w.SpeechRecognition || w.webkitSpeechRecognition);
}

/** Build a recognizer, or null if unsupported (caller should hide/disable the mic). */
export function createRecognizer(cb: RecognizerCallbacks): VoiceRecognizer | null {
  if (!isVoiceSupported()) return null;
  const w = window as unknown as Record<string, unknown>;
  const Ctor = (w.SpeechRecognition || w.webkitSpeechRecognition) as new () => SpeechRecognitionLike;
  const rec = new Ctor();
  rec.lang = cb.lang ?? 'en-IN';
  rec.interimResults = true;
  rec.continuous = false;

  rec.onresult = (e) => {
    let transcript = '';
    let isFinal = false;
    for (let i = 0; i < e.results.length; i++) {
      const r = e.results[i]!;
      transcript += r[0]?.transcript ?? '';
      if (r.isFinal) isFinal = true;
    }
    cb.onTranscript(transcript.trim(), isFinal);
  };
  rec.onerror = (e) => cb.onError?.(e.error);
  rec.onend = () => cb.onEnd?.();

  return {
    start: () => rec.start(),
    stop: () => rec.stop(),
  };
}
