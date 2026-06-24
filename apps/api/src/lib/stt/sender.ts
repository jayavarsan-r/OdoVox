/**
 * Provider-agnostic speech-to-text. The pipeline depends only on `ISttProvider`, so swapping
 * the deterministic mock for the real Sarvam API is a one-line change behind `getSttProvider()`
 * driven by `STT_PROVIDER`. Mirrors the OTP sender abstraction. See docs/voice-pipeline.md.
 */

export type SttLanguage = 'en-IN' | 'hi-IN' | 'ta-IN' | 'auto';

export interface SttSegment {
  text: string;
  startMs: number;
  endMs: number;
}

export interface SttResult {
  /** 'mock' or the upstream Sarvam request_id. */
  providerId: string;
  transcript: string;
  /** Detected/resolved BCP-47-ish language code, e.g. 'en-IN'. */
  languageCode: string;
  /** Wall-clock time the provider took to transcribe (telemetry). */
  durationMs: number;
  segments?: SttSegment[];
}

export interface SttTranscribeOptions {
  /** 'auto' lets the provider detect the language. */
  language?: SttLanguage;
  mimeType: string;
}

export interface ISttProvider {
  transcribe(audio: Buffer, opts: SttTranscribeOptions): Promise<SttResult>;
}
