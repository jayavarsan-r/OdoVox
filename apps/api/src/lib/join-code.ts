import { Prisma, type PrismaClient } from '@odovox/db';
import { AppError } from './errors.js';

/**
 * Clinic join codes: a 5-letter prefix derived from the clinic name plus a single digit
 * (e.g. "SMILE7"). They're short enough to read over the phone and text to a colleague.
 *
 * Uniqueness is ultimately guaranteed by the DB unique constraint on Clinic.joinCode;
 * `createWithUniqueJoinCode` retries on a unique-violation so concurrent creators can never
 * end up sharing a code. The candidate generator just keeps collisions rare.
 */

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const MAX_ATTEMPTS = 20;
/** After this many same-prefix attempts, fall back to a fully random prefix. */
const PREFIX_RETRY_THRESHOLD = 10;

function randomLetter(rng: () => number): string {
  return LETTERS[Math.floor(rng() * LETTERS.length)]!;
}

function randomDigit(rng: () => number): string {
  return String(Math.floor(rng() * 10));
}

function randomPrefix(rng: () => number): string {
  let out = '';
  for (let i = 0; i < 5; i++) out += randomLetter(rng);
  return out;
}

/** The 5-letter prefix from a clinic name, padded with random letters when too short. */
export function joinCodePrefix(clinicName: string, rng: () => number = Math.random): string {
  const letters = clinicName.toUpperCase().replace(/[^A-Z]/g, '');
  let prefix = letters.slice(0, 5);
  while (prefix.length < 5) prefix += randomLetter(rng);
  return prefix;
}

/**
 * Produce one candidate join code for the given attempt. Early attempts keep the
 * name-derived prefix (just varying the digit); once we've exhausted those, switch to a
 * random prefix so a busy name can't lock us out.
 */
export function generateJoinCodeCandidate(
  clinicName: string,
  attempt = 0,
  rng: () => number = Math.random,
): string {
  const prefix = attempt < PREFIX_RETRY_THRESHOLD ? joinCodePrefix(clinicName, rng) : randomPrefix(rng);
  return `${prefix}${randomDigit(rng)}`;
}

/**
 * Best-effort: return a join code that isn't currently taken (checked against the DB).
 * Matches the Phase 1 spec signature. NOTE: this is racy on its own — the authoritative
 * guarantee is `createWithUniqueJoinCode`, which retries against the unique constraint.
 */
export async function generateUniqueJoinCode(
  clinicName: string,
  prisma: Pick<PrismaClient, 'clinic'>,
): Promise<string> {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const code = generateJoinCodeCandidate(clinicName, attempt);
    const existing = await prisma.clinic.findUnique({ where: { joinCode: code } });
    if (!existing) return code;
  }
  throw new AppError(
    'Could not generate a unique join code',
    500,
    'JOIN_CODE_EXHAUSTED',
  );
}

function isUniqueViolation(err: unknown): boolean {
  return (
    err instanceof Prisma.PrismaClientKnownRequestError &&
    err.code === 'P2002' &&
    (Array.isArray(err.meta?.target)
      ? (err.meta.target as string[]).includes('joinCode')
      : String(err.meta?.target ?? '').includes('joinCode'))
  );
}

/**
 * Create something keyed on a unique join code, retrying with a fresh code whenever the
 * unique constraint is violated. This is the concurrency-safe path used by the create route.
 */
export async function createWithUniqueJoinCode<T>(
  clinicName: string,
  create: (joinCode: string) => Promise<T>,
): Promise<{ result: T; joinCode: string }> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const joinCode = generateJoinCodeCandidate(clinicName, attempt);
    try {
      const result = await create(joinCode);
      return { result, joinCode };
    } catch (err) {
      if (isUniqueViolation(err)) {
        lastErr = err;
        continue;
      }
      throw err;
    }
  }
  throw new AppError(
    'Could not generate a unique join code',
    500,
    'JOIN_CODE_EXHAUSTED',
    lastErr instanceof Error ? lastErr.message : undefined,
  );
}
