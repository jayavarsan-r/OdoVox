/**
 * Provider-agnostic speech-to-text. The pipeline depends only on `ISttProvider`, so swapping
 * the deterministic mock for the real Sarvam API is a one-line change behind `getSttProvider()`
 * driven by `STT_PROVIDER`. Mirrors the OTP sender abstraction. See docs/voice-pipeline.md.
 */

export type SttLanguage = "en-IN" | "hi-IN" | "ta-IN" | "auto";

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
  /**
   * MOCK ONLY — which seeded demo recording this is. Real providers ignore it entirely; they
   * transcribe the audio they were given and nothing else.
   *
   * The capture harness records through Chromium's fake capture device, which produces audio
   * no extractor can parse into anything. That left several real states — an allergy conflict,
   * a long prescription, a voice-filled intake — unreachable through the application, so they
   * could not be built against or screenshotted honestly. This lets the mock answer "what did
   * this demo patient's recording say" deterministically, so the state is then reached by
   * clicking the same buttons a user clicks.
   *
   * It selects a canned transcript. It never sets the resulting state directly.
   */
  fixture?: string;
}

export interface ISttProvider {
  transcribe(audio: Buffer, opts: SttTranscribeOptions): Promise<SttResult>;
}
