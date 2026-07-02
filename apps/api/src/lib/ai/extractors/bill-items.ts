import { BillItemsExtraction } from '@odovox/types';
import type { GeminiSchema } from '../response-schema.js';
import type { Extractor } from './types.js';
import { rupeesToPaise, splitSegments, stripLeadingVerb } from './mock-utils.js';

export const BILL_ITEMS_PROMPT_VERSION = 'bill-items-v1';

export interface BillDictateContext {
  patientName: string;
}

const RESPONSE_SCHEMA: GeminiSchema = {
  type: 'OBJECT',
  properties: {
    items: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          description: { type: 'STRING' },
          quantity: { type: 'INTEGER' },
          unitPricePaise: { type: 'INTEGER' },
        },
        required: ['description', 'quantity', 'unitPricePaise'],
      },
    },
    discountPaise: { type: 'INTEGER', nullable: true },
    discountReason: { type: 'STRING', nullable: true },
    notes: { type: 'STRING', nullable: true },
    clarifications: { type: 'ARRAY', items: { type: 'STRING' } },
  },
  required: ['items', 'clarifications'],
};

function buildSystemInstruction(ctx: BillDictateContext): string {
  return `You are a billing assistant for an Indian dental clinic. A receptionist is dictating bill line items for patient ${ctx.patientName}. Convert to strict JSON.

INSTRUCTIONS:
1. Each line: description (e.g. "X-ray", "Scaling"), quantity (default 1), unit price.
2. MONEY: rupees spoken → paise output (×100). "X-ray 300 rupees" → unitPricePaise 30000. Never invent a price — if an item has no spoken price, put it in clarifications instead of items.
3. discountPaise only for an absolute spoken discount ("200 rupees off" → 20000). A percentage discount goes to clarifications (the bill computes it).
4. discountReason when spoken ("senior citizen"); null otherwise.
5. Return ONLY JSON matching the responseSchema.`;
}

/** Deterministic mock: "x-ray 300 rupees, scaling 1500, discount 200 for senior citizen". */
function mockExtract(transcript: string, _ctx: BillDictateContext): BillItemsExtraction {
  let t = stripLeadingVerb(transcript.toLowerCase(), /^\s*(add|bill|charge)\b/i);

  let discountPaise: number | null = null;
  let discountReason: string | null = null;
  const disc = t.match(/\bdiscount\s+(?:of\s+)?(?:₹|rs\.?\s*)?(\d+(?:\.\d+)?)\s*(?:rupees|rs)?(?:\s+for\s+(.+?))?\s*[.?!]?\s*$/i);
  if (disc) {
    discountPaise = rupeesToPaise(disc[1]);
    discountReason = disc[2]?.trim() ?? null;
    t = t.slice(0, disc.index);
  }

  const items = splitSegments(t)
    .map((seg) =>
      seg.match(/(?:(\d+)\s*(?:x|×)\s*)?([a-z][a-z\s-]*?)\s+(?:at\s+|@\s*|for\s+)?(?:₹|rs\.?\s*)?(\d+(?:\.\d+)?)\s*(?:rupees|rs)?\s*(?:each)?\s*$/i),
    )
    .filter((m): m is RegExpMatchArray => m !== null)
    .map((m) => ({
      description: m[2]!.trim().replace(/\b\w/g, (c) => c.toUpperCase()),
      quantity: m[1] ? Number.parseInt(m[1]!, 10) : 1,
      unitPricePaise: rupeesToPaise(m[3]) ?? 0,
    }));

  return BillItemsExtraction.parse({
    items,
    discountPaise,
    discountReason,
    notes: null,
    clarifications: items.length === 0 ? ['Could not identify any line items — please add them manually.'] : [],
  });
}

export const billItemsExtractor: Extractor<BillItemsExtraction, BillDictateContext> = {
  id: 'bill-items',
  promptVersion: BILL_ITEMS_PROMPT_VERSION,
  buildSystemInstruction,
  responseSchema: RESPONSE_SCHEMA,
  zodSchema: BillItemsExtraction,
  mockExtract,
};
