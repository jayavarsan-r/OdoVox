import { describe, expect, it } from 'vitest';
import { Prisma } from '@odovox/db';
import {
  createWithUniqueJoinCode,
  generateJoinCodeCandidate,
  generateUniqueJoinCode,
  joinCodePrefix,
} from '../src/lib/join-code.js';

describe('joinCodePrefix', () => {
  it('uppercases and takes the first five letters', () => {
    expect(joinCodePrefix('Smile Dental Care')).toBe('SMILE');
  });

  it('pads short names with random letters to five chars', () => {
    const prefix = joinCodePrefix('Hi', () => 0); // rng → always "A"
    expect(prefix).toBe('HIAAA');
  });

  it('handles names with no letters at all', () => {
    const prefix = joinCodePrefix('123 !!!', () => 0);
    expect(prefix).toBe('AAAAA');
  });
});

describe('generateJoinCodeCandidate', () => {
  it('produces a 5-letter + 1-digit code', () => {
    expect(generateJoinCodeCandidate('Smile')).toMatch(/^[A-Z]{5}\d$/);
  });

  it('falls back to a fully random prefix after the retry threshold', () => {
    const code = generateJoinCodeCandidate('Smile', 12, () => 0);
    expect(code).toBe('AAAAA0'); // random prefix path, rng → "A" and digit 0
  });
});

describe('generateUniqueJoinCode', () => {
  it('returns a free code', async () => {
    const fakePrisma = { clinic: { findUnique: async () => null } };
    const code = await generateUniqueJoinCode('Smile Dental', fakePrisma as never);
    expect(code).toMatch(/^[A-Z]{5}\d$/);
  });

  it('retries past taken codes', async () => {
    const taken = new Set(Array.from({ length: 10 }, (_, i) => `SMILE${i}`));
    const fakePrisma = {
      clinic: {
        findUnique: async ({ where }: { where: { joinCode: string } }) =>
          taken.has(where.joinCode) ? { id: 'x' } : null,
      },
    };
    const code = await generateUniqueJoinCode('Smile', fakePrisma as never);
    expect(taken.has(code)).toBe(false);
  });
});

describe('createWithUniqueJoinCode (concurrency)', () => {
  it('never produces duplicate codes under 50 concurrent creators', async () => {
    const used = new Set<string>();
    const create = async (joinCode: string): Promise<string> => {
      if (used.has(joinCode)) {
        throw new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
          code: 'P2002',
          clientVersion: 'test',
          meta: { target: ['joinCode'] },
        });
      }
      used.add(joinCode);
      return joinCode;
    };

    const results = await Promise.all(
      Array.from({ length: 50 }, () => createWithUniqueJoinCode('Smile Dental', create)),
    );
    const codes = results.map((r) => r.joinCode);
    expect(new Set(codes).size).toBe(50);
  });

  it('rethrows non-unique errors immediately', async () => {
    await expect(
      createWithUniqueJoinCode('Smile', async () => {
        throw new Error('db down');
      }),
    ).rejects.toThrow('db down');
  });
});
