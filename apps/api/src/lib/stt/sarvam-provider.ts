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

/**
 * Sarvam validates the multipart part's Content-Type against an allowlist and rejects
 * `audio/webm;codecs=opus` (HTTP 400 "Invalid file type") — it only accepts the bare `audio/webm`.
 * Strip any codecs parameter defensively so a caller passing the raw MediaRecorder mime can't 400.
 */
function normalizeMime(mime: string): string {
  return mime.split(';')[0]!.trim();
}

/** A filename with the right extension (Sarvam tolerates a bare name, but this is more correct). */
function filenameFor(mime: string): string {
  const ext = normalizeMime(mime).split('/')[1] ?? 'webm';
  return `audio.${ext}`;
}

/** Mask a key for logs: first 6 + last 4. */
function maskKey(key: string): string {
  return key.length <= 12 ? '••••' : `${key.slice(0, 6)}••••${key.slice(-4)}`;
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

  /** Build the multipart form. Exposed for tests (assert the file/model/language fields). */
  buildForm(audio: Buffer, opts: SttTranscribeOptions): FormData {
    const mime = normalizeMime(opts.mimeType); // strip ;codecs=opus — Sarvam rejects it
    const form = new FormData();
    form.set('file', new Blob([audio], { type: mime }), filenameFor(opts.mimeType));
    form.set('model', this.model);
    form.set('language_code', toSarvamLanguage(opts.language));
    form.set('with_timestamps', 'true');
    return form;
  }

  async transcribe(audio: Buffer, opts: SttTranscribeOptions): Promise<SttResult> {
    const startedAt = Date.now();

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      // NOTE: never set Content-Type manually — Node fetch derives the multipart boundary from the
      // FormData body; a manual header would omit the boundary and break the upload.
      this.logger?.info(
        {
          provider: 'sarvam',
          model: this.model,
          key: maskKey(this.apiKey),
          url: SARVAM_STT_URL,
          mime: normalizeMime(opts.mimeType),
          audioBytes: audio.length,
          attempt,
        },
        'Sarvam STT →',
      );

      const res = await fetch(SARVAM_STT_URL, {
        method: 'POST',
        headers: { 'api-subscription-key': this.apiKey },
        body: this.buildForm(audio, opts),
      });
      const raw = await res.text();

      if (res.ok) {
        const payload = JSON.parse(raw) as {
          request_id?: string;
          transcript?: string;
          language_code?: string;
        };
        this.logger?.info(
          { provider: 'sarvam', latencyMs: Date.now() - startedAt, language: payload.language_code, preview: (payload.transcript ?? '').slice(0, 200) },
          'Sarvam STT ✓',
        );
        return {
          providerId: payload.request_id ?? 'sarvam',
          transcript: payload.transcript ?? '',
          // Sarvam may return 'unknown' (auto-detect undecided) — pass through so the caller decides.
          languageCode: payload.language_code ?? toSarvamLanguage(opts.language),
          durationMs: Date.now() - startedAt,
        };
      }

      // 4xx → our request is malformed; don't waste retries. Log the body so it's diagnosable.
      if (res.status < 500) {
        this.logger?.error({ provider: 'sarvam', status: res.status, body: raw.slice(0, 4096) }, 'Sarvam STT rejected the request');
        throw new AppError(`Sarvam STT failed (HTTP ${res.status})`, 502, 'STT_FAILED', { status: res.status, body: raw.slice(0, 500) });
      }

      // 5xx → transient; back off and retry unless we're out of attempts.
      if (attempt < this.maxRetries) {
        this.logger?.info({ provider: 'sarvam', status: res.status, attempt, body: raw.slice(0, 500) }, 'Sarvam STT transient error — retrying');
        if (this.backoffBaseMs > 0) await delay(this.backoffBaseMs * 2 ** attempt);
        continue;
      }

      this.logger?.error({ provider: 'sarvam', status: res.status, body: raw.slice(0, 4096) }, 'Sarvam STT failed after retries');
      throw new AppError(`Sarvam STT failed (HTTP ${res.status})`, 502, 'STT_FAILED', { status: res.status, body: raw.slice(0, 500) });
    }

    // Unreachable: the loop always returns or throws.
    throw new AppError('Sarvam STT failed', 502, 'STT_FAILED');
  }
}
