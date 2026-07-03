import { z } from 'zod';
import type { GeminiSchema } from '../response-schema.js';
import type { Extractor } from './types.js';
import { extractCaseCode, matchStatusKeyword } from '../../lab-transport/keywords.js';

export const LAB_REPLY_PROMPT_VERSION = 'lab-reply-v1';

/**
 * Phase 9.7 §2.9 tier 3 — LLM fallback for lab messages tier 2 couldn't resolve. Context is the
 * lab's OPEN cases with this clinic, injected whole (same no-RAG pattern as the voice pipeline).
 * Strict gates live in the caller: both confidences ≥ 0.85 AND exactly one plausible case.
 */

export interface LabReplyContext {
  vendorName: string;
  openCases: Array<{
    id: string;
    caseCode: string | null;
    caseType: string;
    teeth: number[];
    patientInitials: string;
    status: string;
  }>;
}

export const LabReplyExtraction = z.object({
  caseCode: z.string().nullable().default(null),
  caseCodeConfidence: z.number().min(0).max(1).default(0),
  newStatus: z.enum(['ACKNOWLEDGED', 'IN_PROGRESS', 'READY', 'DISPATCHED', 'ISSUE_RAISED']).nullable().default(null),
  statusConfidence: z.number().min(0).max(1).default(0),
  extractedInfo: z.string().nullable().default(null),
  issueRaised: z.string().nullable().default(null),
  requiresManualHandling: z.boolean().default(false),
});
export type LabReplyExtraction = z.infer<typeof LabReplyExtraction>;

const RESPONSE_SCHEMA: GeminiSchema = {
  type: 'OBJECT',
  properties: {
    caseCode: { type: 'STRING', nullable: true },
    caseCodeConfidence: { type: 'NUMBER' },
    newStatus: { type: 'STRING', enum: ['ACKNOWLEDGED', 'IN_PROGRESS', 'READY', 'DISPATCHED', 'ISSUE_RAISED'], nullable: true },
    statusConfidence: { type: 'NUMBER' },
    extractedInfo: { type: 'STRING', nullable: true },
    issueRaised: { type: 'STRING', nullable: true },
    requiresManualHandling: { type: 'BOOLEAN' },
  },
  required: ['caseCodeConfidence', 'statusConfidence', 'requiresManualHandling'],
};

function buildSystemInstruction(ctx: LabReplyContext): string {
  return `The following is a WhatsApp message from a dental lab technician to a clinic. Extract structured status information.

Lab: ${ctx.vendorName}
Open cases with this clinic:
${ctx.openCases.map((c) => `- ${c.caseCode ?? '(no code)'}: ${c.caseType} tooth ${c.teeth.join(',')} for ${c.patientInitials}, currently ${c.status}`).join('\n') || '- none'}

Output JSON only, matching the responseSchema.

Rules:
- The message may be English, Tamil, Hindi, or romanized code-mix.
- caseCode must EXACTLY match one of the open cases above; null otherwise.
- If there is only 1 open case with this lab, caseCodeConfidence can be 1.0 without an explicit code.
- Never guess a status not clearly indicated. Return null fields liberally.
- issueRaised: the lab's own words when they report a problem/delay/remake.
- requiresManualHandling: true when a human should read this (questions, pricing, anything unclear).`;
}

/**
 * Deterministic mock — mirrors the real model's contract: keyword → status @0.9; explicit code
 * @1.0; single open case @1.0; multiple cases without a code @0.4 (fails the single-candidate
 * gate → tier 4). No keyword → requiresManualHandling.
 */
function mockExtract(transcript: string, ctx: LabReplyContext): LabReplyExtraction {
  const keyword = matchStatusKeyword(transcript);
  const spokenCode = extractCaseCode(transcript);
  const codeMatch = spokenCode ? ctx.openCases.find((c) => c.caseCode === spokenCode) : null;

  let caseCode: string | null = null;
  let caseCodeConfidence = 0;
  if (codeMatch) {
    caseCode = codeMatch.caseCode;
    caseCodeConfidence = 1;
  } else if (ctx.openCases.length === 1) {
    caseCode = ctx.openCases[0]!.caseCode;
    caseCodeConfidence = 1;
  } else if (ctx.openCases.length > 1) {
    caseCodeConfidence = 0.4; // plausible but ambiguous — the gate sends this to reception
  }

  const status = keyword && keyword.status !== 'CANCELLED' && keyword.status !== 'RECEIVED' ? keyword.status : null;
  return LabReplyExtraction.parse({
    caseCode,
    caseCodeConfidence,
    newStatus: status as LabReplyExtraction['newStatus'],
    statusConfidence: status ? 0.9 : 0,
    extractedInfo: null,
    issueRaised: status === 'ISSUE_RAISED' ? transcript.slice(0, 200) : null,
    requiresManualHandling: !status,
  });
}

export const labReplyExtractor: Extractor<LabReplyExtraction, LabReplyContext> = {
  id: 'lab-reply',
  promptVersion: LAB_REPLY_PROMPT_VERSION,
  buildSystemInstruction,
  responseSchema: RESPONSE_SCHEMA,
  zodSchema: LabReplyExtraction,
  mockExtract,
};
