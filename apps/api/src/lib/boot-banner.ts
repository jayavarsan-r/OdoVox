import type { Env } from './env.js';

/**
 * Boot banner — prints the active providers in a box so you never have to wonder which
 * STT / AI / OTP backends a running API is wired to (see docs/voice-pipeline.md "Boot-time
 * visibility"). `formatBootBanner` is pure (tested); `printBootBanner` writes it to stdout
 * via console.log — deliberately bypassing the JSON logger so it's human-readable at boot.
 */
/** Mask a key as first6••••last4 so the banner confirms a REAL key loaded (not an empty default). */
function maskKey(key: string | undefined): string {
  if (!key) return 'MISSING';
  return key.length <= 12 ? '••••' : `${key.slice(0, 6)}••••${key.slice(-4)}`;
}

export function formatBootBanner(env: Env): string {
  const stt =
    env.STT_PROVIDER === 'sarvam'
      ? `sarvam · ${env.SARVAM_MODEL} · key=${maskKey(env.SARVAM_API_KEY)}`
      : 'mock';
  const ai =
    env.AI_PROVIDER === 'gemini'
      ? `gemini · ${env.GEMINI_MODEL} · key=${maskKey(env.GEMINI_API_KEY)}`
      : 'mock';
  const payments =
    env.PAYMENT_PROVIDER === 'razorpay'
      ? `razorpay · ${env.RAZORPAY_MODE} · key=${maskKey(env.RAZORPAY_KEY_ID)}`
      : 'mock';
  const whatsapp =
    env.WHATSAPP_PROVIDER === 'aisensy'
      ? `aisensy · key=${maskKey(env.AISENSY_API_KEY)}`
      : 'mock';

  const lines = [
    `Odovox API · listening on :${env.PORT}`,
    '',
    `  STT:      ${stt}`,
    `  AI:       ${ai}`,
    `  PAYMENTS: ${payments}`,
    `  WHATSAPP: ${whatsapp}`,
    `  OTP:      ${env.OTP_PROVIDER}`,
    `  ENV:      ${env.NODE_ENV}`,
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
