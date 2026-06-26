/**
 * Test hermeticity. The suite must NEVER hit (or pay for) real Sarvam/Gemini/MSG91, regardless of
 * the developer's `.env` — which may be set to real `sarvam`/`gemini` for manual testing. We force
 * the mock providers here, BEFORE any test imports `server.ts` (whose `dotenv` call uses the default
 * `override: false`, so these process.env values win over `.env`).
 */
process.env.STT_PROVIDER = 'mock';
process.env.AI_PROVIDER = 'mock';
process.env.OTP_PROVIDER = 'mock';
