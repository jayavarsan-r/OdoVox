import { afterEach, describe, expect, it, vi } from 'vitest';
import crypto from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { preflight, runPreflightChecks } from '../src/lib/preflight.js';

process.env.PHI_ENCRYPTION_KEY ??= crypto.randomBytes(32).toString('base64');
process.env.PHI_KEY_VERSION ??= '1';

function fakeApp(over: Partial<{ dbOk: boolean; redisPong: string }> = {}): FastifyInstance {
  const { dbOk = true, redisPong = 'PONG' } = over;
  return {
    prisma: {
      $queryRaw: dbOk ? async () => [{ 1: 1 }] : async () => Promise.reject(new Error('db down')),
    },
    redis: { ping: async () => redisPong },
    log: { info: vi.fn(), fatal: vi.fn() },
  } as unknown as FastifyInstance;
}

afterEach(() => vi.restoreAllMocks());

describe('runPreflightChecks', () => {
  it('passes all three checks when infra is healthy', async () => {
    const checks = await runPreflightChecks(fakeApp());
    expect(checks).toEqual([
      { name: 'postgres', ok: true },
      { name: 'redis', ok: true, detail: undefined },
      { name: 'phi-key', ok: true, detail: undefined },
    ]);
  });

  it('flags postgres when the query throws', async () => {
    const checks = await runPreflightChecks(fakeApp({ dbOk: false }));
    expect(checks.find((c) => c.name === 'postgres')?.ok).toBe(false);
  });

  it('flags redis when ping is not PONG', async () => {
    const checks = await runPreflightChecks(fakeApp({ redisPong: 'NOPE' }));
    expect(checks.find((c) => c.name === 'redis')?.ok).toBe(false);
  });
});

describe('preflight', () => {
  it('exits the process with code 1 when a check fails', async () => {
    const exit = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await preflight(fakeApp({ dbOk: false }));
    expect(exit).toHaveBeenCalledWith(1);
  });

  it('does not exit when all checks pass', async () => {
    const exit = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    await preflight(fakeApp());
    expect(exit).not.toHaveBeenCalled();
  });
});
