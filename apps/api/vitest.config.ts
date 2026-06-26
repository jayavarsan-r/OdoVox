import { defineConfig } from 'vitest/config';

/**
 * API tests run against real Postgres/Redis and, for the realtime suite, real Socket.IO servers on
 * ephemeral ports. Under `pnpm verify` (turbo runs api + web + types test suites concurrently) the
 * machine is heavily loaded, so a valid socket handshake/event can take a few seconds. We raise the
 * per-test ceiling well above the default 5s so load-induced timing never fails an otherwise-correct
 * test, while keeping file parallelism for speed.
 */
export default defineConfig({
  test: {
    // Force mock providers (sarvam/gemini/msg91) before any module loads — the suite stays hermetic
    // even when the developer's .env points at real providers for manual testing.
    setupFiles: ['./test/setup.ts'],
    testTimeout: 20_000,
    hookTimeout: 30_000,
    // Several suites spin up real Socket.IO servers (ephemeral ports), BullMQ/Redis connections and
    // Postgres pools. Run test files sequentially in a single fork so they never contend under the
    // full `pnpm verify` fan-out (api + web + types suites concurrently). `isolate` stays on, so each
    // file still gets a fresh module registry (the broadcast emitter singleton is per-file).
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
  },
});
