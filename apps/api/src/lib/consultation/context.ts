import { decryptField } from '../encryption.js';

function safeDecrypt(value: string | null): string | null {
  if (!value) return null;
  try {
    return decryptField(value);
  } catch {
    return null;
  }
}

/**
 * Allergies are stored as one encrypted free-text string; split it into discrete terms for the
 * safety cross-check. "None known" / "Nil" style entries are dropped so they never match a class.
 */
export function parseAllergies(allergiesEnc: string | null): string[] {
  const plain = safeDecrypt(allergiesEnc);
  if (!plain) return [];
  return plain
    .split(/[,;/]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !/^(none|nil|nka|no known)\b/i.test(s));
}
