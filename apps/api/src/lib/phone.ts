/**
 * Indian phone-number normalization. We always store and look up the bare 10-digit
 * national number (no +91, spaces, or punctuation) so DB rows and Redis keys are stable
 * regardless of how the user typed it.
 */

/**
 * Strip everything but digits, drop a leading country code / trunk prefix, and keep the
 * last 10 digits. Returns the bare 10-digit number. Does NOT validate the 6-9 first-digit
 * rule — pass the result through `IndianPhone` (Zod) for that.
 */
export function normalizePhone(input: string): string {
  const digits = input.replace(/\D+/g, '');
  // Keep the last 10 digits — this transparently drops +91 / 91 / 0 prefixes.
  return digits.slice(-10);
}

/** Mask all but the last 4 digits for logs and audit metadata: 9876543210 → ******3210. */
export function maskPhone(phone: string): string {
  const norm = normalizePhone(phone);
  if (norm.length <= 4) return norm;
  return `${'*'.repeat(norm.length - 4)}${norm.slice(-4)}`;
}
