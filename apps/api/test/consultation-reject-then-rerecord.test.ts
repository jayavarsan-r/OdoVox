import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import {
  authHeader,
  buildTestApp,
  createDoctorWithClinic,
  seedConsultation,
} from "./helpers.js";
import { runWithContext } from "../src/lib/request-context.js";

/**
 * Rejecting a recording must not condemn the visit.
 *
 * The bug (#46): `POST /consultations` returned the existing consultation for a visit
 * whatever its status. So once a doctor tapped Re-record — which posts
 * `/consultations/:id/reject` — and then left the screen, tapping Record for that patient
 * handed back the same REJECTED consultation. The client derives `{kind:'REJECTED'}` and
 * the consult page redirects to the queue: the doctor taps Record, lands back on the
 * queue, and that visit can never be recorded again. Silently, with no error.
 *
 * REJECTED describes a rejected ATTEMPT, not an unusable visit. So restarting reuses the
 * row (visitId is unique, and stays that way) and resets the attempt's own leftovers.
 *
 * The safety half of this is the clearing, not the status. A consultation carries the
 * transcript, the audio key and the extraction of ONE recording. If the row were merely
 * flipped back to PENDING_REVIEW, the next recording would inherit the rejected take's
 * transcript and audio — one patient's dictation surfacing inside another take's review.
 */
let app: FastifyInstance;
beforeAll(async () => {
  app = await buildTestApp();
  await app.ready();
});
afterAll(async () => {
  await app.close();
});

