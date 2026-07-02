import { InventoryPurchaseExtraction } from '@odovox/types';
import type { GeminiSchema } from '../response-schema.js';
import type { Extractor } from './types.js';
import { parseQuantityItem, rupeesToPaise, splitSegments, stripLeadingVerb } from './mock-utils.js';

export const INVENTORY_PURCHASE_PROMPT_VERSION = 'inventory-purchase-v1';

export interface InventoryDictateContext {
  /** Clinic's known item names — hints only; matching happens server-side after extraction. */
  knownItemNames: string[];
}

const RESPONSE_SCHEMA: GeminiSchema = {
  type: 'OBJECT',
  properties: {
    items: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          name: { type: 'STRING' },
          quantity: { type: 'INTEGER' },
          unitPricePaise: { type: 'INTEGER', nullable: true },
          batchNumber: { type: 'STRING', nullable: true },
          expiryDate: { type: 'STRING', nullable: true },
          vendorName: { type: 'STRING', nullable: true },
        },
        required: ['name', 'quantity'],
      },
    },
    totalCostPaise: { type: 'INTEGER', nullable: true },
    notes: { type: 'STRING', nullable: true },
    clarifications: { type: 'ARRAY', items: { type: 'STRING' } },
  },
  required: ['items', 'clarifications'],
};

function buildSystemInstruction(ctx: InventoryDictateContext): string {
  return `You are an inventory assistant for an Indian dental clinic. Convert a spoken purchase log into strict JSON.

The clinic's known inventory items (spelling reference only — output what was SAID, matching happens later):
${ctx.knownItemNames.length ? ctx.knownItemNames.map((n) => `- ${n}`).join('\n') : 'none yet'}

INSTRUCTIONS:
1. Speech may be English, Hindi, Tamil, or code-mixed. Translate item names to English.
2. Extract each purchased item: name, quantity (integer), unit price if spoken.
3. MONEY: Indian costs are spoken in rupees (₹) — convert to paise (×100). "200 rupees each" → unitPricePaise 20000. Never invent a price; null when unspoken.
4. batchNumber / expiryDate (ISO yyyy-mm-dd) / vendorName ("from Meditrade") only when explicitly spoken; null otherwise.
5. totalCostPaise only when a total is spoken ("total three thousand" → 300000).
6. Anything ambiguous → null + a note in clarifications. NEVER invent items or numbers.
7. Return ONLY JSON matching the responseSchema.`;
}

/** Deterministic mock: "bought 5 boxes of gloves at 200 each and 2 burs from Meditrade, total 1400". */
function mockExtract(transcript: string, _ctx: InventoryDictateContext): InventoryPurchaseExtraction {
  let t = stripLeadingVerb(transcript.toLowerCase(), /^\s*(bought|purchased|received|added|add|got|log(?:ged)?)\b/i);

  let vendorName: string | null = null;
  const vendor = t.match(/\bfrom\s+([a-z][\w\s]*?)\s*(?:$|,|\btotal\b)/i);
  if (vendor) {
    vendorName = vendor[1]!.trim().replace(/\b\w/g, (c) => c.toUpperCase());
    t = t.replace(vendor[0]!, ' ');
  }

  let totalCostPaise: number | null = null;
  const total = t.match(/\btotal\s+(?:of\s+)?(?:₹|rs\.?\s*)?(\d+(?:\.\d+)?)/i);
  if (total) {
    totalCostPaise = rupeesToPaise(total[1]);
    t = t.replace(total[0]!, ' ');
  }

  const items = splitSegments(t)
    .map(parseQuantityItem)
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .map((x) => ({
      name: x.name,
      quantity: x.quantity,
      unitPricePaise: x.unitPricePaise,
      batchNumber: null,
      expiryDate: null,
      vendorName,
    }));

  return InventoryPurchaseExtraction.parse({
    items,
    totalCostPaise,
    notes: null,
    clarifications: items.length === 0 ? ['Could not identify any items — please add them manually.'] : [],
  });
}

export const inventoryPurchaseExtractor: Extractor<InventoryPurchaseExtraction, InventoryDictateContext> = {
  id: 'inventory-purchase',
  promptVersion: INVENTORY_PURCHASE_PROMPT_VERSION,
  buildSystemInstruction,
  responseSchema: RESPONSE_SCHEMA,
  zodSchema: InventoryPurchaseExtraction,
  mockExtract,
};
