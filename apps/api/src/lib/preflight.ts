import type { FastifyInstance } from 'fastify';
import { decryptField, encryptField } from './encryption.js';

/**
 * Boot-time infrastructure self-check. Fails loud (exit 1) with a clear cause so a future
 * infra mismatch (wrong DB creds, Redis on the wrong port, bad PHI key) dies at boot rather
 * than silently mid-request. Split into a pure `runPreflightChecks` for testability and a
 * `preflight` wrapper that handles logging + exit.
 */

export interface PreflightCheck {
  name: string;
  ok: boolean;
  detail?: string;
}

function message(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export async function runPreflightChecks(app: FastifyInstance): Promise<PreflightCheck[]> {
  const checks: PreflightCheck[] = [];

  try {
    await app.prisma.$queryRaw`SELECT 1`;
    checks.push({ name: 'postgres', ok: true });
  } catch (e) {
    checks.push({ name: 'postgres', ok: false, detail: message(e) });
  }

  try {
    const pong = await app.redis.ping();
    checks.push({
      name: 'redis',
      ok: pong === 'PONG',
      detail: pong === 'PONG' ? undefined : `unexpected ping reply: ${pong}`,
    });
  } catch (e) {
    checks.push({ name: 'redis', ok: false, detail: message(e) });
  }

  try {
    const roundTripped = decryptField(encryptField('preflight'));
    checks.push({
      name: 'phi-key',
      ok: roundTripped === 'preflight',
      detail: roundTripped === 'preflight' ? undefined : 'PHI encrypt/decrypt round-trip mismatch',
    });
  } catch (e) {
    checks.push({ name: 'phi-key', ok: false, detail: message(e) });
  }

  return checks;
}

export async function preflight(app: FastifyInstance): Promise<void> {
  const checks = await runPreflightChecks(app);
  const failed = checks.filter((c) => !c.ok);
  if (failed.length) {
    app.log.fatal({ checks }, 'Preflight checks failed');
    for (const f of failed) {
      console.error(`✗ ${f.name}: ${f.detail}`);
    }
    process.exit(1);
  }
  app.log.info({ checks }, 'Preflight checks passed');
}