describe("a rejected consultation can be recorded again", () => {
  it("resets the rejected attempt instead of dead-ending the visit", async () => {
    const { clinicId, userId, accessToken } = await createDoctorWithClinic(app);
    const { patientId, visitId, consultationId } = await seedConsultation(
      app,
      clinicId,
      userId,
      {
        procedure: "RCT",
        teeth: [36],
      },
    );

    // The rejected attempt's own leftovers: transcript, audio and extraction results.
    await runWithContext({ clinicId, userId }, () =>
      app.prisma.consultation.update({
        where: { id: consultationId },
        data: {
          rawTranscriptEnc: "ciphertext-of-the-rejected-take",
          audioUrl: "https://example.invalid/rejected.webm",
          audioStorageKey: "clinics/x/rejected.webm",
          audioDurationMs: 42_000,
          languageCode: "hi-IN",
          provider: "sarvam+gemini",
          sttLatencyMs: 900,
          extractionLatencyMs: 1_200,
          safetyWarnings: ["allergy_conflict:Amoxicillin"],
        },
      }),
    );

    // (1) The consultation can be rejected.
    const rejectRes = await app.inject({
      method: "POST",
      url: `/consultations/${consultationId}/reject`,
      headers: authHeader(accessToken),
      payload: { reason: "doctor re-recorded" },
    });
    expect(rejectRes.statusCode).toBe(200);
    expect(rejectRes.json().data.status).toBe("REJECTED");

    // (2) The rejection is durable in the audit log — that is where it belongs, so
    //     clearing the row's rejection fields below loses nothing.
    const audit = await runWithContext({ clinicId, userId }, () =>
      app.prisma.auditLog.findFirst({
        where: { action: "CONSULTATION_REJECTED", entityId: consultationId },
      }),
    );
    expect(audit).not.toBeNull();

    // (3) Starting again for the same visit does NOT hand back a REJECTED consultation.
    const restart = await app.inject({
      method: "POST",
      url: "/consultations",
      headers: authHeader(accessToken),
      payload: { patientId, visitId },
    });
    expect(restart.statusCode).toBe(200);

    // (7) Same row: the unique visitId constraint is intact, no second consultation.
    expect(restart.json().data.consultationId).toBe(consultationId);
    const count = await runWithContext({ clinicId, userId }, () =>
      app.prisma.consultation.count({ where: { visitId } }),
    );
    expect(count).toBe(1);

    const after = await runWithContext({ clinicId, userId }, () =>
      app.prisma.consultation.findUniqueOrThrow({
        where: { id: consultationId },
      }),
    );

    // (4) Reset to the state a fresh recording starts from.
    expect(after.status).toBe("PENDING_REVIEW");
    expect(after.rejectedById).toBeNull();
    expect(after.rejectedReason).toBeNull();

    // (5) Every trace of the rejected take is gone. structuredData and the transcript are
    //     the clinically dangerous two — a stale transcript reaching the next review is
    //     how one recording's findings end up filed under another.
    expect(after.structuredData).toEqual({});
    expect(after.rawTranscriptEnc).toBeNull();
    expect(after.audioUrl).toBeNull();
    expect(after.audioStorageKey).toBeNull();
    expect(after.audioDurationMs).toBeNull();
    expect(after.languageCode).toBeNull();
    expect(after.provider).toBeNull();
    expect(after.sttLatencyMs).toBeNull();
    expect(after.extractionLatencyMs).toBeNull();
    expect(after.safetyWarnings).toEqual([]);

    // (6) The normal lifecycle runs again from here: the client reads a consultation it
    //     derives as IDLE, and can reject it a second time rather than 409-ing.
    const view = await app.inject({
      method: "GET",
      url: `/consultations/${consultationId}`,
      headers: authHeader(accessToken),
    });
    expect(view.statusCode).toBe(200);
    expect(view.json().data.status).toBe("PENDING_REVIEW");

    const secondReject = await app.inject({
      method: "POST",
      url: `/consultations/${consultationId}/reject`,
      headers: authHeader(accessToken),
      payload: { reason: "changed my mind again" },
    });
    expect(secondReject.statusCode).toBe(200);
  });

  it("leaves the patient, the visit and the edit history alone", async () => {
    const { clinicId, userId, accessToken } = await createDoctorWithClinic(app);
    const { patientId, visitId, consultationId } = await seedConsultation(
      app,
      clinicId,
      userId,
      {
        procedure: "Extraction",
      },
    );

    const before = await runWithContext({ clinicId, userId }, async () => ({
      patient: await app.prisma.patient.findUniqueOrThrow({
        where: { id: patientId },
      }),
      visit: await app.prisma.visit.findUniqueOrThrow({
        where: { id: visitId },
      }),
    }));

    // A doctor's edits to the rejected card are audit, not attempt output — they record
    // what a human changed and must survive the reset.
    await runWithContext({ clinicId, userId }, () =>
      app.prisma.consultationEdit.create({
        data: {
          consultationId,
          fieldName: "procedure",
          originalValue: "Extraction",
          editedValue: "RCT",
          editedById: userId,
        },
      }),
    );

    await app.inject({
      method: "POST",
      url: `/consultations/${consultationId}/reject`,
      headers: authHeader(accessToken),
      payload: { reason: "noisy room" },
    });
    await app.inject({
      method: "POST",
      url: "/consultations",
      headers: authHeader(accessToken),
      payload: { patientId, visitId },
    });

    // (8) Nothing unrelated was lost.
    const after = await runWithContext({ clinicId, userId }, async () => ({
      patient: await app.prisma.patient.findUniqueOrThrow({
        where: { id: patientId },
      }),
      visit: await app.prisma.visit.findUniqueOrThrow({
        where: { id: visitId },
      }),
      edits: await app.prisma.consultationEdit.count({
        where: { consultationId },
      }),
    }));
    expect(after.patient).toEqual(before.patient);
    expect(after.visit.patientId).toBe(before.visit.patientId);
    expect(after.visit.tokenNumber).toBe(before.visit.tokenNumber);
    expect(after.edits).toBe(1);
  });

  it("does not disturb a consultation that was never rejected", async () => {
    const { clinicId, userId, accessToken } = await createDoctorWithClinic(app);
    const { patientId, visitId, consultationId } = await seedConsultation(
      app,
      clinicId,
      userId,
      {
        procedure: "Scaling",
      },
    );

    const restart = await app.inject({
      method: "POST",
      url: "/consultations",
      headers: authHeader(accessToken),
      payload: { patientId, visitId },
    });
    expect(restart.json().data.consultationId).toBe(consultationId);

    // A doctor stepping back into a consultation mid-review must find it exactly as they
    // left it. Only a REJECTED attempt is spent.
    const after = await runWithContext({ clinicId, userId }, () =>
      app.prisma.consultation.findUniqueOrThrow({
        where: { id: consultationId },
      }),
    );
    expect(after.structuredData).toEqual({ procedure: "Scaling" });
    expect(after.status).toBe("PENDING_REVIEW");
  });
});
