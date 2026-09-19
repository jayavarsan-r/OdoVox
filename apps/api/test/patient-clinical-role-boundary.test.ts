import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import {
  authHeader,
  buildTestApp,
  createDoctorWithClinic,
  joinReceptionist,
  seedConsultation,
} from "./helpers.js";
import { runWithContext } from "../src/lib/request-context.js";
import { isClinicalRole } from "../src/lib/clinical-role.js";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Owner rulings B1 and B4.
 *
 * A receptionist keeps the patient record — they book, bill and phone from it — but the
 * clinical half must not reach their client. The ruling is explicit that this lives at the
 * data boundary, "not by hiding the UI with CSS", so these tests assert on the API
 * RESPONSE. A field filtered in React still travelled: it sits in the network tab, in the
 * query cache, and in whatever component reads the object next.
 */
let app: FastifyInstance;
beforeAll(async () => {
  app = await buildTestApp();
  await app.ready();
});
afterAll(async () => {
  await app.close();
});

/** A patient carrying every kind of clinical detail the record can hold. */
async function seedClinicalPatient(clinicId: string, doctorId: string) {
  const { patientId } = await seedConsultation(app, clinicId, doctorId, {});
  await runWithContext({ clinicId, userId: doctorId }, async () => {
    await app.prisma.patient.update({
      where: { id: patientId },
      data: { medicalFlags: ["PENICILLIN_ALLERGY", "DIABETES"] },
    });
  });
  return patientId;
}

describe("patient detail — clinical fields are role-gated at the API", () => {
  it("DOCTOR receives medical flags", async () => {
    const doc = await createDoctorWithClinic(app);
    const patientId = await seedClinicalPatient(doc.clinicId, doc.userId);

    const res = await app.inject({
      method: "GET",
      url: `/patients/${patientId}`,
      headers: authHeader(doc.accessToken),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.medicalFlags).toEqual([
      "PENICILLIN_ALLERGY",
      "DIABETES",
    ]);
  });

  it("ADMIN is a clinical role, and both routes ask the same predicate", async () => {
    // `req.role` comes from the JWT claim, so promoting a membership row does not change
    // what the request sees — this harness cannot mint an ADMIN token. The boundary is
    // therefore asserted where it is actually decided: isClinicalRole() is the single
    // predicate both routes call, by design, so ADMIN cannot diverge between them.
    expect(isClinicalRole("ADMIN")).toBe(true);
    expect(isClinicalRole("DOCTOR")).toBe(true);
    expect(isClinicalRole("RECEPTIONIST")).toBe(false);
    expect(isClinicalRole(undefined)).toBe(false);

    const patients = readFileSync(
      join(import.meta.dirname, "..", "src", "routes", "patients.ts"),
      "utf8",
    );
    const clinical = readFileSync(
      join(import.meta.dirname, "..", "src", "routes", "clinical.ts"),
      "utf8",
    );
    expect(patients).toMatch(/toPatientResponse\(patient, isClinicalRole\(req\.role\)\)/);
    expect(clinical).toMatch(/isClinicalRole\(req\.role\)/);
    // The serializer must default to withholding, so a new caller that forgets gets the
    // safe answer rather than the leaky one.
    const serialize = readFileSync(
      join(import.meta.dirname, "..", "src", "lib", "serialize.ts"),
      "utf8",
    );
    expect(serialize).toMatch(/clinical = false/);
  });

  it("RECEPTIONIST does not RECEIVE medical flags, allergies or history", async () => {
    const doc = await createDoctorWithClinic(app);
    const recep = await joinReceptionist(app, doc.joinCode);
    const patientId = await seedClinicalPatient(doc.clinicId, doc.userId);

    const res = await app.inject({
      method: "GET",
      url: `/patients/${patientId}`,
      headers: authHeader(recep.accessToken),
    });
    expect(res.statusCode).toBe(200);
    const body = res.json().data;
    expect(body.medicalFlags).toEqual([]);
    expect(body.allergies).toBeNull();
    expect(body.medicalHistory).toBeNull();
    // Not merely absent from a rendered view — absent from the payload entirely.
    expect(JSON.stringify(body)).not.toContain("PENICILLIN");
    expect(JSON.stringify(body)).not.toContain("DIABETES");
  });

  it("RECEPTIONIST can still open the patient record", async () => {
    const doc = await createDoctorWithClinic(app);
    const recep = await joinReceptionist(app, doc.joinCode);
    const patientId = await seedClinicalPatient(doc.clinicId, doc.userId);

    const res = await app.inject({
      method: "GET",
      url: `/patients/${patientId}`,
      headers: authHeader(recep.accessToken),
    });
    expect(res.statusCode).toBe(200);
    const body = res.json().data;
    // Everything reception actually works with survives the gate.
    expect(body.name).toBeTruthy();
    expect(body.phone).toBeTruthy();
    expect(body.patientCode).toBeTruthy();
    expect(body.age).toBeGreaterThan(0);
    expect(body).toHaveProperty("outstandingPaise");
  });

  it("RECEPTIONIST keeps billing and scheduling access for that patient", async () => {
    const doc = await createDoctorWithClinic(app);
    const recep = await joinReceptionist(app, doc.joinCode);
    const patientId = await seedClinicalPatient(doc.clinicId, doc.userId);

    const billing = await app.inject({
      method: "GET",
      url: `/patients/${patientId}/billing`,
      headers: authHeader(recep.accessToken),
    });
    expect(billing.statusCode).toBe(200);

    const appointments = await app.inject({
      method: "GET",
      url: `/patients/${patientId}/appointments`,
      headers: authHeader(recep.accessToken),
    });
    expect(appointments.statusCode).toBe(200);
  });
});
