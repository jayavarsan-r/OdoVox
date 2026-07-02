import { LabNewCaseExtraction } from '@odovox/types';
import type { GeminiSchema } from '../response-schema.js';
import type { Extractor } from './types.js';
import { rupeesToPaise } from './mock-utils.js';

export const LAB_NEW_CASE_PROMPT_VERSION = 'lab-new-case-v1';

export interface LabNewCaseContext {
  vendorNames: string[];
}

const RESPONSE_SCHEMA: GeminiSchema = {
  type: 'OBJECT',
  properties: {
    patientName: { type: 'STRING', nullable: true },
    type: {
      type: 'STRING',
      enum: ['CROWN', 'BRIDGE', 'DENTURE_FULL', 'DENTURE_PARTIAL', 'ALIGNER', 'NIGHT_GUARD', 'OCCLUSAL_SPLINT', 'VENEER', 'INLAY_ONLAY', 'RPD', 'OTHER'],
      nullable: true,
    },
    teeth: { type: 'ARRAY', items: { type: 'INTEGER' } },
    material: { type: 'STRING', nullable: true },
    shade: { type: 'STRING', nullable: true },
    description: { type: 'STRING', nullable: true },
    vendorName: { type: 'STRING', nullable: true },
    expectedTurnaroundDays: { type: 'INTEGER', nullable: true },
    costPaise: { type: 'INTEGER', nullable: true },
    patientChargePaise: { type: 'INTEGER', nullable: true },
    notes: { type: 'STRING', nullable: true },
    clarifications: { type: 'ARRAY', items: { type: 'STRING' } },
  },
  required: ['teeth', 'clarifications'],
};

function buildSystemInstruction(ctx: LabNewCaseContext): string {
  return `You are a lab-case assistant for an Indian dental clinic. Convert a spoken lab-case brief into strict JSON.

Labs this clinic works with (spelling reference only — matching happens server-side):
${ctx.vendorNames.length ? ctx.vendorNames.map((n) => `- ${n}`).join('\n') : 'none yet'}

INSTRUCTIONS:
1. Speech may be English, Hindi, Tamil, or code-mixed.
2. type: the prosthetic kind (CROWN, BRIDGE, DENTURE_FULL, DENTURE_PARTIAL, ALIGNER, VENEER, INLAY_ONLAY, NIGHT_GUARD, OCCLUSAL_SPLINT, RPD, OTHER); null when unstated.
3. teeth: FDI numbers exactly as spoken ("tooth twenty six" → 26).
4. shade like A1/A2/B1; material like zirconia, PFM, e-max, acrylic — only when spoken.
5. expectedTurnaroundDays from phrases like "in one week" → 7, "15 days" → 15.
6. MONEY in rupees → paise (×100). costPaise = what the LAB charges; patientChargePaise = what the PATIENT will be charged (only when both are clearly distinguished; else costPaise).
7. NEVER invent values; null liberally + clarifications. Return ONLY JSON matching the responseSchema.`;
}

const TYPE_KEYWORDS: Array<[RegExp, LabNewCaseExtraction['type']]> = [
  [/\bbridge\b/i, 'BRIDGE'],
  [/\bfull\s+denture|complete\s+denture\b/i, 'DENTURE_FULL'],
  [/\bpartial\s+denture\b/i, 'DENTURE_PARTIAL'],
  [/\bdenture\b/i, 'DENTURE_FULL'],
  [/\baligner\b/i, 'ALIGNER'],
  [/\bnight\s*guard\b/i, 'NIGHT_GUARD'],
  [/\bsplint\b/i, 'OCCLUSAL_SPLINT'],
  [/\bveneer\b/i, 'VENEER'],
  [/\binlay|onlay\b/i, 'INLAY_ONLAY'],
  [/\brpd\b/i, 'RPD'],
  [/\bcrown\b/i, 'CROWN'],
];

/** Deterministic mock: "Zirconia crown for Ramesh tooth 26 shade A2 from Saveetha lab in 7 days for 3000 rupees". */
function mockExtract(transcript: string, _ctx: LabNewCaseContext): LabNewCaseExtraction {
  const t = transcript.toLowerCase();

  const type = TYPE_KEYWORDS.find(([re]) => re.test(t))?.[1] ?? null;
  const teeth = [...t.matchAll(/\b(?:tooth|teeth|for tooth)\s+((?:\d{2}\s*(?:,|and)?\s*)+)/gi)]
    .flatMap((m) => m[1]!.match(/\d{2}/g) ?? [])
    .map(Number);
  const shade = t.match(/\bshade\s+([a-d]\s?\d(?:\.5)?)/i)?.[1]?.toUpperCase().replace(/\s/, '') ?? null;
  const material = t.match(/\b(zirconia|pfm|e-?max|emax|metal|acrylic|ceramic|lithium disilicate)\b/i)?.[1] ?? null;
  const vendor = t.match(/\b(?:from|to|send to)\s+([a-z][\w\s]*?(?:lab|ceramics|dental works|dental lab)\w*)/i)?.[1] ?? null;
  const days = t.match(/\b(?:in|within)\s+(\d+)\s+days?\b/i)?.[1] ?? (/\b(?:in\s+)?(?:one|a)\s+week\b/i.test(t) ? '7' : (/\btwo\s+weeks?\b/i.test(t) ? '14' : null));
  const cost = t.match(/(?:₹|rs\.?\s*)?(\d{3,6})\s*(?:rupees|rs)\b/i)?.[1] ?? null;
  const patient = t.match(/\bfor\s+(?!tooth|teeth)([a-z]+(?:\s+(?!tooth|teeth)[a-z]+)?)/i)?.[1] ?? null;

  return LabNewCaseExtraction.parse({
    patientName: patient ? patient.replace(/\b\w/g, (c) => c.toUpperCase()) : null,
    type,
    teeth,
    material,
    shade,
    description: null,
    vendorName: vendor ? vendor.replace(/\b\w/g, (c) => c.toUpperCase()) : null,
    expectedTurnaroundDays: days ? Number.parseInt(days, 10) : null,
    costPaise: rupeesToPaise(cost),
    patientChargePaise: null,
    notes: null,
    clarifications: type === null ? ['Case type was not clear — please pick one.'] : [],
  });
}

export const labNewCaseExtractor: Extractor<LabNewCaseExtraction, LabNewCaseContext> = {
  id: 'lab-new-case',
  promptVersion: LAB_NEW_CASE_PROMPT_VERSION,
  buildSystemInstruction,
  responseSchema: RESPONSE_SCHEMA,
  zodSchema: LabNewCaseExtraction,
  mockExtract,
};
