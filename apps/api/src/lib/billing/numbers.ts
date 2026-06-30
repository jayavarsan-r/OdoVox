import { AppError } from '../errors.js';

// Ambiguous characters (0/O, 1/I) excluded so spoken/written numbers don't get mistyped.
// Mirrors the lab case-number alphabet (lib/lab/case-number.ts).
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function randomSuffix(len = 6): string {
  let out = '';
  for (let i = 0; i < len; i++) {
    out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return out;
}

function prefixFromJoinCode(joinCode: string): string {
  return (joinCode.replace(/[^A-Za-z]/g, '') + 'XX').slice(0, 2).toUpperCase();
}

/** `BL-{first2lettersOfJoinCode}{6 random alnum}`. Pure — use generateUnique* for collision safety. */
export function buildBillNumber(joinCode: string): string {
  return `BL-${prefixFromJoinCode(joinCode)}${randomSuffix()}`;
}

/** `PAY-{first2lettersOfJoinCode}{6 random alnum}`. */
export function buildPaymentNumber(joinCode: string): string {
  return `PAY-${prefixFromJoinCode(joinCode)}${randomSuffix()}`;
}

/** `RF-{first2lettersOfJoinCode}{6 random alnum}`. */
export function buildRefundNumber(joinCode: string): string {
  return `RF-${prefixFromJoinCode(joinCode)}${randomSuffix()}`;
}

/**
 * Collision-checked number for a clinic-scoped entity. `build` produces a candidate; `exists`
 * checks the (clinicId, number) unique index. Retries up to `maxTries`; the DB unique constraint
 * remains the final guard against the check+insert race (same approach as lib/lab/case-number.ts).
 */
export async function generateUniqueNumber(
  build: (joinCode: string) => string,
  exists: (candidate: string) => Promise<boolean>,
  joinCode: string,
  label = 'number',
  maxTries = 10,
): Promise<string> {
  for (let i = 0; i < maxTries; i++) {
    const candidate = build(joinCode);
    if (!(await exists(candidate))) return candidate;
  }
  throw new AppError(`Could not allocate a unique ${label}`, 500, 'BILLING_NUMBER_EXHAUSTED');
}
