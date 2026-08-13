import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import {
  authHeader,
  buildTestApp,
  createDoctorWithClinic,
  seedConsultation,
  createPatient,
} from "./helpers.js";

/**
 * Frame 32's patient rows carry live state: the avatar ring and the trailing dot say who
 * is in the chair right now and who is waiting on a lab case.
 *
 * The client read that off `Patient.status`, a flat column on the patient row — and
 * NOTHING maintains it. Grep the API: the only writes set it to 'ACTIVE'. Calling a
 * patient into the chair creates an IN_CHAIR *Visit*; it never touches the patient. So
 * `ringFor()` returned 'none' for every row in production, the rings and dots were dead
 * code that had never rendered once, and the "Treating" filter — `where.status = 'IN_CHAIR'`
 * — could never match a single patient.
 *
 * State lives on the visit, so the list derives it from the visit.
 */
let app: FastifyInstance;
beforeAll(async () => {
  app = await buildTestApp();
  await app.ready();
});
afterAll(async () => {
  await app.close();
});

describe("patient list — live state", () => {
  it("reports IN_CHAIR for a patient whose visit is in the chair", async () => {
    const { clinicId, userId, accessToken } = await createDoctorWithClinic(app);
    // seedConsultation leaves the visit IN_CHAIR.
    const { patientId } = await seedConsultation(app, clinicId, userId, {});

    const res = await app.inject({
      method: "GET",
      url: "/patients",
      headers: authHeader(accessToken),
    });
    expect(res.statusCode).toBe(200);

    const row = res
      .json()
      .data.items.find((p: { id: string }) => p.id === patientId);
    expect(row).toBeDefined();
    expect(row.liveState).toBe("IN_CHAIR");

    // The stale column is still 'ACTIVE' — which is exactly why the ring could not use it.
    expect(row.status).not.toBe("IN_CHAIR");
  });

  it("reports null for a patient with no open visit", async () => {
    const { clinicId, userId, accessToken } = await createDoctorWithClinic(app);
    // A patient on the books with nothing open — the ordinary case, and the one that has
    // to stay ringless for a ring to mean anything when it does appear.
    const patientId = await createPatient(app, clinicId, userId);

    const res = await app.inject({
      method: "GET",
      url: "/patients",
      headers: authHeader(accessToken),
    });
    const row = res
      .json()
      .data.items.find((p: { id: string }) => p.id === patientId);
    expect(row.liveState).toBeNull();
  });

  it("the Treating filter actually returns the patient in the chair", async () => {
    const { clinicId, userId, accessToken } = await createDoctorWithClinic(app);
    const { patientId } = await seedConsultation(app, clinicId, userId, {});

    const res = await app.inject({
      method: "GET",
      url: "/patients?filter=in_chair",
      headers: authHeader(accessToken),
    });
    expect(res.statusCode).toBe(200);
    const ids = res.json().data.items.map((p: { id: string }) => p.id);
    // Before the fix this list was always empty, so the filter chip looked broken.
    expect(ids).toContain(patientId);
  });

  it("does not leak another clinic's chair state", async () => {
    const a = await createDoctorWithClinic(app);
    const b = await createDoctorWithClinic(app);
    await seedConsultation(app, a.clinicId, a.userId, {});

    const res = await app.inject({
      method: "GET",
      url: "/patients?filter=in_chair",
      headers: authHeader(b.accessToken),
    });
    expect(res.json().data.items).toEqual([]);
  });
});
