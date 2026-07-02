/**
 * Deterministic keyword parsing shared by the Phase 9.7 extractor mocks. Mocks must behave like
 * the real provider for realistic inputs (docs/voice-pipeline.md "Mock isn't lying") — they
 * pattern-match quantities, names and rupee amounts rather than returning canned data.
 */

/** "₹200", "rs 200", "200 rupees", "2.5" → paise (int). Null when not numeric. */
export function rupeesToPaise(raw: string | undefined | null): number | null {
  if (!raw) return null;
  const num = Number.parseFloat(raw.replace(/[₹,]/g, '').trim());
  return Number.isFinite(num) ? Math.round(num * 100) : null;
}

/** Split a spoken list into item segments: "5 gloves and 2 burs, 1 kit" → 3 segments. */
export function splitSegments(t: string): string[] {
  return t
    .split(/,|\band\b|\bplus\b|\balso\b/i)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Strip a leading command verb ("bought", "add", "used", …) from a transcript. */
export function stripLeadingVerb(t: string, verbs: RegExp): string {
  return t.replace(verbs, '').trim();
}

const MONEY = String.raw`(?:₹|rs\.?\s*)?(\d+(?:\.\d+)?)\s*(?:rupees|rs)?`;

/** "<qty> <name> [at ₹<price> each]" → parts, or null when no quantity is present. */
export function parseQuantityItem(segment: string): { name: string; quantity: number; unitPricePaise: number | null } | null {
  const m = segment.match(
    new RegExp(
      String.raw`(\d+)\s+(?:boxes?\s+of\s+|packs?\s+of\s+|units?\s+of\s+)?([a-z][a-z\s\-]*?)(?:\s+(?:at|@|for)\s+${MONEY}(?:\s*each|\s*per\s+\w+)?)?\s*$`,
      'i',
    ),
  );
  if (!m) return null;
  return {
    name: m[2]!.trim(),
    quantity: Number.parseInt(m[1]!, 10),
    unitPricePaise: rupeesToPaise(m[3]),
  };
}
