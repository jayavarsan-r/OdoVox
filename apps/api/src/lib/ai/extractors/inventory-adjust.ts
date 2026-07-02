import { InventoryAdjustExtraction } from '@odovox/types';
import type { GeminiSchema } from '../response-schema.js';
import type { Extractor } from './types.js';
import type { InventoryDictateContext } from './inventory-purchase.js';
import { splitSegments, stripLeadingVerb } from './mock-utils.js';

export const INVENTORY_ADJUST_PROMPT_VERSION = 'inventory-adjust-v1';

const RESPONSE_SCHEMA: GeminiSchema = {
  type: 'OBJECT',
  properties: {
    items: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: { name: { type: 'STRING' }, newCount: { type: 'INTEGER' } },
        required: ['name', 'newCount'],
      },
    },
    reason: { type: 'STRING', nullable: true },
    clarifications: { type: 'ARRAY', items: { type: 'STRING' } },
  },
  required: ['items', 'clarifications'],
};

function buildSystemInstruction(ctx: InventoryDictateContext): string {
  return `You are an inventory assistant for an Indian dental clinic. An admin is dictating a STOCK COUNT correction ("gloves are actually 40, burs 12 — quarterly stock count"). Convert to strict JSON.

The clinic's known inventory items (spelling reference only):
${ctx.knownItemNames.length ? ctx.knownItemNames.map((n) => `- ${n}`).join('\n') : 'none yet'}

INSTRUCTIONS:
1. Each item gets its ABSOLUTE corrected count (newCount) — not a delta.
2. reason when spoken ("quarterly stock count", "damaged box discarded"); null otherwise.
3. Anything ambiguous → clarifications. NEVER invent items or counts.
4. Return ONLY JSON matching the responseSchema.`;
}

/** Deterministic mock: "gloves are actually 40 and burs 12 because quarterly stock count". */
function mockExtract(transcript: string, _ctx: InventoryDictateContext): InventoryAdjustExtraction {
  let t = stripLeadingVerb(transcript.toLowerCase(), /^\s*(adjust|correct|set|stock count[:,]?)\b/i);

  let reason: string | null = null;
  const r = t.match(/\s*(?:because(?:\s+of)?|reason(?:\s+is)?[:,]?|due\s+to|—|--)\s+(.+?)\s*[.?!]?\s*$/i);
  if (r) {
    reason = r[1]!.trim();
    t = t.slice(0, r.index);
  }

  const items = splitSegments(t)
    .map((seg) => seg.match(/([a-z][a-z\s-]*?)\s+(?:are|is)?\s*(?:actually|now|to|at)?\s*(\d+)\s*$/i))
    .filter((m): m is RegExpMatchArray => m !== null)
    .map((m) => ({ name: m[1]!.trim(), newCount: Number.parseInt(m[2]!, 10) }));

  return InventoryAdjustExtraction.parse({
    items,
    reason,
    clarifications: items.length === 0 ? ['Could not identify any counts — please adjust manually.'] : [],
  });
}

export const inventoryAdjustExtractor: Extractor<InventoryAdjustExtraction, InventoryDictateContext> = {
  id: 'inventory-adjust',
  promptVersion: INVENTORY_ADJUST_PROMPT_VERSION,
  buildSystemInstruction,
  responseSchema: RESPONSE_SCHEMA,
  zodSchema: InventoryAdjustExtraction,
  mockExtract,
};
