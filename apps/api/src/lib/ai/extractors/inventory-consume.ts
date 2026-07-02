import { InventoryConsumeExtraction } from '@odovox/types';
import type { GeminiSchema } from '../response-schema.js';
import type { Extractor } from './types.js';
import type { InventoryDictateContext } from './inventory-purchase.js';
import { splitSegments, stripLeadingVerb } from './mock-utils.js';

export const INVENTORY_CONSUME_PROMPT_VERSION = 'inventory-consume-v1';

const RESPONSE_SCHEMA: GeminiSchema = {
  type: 'OBJECT',
  properties: {
    items: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: { name: { type: 'STRING' }, quantity: { type: 'INTEGER' } },
        required: ['name', 'quantity'],
      },
    },
    procedureName: { type: 'STRING', nullable: true },
    notes: { type: 'STRING', nullable: true },
    clarifications: { type: 'ARRAY', items: { type: 'STRING' } },
  },
  required: ['items', 'clarifications'],
};

function buildSystemInstruction(ctx: InventoryDictateContext): string {
  return `You are an inventory assistant for an Indian dental clinic. A doctor is dictating materials CONSUMED during treatment ("used 5 gloves and 2 carpules for this filling"). Convert to strict JSON.

The clinic's known inventory items (spelling reference only):
${ctx.knownItemNames.length ? ctx.knownItemNames.map((n) => `- ${n}`).join('\n') : 'none yet'}

INSTRUCTIONS:
1. Speech may be English, Hindi, Tamil, or code-mixed. Translate item names to English.
2. Extract each consumed item: name + quantity (integer). Quantities are counts, never money.
3. procedureName when the doctor names one ("for this filling" → "filling"); null otherwise.
4. Anything ambiguous → clarifications. NEVER invent items or quantities.
5. Return ONLY JSON matching the responseSchema.`;
}

/** Deterministic mock: "used 5 gloves and 2 carpules for this filling". */
function mockExtract(transcript: string, _ctx: InventoryDictateContext): InventoryConsumeExtraction {
  let t = stripLeadingVerb(transcript.toLowerCase(), /^\s*(used|consumed|took)\b/i);

  let procedureName: string | null = null;
  const proc = t.match(/\bfor\s+(?:this\s+|the\s+|today'?s\s+)?([a-z][a-z\s]*?)\s*[.?!]?\s*$/i);
  if (proc) {
    procedureName = proc[1]!.trim();
    t = t.slice(0, proc.index);
  }

  const items = splitSegments(t)
    .map((seg) => seg.match(/(\d+)\s+([a-z][a-z\s-]*?)\s*$/i))
    .filter((m): m is RegExpMatchArray => m !== null)
    .map((m) => ({ name: m[2]!.trim(), quantity: Number.parseInt(m[1]!, 10) }));

  return InventoryConsumeExtraction.parse({
    items,
    procedureName,
    notes: null,
    clarifications: items.length === 0 ? ['Could not identify any items — please add them manually.'] : [],
  });
}

export const inventoryConsumeExtractor: Extractor<InventoryConsumeExtraction, InventoryDictateContext> = {
  id: 'inventory-consume',
  promptVersion: INVENTORY_CONSUME_PROMPT_VERSION,
  buildSystemInstruction,
  responseSchema: RESPONSE_SCHEMA,
  zodSchema: InventoryConsumeExtraction,
  mockExtract,
};
