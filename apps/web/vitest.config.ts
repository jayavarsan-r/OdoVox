import { defineConfig } from 'vitest/config';

/**
 * Web unit tests cover pure logic only (error mapping, RBAC, patient-code, etc.) in a node
 * environment — no DOM. Component/E2E coverage lives in Playwright. We scope `include` so we
 * never accidentally try to render a `'use client'` component under vitest.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['lib/**/*.test.ts', 'test/**/*.test.ts'],
  },
});
