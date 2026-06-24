import { AppError } from '../errors.js';
import type {
  ISttProvider,
  SttLanguage,
  SttResult,
  SttTranscribeOptions,
} from './sender.js';

const SARVAM_STT_URL = 'https://api.sarvam.ai/speech-to-text';

/** Minimal logger shape so the provider can take a Fastify/Pino logger without a hard dep. */
export interface SttLogger {
  info(obj: unknown, msg?: string): void;
  error(obj: unknown, msg?: string): void;
}

/** 'auto' → Sarvam's 'unknown' (auto-detect); explicit codes pass through. */
function toSarvamLanguage(language: SttLanguage | undefined): string {
  return !language || language === 'auto' ? 'unknown' : language;
}

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Real Sarvam speech-to-text. India-tuned (en-IN / hi-IN / ta-IN), multipart upload. Retries
 * transient 5xx with exponential backoff; a 4xx fails immediately (our request is wrong). The
 * pipeline only ever sees `ISttProvider`, so this stays swappable. See docs/voice-pipeline.md.
 */
export class SarvamSttProvider implements ISttProvider {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly maxRetries: number;
  private readonly backoffBaseMs: number;

  constructor(
    opts?: { apiKey?: string; model?: string; maxRetries?: number; backoffBaseMs?: number },
    private readonly logger?: SttLogger,
  ) {
    const apiKey = opts?.apiKey ?? process.env.SARVAM_API_KEY;
    if (!apiKey) {
      throw new AppError(
        'Sarvam STT is not configured (SARVAM_API_KEY missing)',
        500,
        'STT_PROVIDER_MISCONFIGURED',
      );
    }
    this.apiKey = apiKey;
    this.model = opts?.model ?? process.env.SARVAM_MODEL ?? 'saarika:v2.5';
    this.maxRetries = opts?.maxRetries ?? 2;
    this.backoffBaseMs = opts?.backoffBaseMs ?? 250;
  }

  async transcribe(audio: Buffer, opts: SttTranscribeOptions): Promise<SttResult> {
    const startedAt = Date.now();

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      const form = new FormData();
      form.set('file', new Blob([audio], { type: opts.mimeType }), 'audio');
      form.set('model', this.model);
      form.set('language_code', toSarvamLanguage(opts.language));
      form.set('with_timestamps', 'true');

      const res = await fetch(SARVAM_STT_URL, {
        method: 'POST',
        headers: { 'api-subscription-key': this.apiKey },
        body: form,
      });

      if (res.ok) {
        const payload = (await res.json()) as {
          request_id?: string;
          transcript?: string;
          language_code?: string;
        };
        return {
          providerId: payload.request_id ?? 'sarvam',
          transcript: payload.transcript ?? '',
          languageCode: payload.language_code ?? toSarvamLanguage(opts.language),
          durationMs: Date.now() - startedAt,
        };
      }

      // 4xx → our request is malformed; don't waste retries.
      if (res.status < 500) {
        this.logger?.error({ status: res.status }, 'Sarvam STT rejected the request');
        throw new AppError(`Sarvam STT failed (HTTP ${res.status})`, 502, 'STT_FAILED');
      }

      // 5xx → transient; back off and retry unless we're out of attempts.
      if (attempt < this.maxRetries) {
        this.logger?.info(
          { status: res.status, attempt },
          'Sarvam STT transient error — retrying',
        );
        if (this.backoffBaseMs > 0) await delay(this.backoffBaseMs * 2 ** attempt);
        continue;
      }

      this.logger?.error({ status: res.status }, 'Sarvam STT failed after retries');
      throw new AppError(`Sarvam STT failed (HTTP ${res.status})`, 502, 'STT_FAILED');
    }

    // Unreachable: the loop always returns or throws.
    throw new AppError('Sarvam STT failed', 502, 'STT_FAILED');
  }
}
