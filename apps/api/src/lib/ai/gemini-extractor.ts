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
/** Cost budget: cap output at 500 tokens (the structured object is small). */
const MAX_OUTPUT_TOKENS = 500;

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

  constructor(
    opts?: { apiKey?: string; model?: string },
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
    this.model = opts?.model ?? process.env.GEMINI_MODEL ?? 'gemini-2.0-flash';
  }

  private async generate(
    systemInstruction: string,
    transcript: string,
    responseSchema: GeminiSchema,
  ): Promise<unknown> {
    const userText = transcript.slice(0, MAX_INPUT_CHARS);
    const url = `${GEMINI_BASE}/${this.model}:generateContent?key=${this.apiKey}`;

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemInstruction }] },
        contents: [{ role: 'user', parts: [{ text: userText }] }],
        generationConfig: {
          temperature: 0,
          maxOutputTokens: MAX_OUTPUT_TOKENS,
          responseMimeType: 'application/json',
          responseSchema,
        },
      }),
    });

    if (!res.ok) {
      this.logger?.error({ status: res.status }, 'Gemini generateContent failed');
      throw new AppError(`Gemini extraction failed (HTTP ${res.status})`, 502, 'EXTRACTION_FAILED');
    }

    const payload = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const text = payload.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      throw new AppError('Gemini returned no candidate text to extract', 502, 'EXTRACTION_FAILED');
    }

    try {
      return JSON.parse(text);
    } catch {
      this.logger?.error({ text: text.slice(0, 200) }, 'Gemini returned malformed JSON');
      throw new AppError('Gemini returned malformed JSON to extract', 502, 'EXTRACTION_FAILED');
    }
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
