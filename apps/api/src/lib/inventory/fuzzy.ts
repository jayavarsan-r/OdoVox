import type { InventoryItemMatch } from '@odovox/types';

/**
 * Phase 9.7 W1.2.1 — fuzzy-match a spoken item name against the clinic's InventoryItem catalog.
 * Catalogs are small (≤ a few hundred rows), so in-process scoring beats a DB trigram round-trip.
 * Deterministic and dependency-free: exact > containment > token overlap. Below the threshold the
 * item is "unmatched" and the verification card offers to create it.
 */

/** Lowercase, strip punctuation, collapse spaces, singularize each token's trailing 's'. */
export function normalizeItemName(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map((t) => (t.length > 3 && t.endsWith('s') ? t.slice(0, -1) : t))
    .join(' ');
}

export function scoreItemMatch(spoken: string, catalogName: string): number {
  const a = normalizeItemName(spoken);
  const b = normalizeItemName(catalogName);
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.includes(b) || b.includes(a)) return 0.85;
  const ta = new Set(a.split(' '));
  const tb = new Set(b.split(' '));
  const shared = [...ta].filter((t) => tb.has(t)).length;
  if (shared === 0) return 0;
  // Jaccard over tokens — "latex gloves" vs "gloves latex free" scores well.
  return (0.8 * shared) / (ta.size + tb.size - shared);
}

export const ITEM_MATCH_THRESHOLD = 0.4;

export interface CatalogItem {
  id: string;
  name: string;
  unitOfMeasure: string;
  currentStock: number;
}

/** Best catalog match for a spoken name, or null when nothing clears the threshold. */
export function fuzzyMatchInventoryItem(spoken: string, catalog: CatalogItem[]): InventoryItemMatch | null {
  let best: InventoryItemMatch | null = null;
  for (const item of catalog) {
    const score = scoreItemMatch(spoken, item.name);
    if (score >= ITEM_MATCH_THRESHOLD && (!best || score > best.score)) {
      best = { itemId: item.id, name: item.name, unitOfMeasure: item.unitOfMeasure, currentStock: item.currentStock, score };
    }
  }
  return best;
}
