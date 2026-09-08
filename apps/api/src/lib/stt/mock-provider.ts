import { createHash } from "node:crypto";
import type {
  ISttProvider,
  SttResult,
  SttTranscribeOptions,
} from "./sender.js";

/**
 * If the "audio" buffer decodes to UTF-8 text starting with this prefix, the mock returns the
 * remainder verbatim as the transcript. This gives tests + the demo full deterministic control
 * over what the pipeline "hears" (e.g. inject the exact RCT note), while genuinely-random audio
 * still falls back to a hash-selected canned transcript — so the mock varies by input (not a lie).
 */
export const MOCK_TRANSCRIPT_PREFIX = "MOCK_TRANSCRIPT:";

/** Realistic Indian-dental voice notes so the mock extractor downstream has keywords to match. */
const CANNED_TRANSCRIPTS = [
  "RCT on 26 completed, third sitting. Amoxicillin 500mg TID for 5 days. Review next week.",
  "Scaling and polishing done for the whole mouth. Advised warm saline rinse twice daily.",
  "Extraction of 38, healing well. Paracetamol 500mg SOS for pain. Review after 3 days.",
  "Composite filling on 16, caries removed. No medication needed. Recall after 6 months.",
];

/**
 * DEMO FIXTURES — the recordings the seeded demo patients "made".
 *
 * Chromium's fake capture device produces audio that parses into nothing, so several real
 * states of this application had no honest route to them: a prescription that conflicts with a
 * recorded allergy, a prescription long enough to test the list, and an intake form filled by
 * voice. They were built and then could not be reached, reviewed or screenshotted.
 *
 * Each key names a seeded demo patient (by patientCode) or a dictation surface. The transcript
 * is what that demo recording says. Nothing here sets an outcome: the transcript goes through
 * the same extractor, the same safety check and the same confirm step as any other. The
 * allergy conflict on PT-0004 is a REAL conflict, computed by the real code, because PT-0004
 * really does carry a penicillin allergy in the seed.
 *
 * This is mock-only. `SarvamSttProvider` never reads it.
 */
const DEMO_FIXTURES: Record<string, string> = {
  // PT-0004 is seeded with medicalFlags PENICILLIN_ALLERGY and allergiesEnc 'Penicillin'.
  // Amoxicillin is a penicillin. The conflict the doctor is warned about is genuine.
  "PT-0004":
    "RCT on 36 completed, second sitting. Amoxicillin 500mg TID for 5 days and " +
    "Ibuprofen 400mg BD after food for 3 days. Review next week.",

  // A prescription long enough to exercise the list, not a clinically model one — its point is
  // seven rows, and the doctor still confirms every one of them.
  "PT-0005":
    "Extraction of 38 completed. Amoxicillin 500mg TID for 5 days, Metronidazole 400mg TID " +
    "for 5 days, Paracetamol 650mg QID for 3 days, Ibuprofen 400mg BD after food for 3 days, " +
    "Pantoprazole 40mg OD before food for 5 days, Chlorhexidine mouthwash BD for 7 days, " +
    "Ketorolac 10mg SOS for pain. Review after 3 days.",

  // Patient intake dictated at the front desk. Extraction fills the form; the receptionist
  // still checks every field before it saves.
  intake:
    "New patient Meera Raghavan, 34 years old female, phone 9876543210. " +
    "Complains of pain in the lower right back tooth since three days. " +
    "Allergic to penicillin. She is diabetic.",
};

function hashIndex(audio: Buffer, modulo: number): number {
  const digest = createHash("sha256").update(audio).digest();
  return digest.readUInt32BE(0) % modulo;
}

/** ~400ms per spoken word, clamped to a sane 5s–120s range — a plausible simulated clip length. */
function estimateDurationMs(transcript: string): number {
  const words = transcript.trim().split(/\s+/).length;
  return Math.min(120_000, Math.max(5_000, words * 400));
}

const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Deterministic, free, offline STT for tests + UI iteration. Latency defaults to 0 (fast tests);
 * the factory injects ~800ms in dev so the progress UI feels real (see docs/voice-pipeline.md).
 */
export class MockSttProvider implements ISttProvider {
  constructor(private readonly opts: { latencyMs?: number } = {}) {}

  async transcribe(
    audio: Buffer,
    opts: SttTranscribeOptions,
  ): Promise<SttResult> {
    const latencyMs = this.opts.latencyMs ?? 0;
    if (latencyMs > 0) await delay(latencyMs);

    const text = audio.toString("utf8");
    // Precedence, and the order matters:
    //   1. an explicit MOCK_TRANSCRIPT: buffer — tests inject exact text and must always win;
    //   2. a demo fixture for this patient or dictation surface;
    //   3. the hash fallback, so genuinely-random audio still varies by input.
    const fixture = opts.fixture ? DEMO_FIXTURES[opts.fixture] : undefined;
    const transcript = text.startsWith(MOCK_TRANSCRIPT_PREFIX)
      ? text.slice(MOCK_TRANSCRIPT_PREFIX.length)
      : (fixture ??
        CANNED_TRANSCRIPTS[hashIndex(audio, CANNED_TRANSCRIPTS.length)]!);

    const languageCode =
      !opts.language || opts.language === "auto" ? "en-IN" : opts.language;

    return {
      providerId: "mock",
      transcript,
      languageCode,
      durationMs: estimateDurationMs(transcript),
    };
  }
}
