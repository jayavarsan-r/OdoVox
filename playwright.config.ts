import { defineConfig, devices } from '@playwright/test';

/**
 * Phase 1 e2e config. The smoke test only runs when E2E=1 (it needs the dev stack up:
 * `OTP_PROVIDER=mock pnpm dev`, Postgres + Redis via docker compose). Install once with:
 *   pnpm add -D -w @playwright/test && npx playwright install chromium
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  retries: 0,
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
    ...devices['iPhone 13'],
  },
  reporter: 'list',
});
