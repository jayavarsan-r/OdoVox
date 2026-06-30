import { AppError } from '../errors.js';

// Structural minimum the collision check needs — works with the extended Prisma client.
interface CaseNumberLookup {
  labCase: {
    findFirst(args: {
      where: { clinicId: string; caseNumber: string };
      select: { id: true };
    }): Promise<{ id: string } | null>;
  };
}

// Ambiguous characters (0/O, 1/I) excluded so spoken/written case numbers don't get mistyped.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function randomSuffix(len = 6): string {
  let out = '';
  for (let i = 0; i < len; i++) {
    out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return out;
}

/**
 * Build a case number: `LC-{first2lettersOfJoinCode}{6 random alnum}`.
 * Example: clinic SMILE7 → LC-SMQ7XK4P. Pure (no DB) — use generateUniqueCaseNumber for collision-safe values.
 */
export function buildCaseNumber(joinCode: string): string {
  const prefix = (joinCode.replace(/[^A-Za-z]/g, '') + 'XX').slice(0, 2).toUpperCase();
  return `LC-${prefix}${randomSuffix()}`;
}

/**
 * Collision-checked case number for a clinic. Retries up to `maxTries` against the (clinicId,
 * caseNumber) unique index. The check + insert still race in theory, so the caller's create relies
 * on the DB unique constraint as the final guard — but retrying here makes a real collision astronomically rare.
 */
export async function generateUniqueCaseNumber(
  prisma: CaseNumberLookup,
  clinicId: string,
  joinCode: string,
  maxTries = 10,
): Promise<string> {
  for (let i = 0; i < maxTries; i++) {
    const candidate = buildCaseNumber(joinCode);
    const existing = await prisma.labCase.findFirst({
      where: { clinicId, caseNumber: candidate },
      select: { id: true },
    });
    if (!existing) return candidate;
  }
  throw new AppError('Could not allocate a unique case number', 500, 'CASE_NUMBER_EXHAUSTED');
}
