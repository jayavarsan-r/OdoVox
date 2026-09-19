/**
 * Root Prettier config.
 *
 * `packages/config/prettier.config.cjs` has held this repo's real style since the
 * beginning — singleQuote, printWidth 100 — but NOTHING pointed Prettier at it. There was
 * no root config and no `prettier` key in package.json, so every bare `prettier --write`
 * (the format script, lint-staged, and editor/agent format-on-save hooks) silently fell
 * back to Prettier's defaults: double quotes and printWidth 80.
 *
 * The effect was invisible until something ran it. Editing two lines of a file rewrote the
 * whole file — one 20-line change to `packages/db/prisma/seed.ts` came out as an 858-line
 * diff — which buries the real change in review, and broke four regression tests that
 * assert on source text containing single quotes.
 *
 * Re-exporting the shared config here makes the formatter agree with the code that is
 * already committed.
 *
 * @type {import('prettier').Config}
 */
module.exports = require('./packages/config/prettier.config.cjs');
