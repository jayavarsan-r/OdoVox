import { Prisma } from '@odovox/db';
import { AppError } from './errors.js';

/**
 * Patient codes are short, human-readable, unique *within a clinic*: `PT-XXXXXX`.
 * Uniqueness is guaranteed by the @@unique([clinicId, patientCode]) constraint plus a
 * retry-on-violation create (concurrency-safe).
 */

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous 0/O/1/I
const MAX_ATTEMPTS = 20;

export function generatePatientCode(rng: () => number = Math.random): string {
  let body = '';
  for (let i = 0; i < 6; i++) body += ALPHABET[Math.floor(rng() * ALPHABET.length)];
  return `PT-${body}`;
}

function isPatientCodeViolation(err: unknown): boolean {
  if (!(err instanceof Prisma.PrismaClientKnownRequestError) || err.code !== 'P2002') return false;
  const target = err.meta?.target;
  const asString = Array.isArray(target) ? target.join(',') : String(target ?? '');
  return asString.includes('patientCode');
}

/** Create a patient (or anything keyed on patientCode), retrying on a unique collision. */
export async function createWithUniquePatientCode<T>(
  create: (patientCode: string) => Promise<T>,
  preferred?: string,
): Promise<{ result: T; patientCode: string }> {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const patientCode = attempt === 0 && preferred ? preferred.toUpperCase() : generatePatientCode();
    try {
      const result = await create(patientCode);
      return { result, patientCode };
    } catch (err) {
      if (isPatientCodeViolation(err)) continue;
      throw err;
    }
  }
  throw new AppError('Could not generate a unique patient code', 500, 'PATIENT_CODE_EXHAUSTED');
}
