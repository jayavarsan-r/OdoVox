import { AppointmentExtraction } from '@odovox/types';
import type { GeminiSchema } from '../response-schema.js';
import type { Extractor } from './types.js';

export const APPOINTMENT_PROMPT_VERSION = 'appointment-v1';

export interface AppointmentDictateContext {
  doctorNames: string[];
}

const RESPONSE_SCHEMA: GeminiSchema = {
  type: 'OBJECT',
  properties: {
    patientName: { type: 'STRING', nullable: true },
    doctorName: { type: 'STRING', nullable: true },
    dateTimePhrase: { type: 'STRING', nullable: true },
    durationMinutes: { type: 'INTEGER', nullable: true },
    procedureHint: { type: 'STRING', nullable: true },
    notes: { type: 'STRING', nullable: true },
    isRecurring: { type: 'BOOLEAN' },
    recurringInterval: { type: 'STRING', enum: ['WEEKLY', 'BIWEEKLY', 'MONTHLY'], nullable: true },
    recurringCount: { type: 'INTEGER', nullable: true },
    clarifications: { type: 'ARRAY', items: { type: 'STRING' } },
  },
  required: ['isRecurring', 'clarifications'],
};

function buildSystemInstruction(ctx: AppointmentDictateContext): string {
  return `You are a scheduling assistant for an Indian dental clinic. Convert a spoken booking request into strict JSON.

Doctors in this clinic (spelling reference only):
${ctx.doctorNames.length ? ctx.doctorNames.map((n) => `- ${n}`).join('\n') : 'none'}

INSTRUCTIONS:
1. Speech may be English, Hindi, Tamil, or code-mixed.
2. patientName / doctorName exactly as spoken (matching happens server-side); null when absent.
3. dateTimePhrase: copy the date/time words VERBATIM ("next Monday at 10 am", "tomorrow evening", "Aug 15"). Do NOT compute a date yourself — the server parses the phrase. Null when no date was spoken.
4. durationMinutes only when spoken ("thirty minutes" → 30); null otherwise.
5. procedureHint: the treatment named ("cleaning", "RCT", "crown fitting"); null otherwise.
6. Recurring: "every week for six weeks" → isRecurring true, recurringInterval WEEKLY, recurringCount 6. "every two weeks" → BIWEEKLY, "every month" → MONTHLY. Otherwise isRecurring false, both null.
7. Ambiguities → clarifications. NEVER invent names, dates, or counts.
8. Return ONLY JSON matching the responseSchema.`;
}

const PROCEDURES = /\b(cleaning|scaling|filling|extraction|rct|root canal|crown(?:\s+fitting)?|checkup|check-up|review|implant|braces|aligner|whitening|polishing|denture)\b/i;

/** Deterministic mock: "Book cleaning for Ramesh with Dr Asha next Monday at 10 am for 30 minutes every week for 6 weeks". */
function mockExtract(transcript: string, _ctx: AppointmentDictateContext): AppointmentExtraction {
  const t = transcript.toLowerCase();

  const procedure = t.match(PROCEDURES)?.[1] ?? null;

  // Names run until a scheduling stop-word so "with Dr Asha on July 16" captures just "asha".
  const STOP = String.raw`(?!(?:on|at|next|this|tomorrow|today|every|for|with|and)\b)`;
  const NAME = String.raw`(${STOP}[a-z]+(?:\s+${STOP}[a-z]+)?)`;
  const doctor = t.match(new RegExp(String.raw`\bwith\s+(?:dr\.?\s*|doctor\s+)?${NAME}`, 'i'));
  // Patient: the first name after "for" that isn't a duration or the procedure word.
  const patient = [...t.matchAll(new RegExp(String.raw`\bfor\s+${NAME}`, 'gi'))]
    .map((m) => m[1]!.trim())
    .find((name) => !/^\d/.test(name) && !PROCEDURES.test(name));

  const duration = t.match(/(\d+)\s*min/);

  const every = t.match(/\bevery\s+(week|two\s+weeks|fortnight|2\s+weeks|month)/i);
  const interval = every
    ? /two|2|fortnight/.test(every[1]!)
      ? ('BIWEEKLY' as const)
      : every[1]!.startsWith('month')
        ? ('MONTHLY' as const)
        : ('WEEKLY' as const)
    : null;
  const count = t.match(/(?:for\s+)?(\d+)\s+(?:weeks|months|sittings|sessions|visits|times)\b/);

  return AppointmentExtraction.parse({
    patientName: patient ? patient.replace(/\b\w/g, (c) => c.toUpperCase()) : null,
    doctorName: doctor ? doctor[1]!.replace(/\b\w/g, (c) => c.toUpperCase()) : null,
    dateTimePhrase: null, // server chrono-parses the full transcript for the mock path
    durationMinutes: duration ? Number.parseInt(duration[1]!, 10) : null,
    procedureHint: procedure,
    notes: null,
    isRecurring: interval !== null,
    recurringInterval: interval,
    recurringCount: interval && count ? Number.parseInt(count[1]!, 10) : null,
    clarifications: [],
  });
}

export const appointmentExtractor: Extractor<AppointmentExtraction, AppointmentDictateContext> = {
  id: 'appointment',
  promptVersion: APPOINTMENT_PROMPT_VERSION,
  buildSystemInstruction,
  responseSchema: RESPONSE_SCHEMA,
  zodSchema: AppointmentExtraction,
  mockExtract,
};
