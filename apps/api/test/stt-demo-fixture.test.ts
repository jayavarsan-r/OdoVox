import { describe, expect, it } from "vitest";
import {
  MockSttProvider,
  MOCK_TRANSCRIPT_PREFIX,
} from "../src/lib/stt/mock-provider.js";
import { MockExtractor } from "../src/lib/ai/mock-extractor.js";
import { runSafetyChecks } from "../src/lib/ai/safety.js";

/**
 * The demo fixtures (deviations #55, #58).
 *
 * Several real states of this app were unreachable: the capture harness records through
 * Chromium's fake microphone, which produces audio the extractor parses into nothing. So a
 * prescription that conflicts with a recorded allergy, a prescription long enough to test the
 * list, and a voice-filled intake were all built and then could not be reached, reviewed or
 * screenshotted.
 *
 * A fixture selects WHAT THE RECORDING SAID. It must never select an outcome — the transcript
 * goes through the same extractor, the same safety check and the same confirm step as any
 * other. These tests hold that line, because a fixture that shortcut the pipeline would make
 * every screenshot taken through it a lie.
 */

const stt = new MockSttProvider();
const extractor = new MockExtractor();
const audio = Buffer.from("not-real-audio-just-bytes");
const opts = { language: "auto", mimeType: "audio/webm" } as const;

describe("demo fixtures select a transcript, not an outcome", () => {
  it("PT-0004's recording prescribes a penicillin — the conflict is then REAL", async () => {
    const { transcript } = await stt.transcribe(audio, {
      ...opts,
      fixture: "PT-0004",
    });
    // The seed gives PT-0004 medicalFlags PENICILLIN_ALLERGY and allergiesEnc 'Penicillin'.
    // The fixture's only job is to make the doctor say a penicillin out loud.
    expect(transcript).toMatch(/amoxicillin/i);

    const extraction = await extractor.extractClinical(transcript, {
      activePlans: [],
    });
    expect(extraction.prescriptions.map((p) => p.name)).toContain(
      "Amoxicillin",
    );
    // Nothing about the conflict is baked in: the extraction carries no safety warning of its
    // own. The real allergy check runs over this, against the real patient record.
    expect(extraction.safetyWarnings).toEqual([]);
  });

  it("PT-0005's recording dictates seven medicines, and the extractor finds seven", async () => {
    const { transcript } = await stt.transcribe(audio, {
      ...opts,
      fixture: "PT-0005",
    });
    const extraction = await extractor.extractClinical(transcript, {
      activePlans: [],
    });
    expect(extraction.prescriptions).toHaveLength(7);
    // Parsed, not asserted: every row carries what the doctor actually said about it.
    expect(extraction.prescriptions[0]).toMatchObject({
      name: "Amoxicillin",
      dosage: "500mg",
      frequency: "TID",
      durationDays: 5,
    });
  });

  it("the intake recording fills the form the extractor would fill from real speech", async () => {
    const { transcript } = await stt.transcribe(audio, {
      ...opts,
      fixture: "intake",
    });
    const intake = await extractor.extractPatientIntake(transcript);
    expect(intake.name).toBe("Meera Raghavan");
    expect(intake.age).toBe(34);
    expect(intake.gender).toBe("FEMALE");
    expect(intake.phone).toBe("9876543210");
    expect(intake.chiefComplaint).toBeTruthy();
    expect(intake.allergies).toContain("Penicillin");
  });
});

describe("fixtures never take precedence over real input", () => {
  it("an explicit MOCK_TRANSCRIPT buffer still wins — tests must stay in control", async () => {
    const injected = Buffer.from(
      `${MOCK_TRANSCRIPT_PREFIX}Scaling done on 21.`,
    );
    const { transcript } = await stt.transcribe(injected, {
      ...opts,
      fixture: "PT-0004",
    });
    expect(transcript).toBe("Scaling done on 21.");
    expect(transcript).not.toMatch(/amoxicillin/i);
  });

  it("an unknown fixture key falls through to the hash fallback, never to empty", async () => {
    const { transcript } = await stt.transcribe(audio, {
      ...opts,
      fixture: "PT-9999",
    });
    expect(transcript.length).toBeGreaterThan(0);
    const { transcript: none } = await stt.transcribe(audio, opts);
    // A patient with no fixture is transcribed exactly as before this change.
    expect(transcript).toBe(none);
  });

  it("is deterministic — the same demo patient says the same thing every run", async () => {
    const a = await stt.transcribe(audio, { ...opts, fixture: "PT-0004" });
    const b = await stt.transcribe(Buffer.from("different-bytes"), {
      ...opts,
      fixture: "PT-0004",
    });
    expect(a.transcript).toBe(b.transcript);
  });

  it("leaves every other patient on the varying hash fallback", async () => {
    // The fixtures are three seeded demos, not a global override — an ordinary patient's
    // recording must still vary by input, or the mock starts lying about everything.
    const one = await stt.transcribe(Buffer.from("audio-one"), opts);
    const two = await stt.transcribe(Buffer.from("audio-two"), opts);
    const three = await stt.transcribe(Buffer.from("audio-three"), opts);
    expect(
      new Set([one, two, three].map((r) => r.transcript)).size,
    ).toBeGreaterThan(1);
  });
});

/**
 * The end-to-end point of the PT-0004 fixture (deviation #55).
 *
 * Frames 27 and 28 show a prescription that conflicts with a recorded allergy. They were
 * built and then unreachable: no seeded recording ever prescribed something the patient was
 * allergic to, so the conflict rail could not be seen, reviewed or screenshotted.
 *
 * This walks the real path — fixture transcript → real extractor → real safety layer, against
 * the allergy the seed really stores on PT-0004 — and asserts a genuine warning comes out. If
 * the fixture ever stopped naming a penicillin, or the allergy class table changed, this fails
 * rather than letting the frames go back to being unreachable in silence.
 */
describe("PT-0004 produces a REAL allergy conflict end to end", () => {
  it("runs the actual safety layer against the seeded allergy", async () => {
    const { transcript } = await stt.transcribe(audio, {
      ...opts,
      fixture: "PT-0004",
    });
    const extraction = await extractor.extractClinical(transcript, {
      activePlans: [],
    });

    // Exactly what packages/db/prisma/seed.ts stores for PT-0004.
    const safety = runSafetyChecks(
      extraction,
      { age: 41, medicalFlags: ["PENICILLIN_ALLERGY"] },
      ["Penicillin"],
    );

    const conflict = safety.warnings.find((w) => w.code === "allergy_conflict");
    expect(conflict).toBeDefined();
    expect(conflict!.detail).toBe("Amoxicillin");
    expect(conflict!.message).toMatch(/penicillin/i);

    // Product rules 3 and 4: the warning FLAGS, it never blocks. The dentist decides.
    expect(safety.blockingErrors).toEqual([]);
  });

  it("the same recording for a patient with no allergy raises nothing", async () => {
    // Proves the warning comes from the patient record, not from the fixture being "the
    // conflict one" — the transcript is identical and the outcome differs.
    const { transcript } = await stt.transcribe(audio, {
      ...opts,
      fixture: "PT-0004",
    });
    const extraction = await extractor.extractClinical(transcript, {
      activePlans: [],
    });
    const safety = runSafetyChecks(extraction, { age: 41, medicalFlags: [] }, []);
    expect(safety.warnings.filter((w) => w.code === "allergy_conflict")).toEqual([]);
  });
});
