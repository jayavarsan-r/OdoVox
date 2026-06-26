import {
  ClinicalExtraction,
  PatientIntakeExtraction,
  PrescriptionExtraction,
  type ClinicalExtractionContext,
  type PrescriptionContext,
} from '@odovox/types';
import { AppError } from '../errors.js';
import type { IClinicalExtractor } from './extractor.js';
import {
  buildClinicalSystemInstruction,
  buildPrescriptionSystemInstruction,
  PATIENT_INTAKE_SYSTEM_INSTRUCTION,
} from './prompts/clinical.js';
import {
  CLINICAL_RESPONSE_SCHEMA,
  INTAKE_RESPONSE_SCHEMA,
  PRESCRIPTION_RESPONSE_SCHEMA,
  type GeminiSchema,
} from './response-schema.js';

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

/** Cost budget: keep input ≤ ~1000 tokens. ~4 chars/token → cap the transcript at 4000 chars. */
const MAX_INPUT_CHARS = 4000;
/**
 * Output ceiling (billed by actual usage, not the cap). The structured object is small, but the
 * 2.5 "thinking" models burn output budget on internal reasoning before emitting JSON — with too
 * low a cap they truncate mid-JSON (finishReason=MAX_TOKENS). We both raise the ceiling AND disable
 * thinking for 2.5 models below, so the JSON always lands intact.
 */
const MAX_OUTPUT_TOKENS = 2048;

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/** Mask a key for logs: first 6 + last 4, middle elided. */
function maskKey(key: string): string {
  return key.length <= 12 ? '••••' : `${key.slice(0, 6)}••••${key.slice(-4)}`;
}

export interface ExtractorLogger {
  info(obj: unknown, msg?: string): void;
  error(obj: unknown, msg?: string): void;
}

/**
 * Real Gemini 2.0 Flash extraction via the Google AI API with structured output (responseSchema +
 * responseMimeType=application/json). Temperature 0 for deterministic-ish extraction. Only ever
 * seen through `IClinicalExtractor`. See docs/voice-pipeline.md.
 */
export class GeminiExtractor implements IClinicalExtractor {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly maxRetries: number;
  private readonly backoffBaseMs: number;

  constructor(
    opts?: { apiKey?: string; model?: string; maxRetries?: number; backoffBaseMs?: number },
    private readonly logger?: ExtractorLogger,
  ) {
    const apiKey = opts?.apiKey ?? process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new AppError(
        'Gemini is not configured (GEMINI_API_KEY missing)',
        500,
        'AI_PROVIDER_MISCONFIGURED',
      );
    }
    this.apiKey = apiKey;
    this.model = opts?.model ?? process.env.GEMINI_MODEL ?? 'gemini-2.5-flash';
    this.maxRetries = opts?.maxRetries ?? 2;
    this.backoffBaseMs = opts?.backoffBaseMs ?? 400;
  }

  /** Build the request body. Exposed for tests (assert systemInstruction / generationConfig shape). */
  buildPayload(systemInstruction: string, transcript: string, responseSchema: GeminiSchema): Record<string, unknown> {
    return {
      systemInstruction: { parts: [{ text: systemInstruction }] },
      contents: [{ role: 'user', parts: [{ text: transcript.slice(0, MAX_INPUT_CHARS) }] }],
      generationConfig: {
        temperature: 0,
        maxOutputTokens: MAX_OUTPUT_TOKENS,
        responseMimeType: 'application/json',
        responseSchema,
        // 2.5 models "think" before answering, burning the output budget and truncating the JSON.
        // Disable thinking for a deterministic extraction (the task needs no chain-of-thought).
        ...(/gemini-2\.5/.test(this.model) ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
      },
    };
  }

  private async generate(
    systemInstruction: string,
    transcript: string,
    responseSchema: GeminiSchema,
  ): Promise<unknown> {
    const url = `${GEMINI_BASE}/${this.model}:generateContent?key=${this.apiKey}`;
    const body = JSON.stringify(this.buildPayload(systemInstruction, transcript, responseSchema));

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      const startedAt = Date.now();
      this.logger?.info(
        { provider: 'gemini', model: this.model, key: maskKey(this.apiKey), url: url.split('?')[0], bodyBytes: body.length, attempt },
        'Gemini generateContent →',
      );

      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
      const latencyMs = Date.now() - startedAt;
      const raw = await res.text();

      if (!res.ok) {
        this.logger?.error(
          { provider: 'gemini', model: this.model, status: res.status, latencyMs, body: raw.slice(0, 4096) },
          'Gemini generateContent failed',
        );
        // 429 (rate/quota) + 5xx are transient — back off and retry. A persistent 429 with
        // "limit: 0" means the model isn't on this key's tier (enable billing or use a free-tier
        // model like gemini-2.5-flash); the surfaced body makes that diagnosable.
        if ((res.status === 429 || res.status >= 500) && attempt < this.maxRetries) {
          if (this.backoffBaseMs > 0) await delay(this.backoffBaseMs * 2 ** attempt);
          continue;
        }
        const hint = res.status === 429 ? ' — quota/rate limit; check GEMINI_MODEL tier or enable billing' : '';
        throw new AppError(`Gemini extraction failed (HTTP ${res.status})${hint}`, 502, 'EXTRACTION_FAILED', {
          status: res.status,
          body: raw.slice(0, 500),
        });
      }

      const payload = JSON.parse(raw) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> }; finishReason?: string }>;
      };
      const candidate = payload.candidates?.[0];
      const text = candidate?.content?.parts?.[0]?.text;
      this.logger?.info(
        { provider: 'gemini', model: this.model, latencyMs, finishReason: candidate?.finishReason, preview: (text ?? '').slice(0, 200) },
        'Gemini generateContent ✓',
      );

      if (!text) {
        // finishReason=MAX_TOKENS → truncated before any text (shouldn't happen post-fix).
        throw new AppError(
          `Gemini returned no usable text (finishReason=${candidate?.finishReason ?? 'unknown'})`,
          502,
          'EXTRACTION_FAILED',
        );
      }
      try {
        return JSON.parse(text);
      } catch {
        this.logger?.error(
          { provider: 'gemini', finishReason: candidate?.finishReason, text: text.slice(0, 400) },
          'Gemini returned malformed JSON',
        );
        throw new AppError(
          `Gemini returned malformed JSON (finishReason=${candidate?.finishReason ?? 'unknown'})`,
          502,
          'EXTRACTION_FAILED',
        );
      }
    }
    throw new AppError('Gemini extraction failed', 502, 'EXTRACTION_FAILED');
  }

  async extractClinical(
    transcript: string,
    ctx: ClinicalExtractionContext,
  ): Promise<ClinicalExtraction> {
    const raw = await this.generate(
      buildClinicalSystemInstruction(ctx),
      transcript,
      CLINICAL_RESPONSE_SCHEMA,
    );
    return ClinicalExtraction.parse(raw);
  }

  async extractPrescription(
    transcript: string,
    ctx: PrescriptionContext,
  ): Promise<PrescriptionExtraction> {
    const raw = await this.generate(
      buildPrescriptionSystemInstruction(ctx),
      transcript,
      PRESCRIPTION_RESPONSE_SCHEMA,
    );
    return PrescriptionExtraction.parse(raw);
  }

  async extractPatientIntake(transcript: string): Promise<PatientIntakeExtraction> {
    const raw = await this.generate(
      PATIENT_INTAKE_SYSTEM_INSTRUCTION,
      transcript,
      INTAKE_RESPONSE_SCHEMA,
    );
    return PatientIntakeExtraction.parse(raw);
  }
}
