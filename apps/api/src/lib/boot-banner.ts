import type { Env } from './env.js';

/**
 * Boot banner — prints the active providers in a box so you never have to wonder which
 * STT / AI / OTP backends a running API is wired to (see docs/voice-pipeline.md "Boot-time
 * visibility"). `formatBootBanner` is pure (tested); `printBootBanner` writes it to stdout
 * via console.log — deliberately bypassing the JSON logger so it's human-readable at boot.
 */
export function formatBootBanner(env: Env): string {
  const stt = env.STT_PROVIDER === 'sarvam' ? `sarvam · ${env.SARVAM_MODEL}` : 'mock';
  const ai = env.AI_PROVIDER === 'gemini' ? `gemini · ${env.GEMINI_MODEL}` : 'mock';

  const lines = [
    `Odovox API · listening on :${env.PORT}`,
    '',
    `  STT:    ${stt}`,
    `  AI:     ${ai}`,
    `  OTP:    ${env.OTP_PROVIDER}`,
    `  ENV:    ${env.NODE_ENV}`,
  ];

  const width = Math.max(...lines.map((l) => l.length));
  const top = `┌─${'─'.repeat(width)}─┐`;
  const bottom = `└─${'─'.repeat(width)}─┘`;
  const body = lines.map((l) => `│ ${l.padEnd(width)} │`);
  return [top, ...body, bottom].join('\n');
}

export function printBootBanner(env: Env): void {
  console.log(`\n${formatBootBanner(env)}\n`);
}
