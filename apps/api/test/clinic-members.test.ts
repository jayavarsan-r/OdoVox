import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { authHeader, buildTestApp, createDoctorWithClinic, joinReceptionist } from './helpers.js';
import { runWithContext } from '../src/lib/request-context.js';

/**
 * GET /clinics/members — the roster behind frame 70's "2 doctors" and "1 request" chips.
 *
 * Both chips shipped bare because no route could answer them, and putting a number on
 * screen that no query stands behind was rightly refused. This is that query.
 *
 * The split it encodes: colleagues are not confidential — a receptionist books for the
 * doctors by name — but a PENDING request carries a name attached to "wants to join", and
 * acting on that is an admin capability. Everyone gets the count; only admins get the names.
 */
let app: FastifyInstance;
beforeAll(async () => {
  app = await buildTestApp();
  await app.ready();
});
afterAll(async () => {
  await app.close();
});

/** A membership row awaiting approval, as a join request would leave one. */
async function seedPendingMember(clinicId: string, name: string) {
  return runWithContext({ clinicId }, async () => {
    const user = await app.prisma.user.create({
      data: { phone: `9${Math.floor(1e9 + Math.random() * 8e9)}`, name },
    });
    return app.prisma.clinicMember.create({
      data: {
        clinicId,
        userId: user.id,
        role: 'RECEPTIONIST',
        isAdmin: false,
        status: 'PENDING',
      },
    });
  });
}

describe('GET /clinics/members', () => {
  it('counts the active roster by role — the numbers frame 70 puts on its chips', async () => {
    const doc = await createDoctorWithClinic(app);
    await joinReceptionist(app, doc.joinCode);

    const res = await app.inject({
      method: 'GET',
      url: '/clinics/members',
      headers: authHeader(doc.accessToken),
    });
    expect(res.statusCode).toBe(200);

    const { counts, members } = res.json().data;
    expect(counts.doctors).toBe(1);
    expect(counts.receptionists).toBe(1);
    // The clinic's creator is its admin.
    expect(counts.admins).toBe(1);
    expect(counts.pending).toBe(0);
    // Names come through — the roster exists to be read by humans.
    expect(members.map((m: { name: string }) => m.name)).toContain(doc.name ?? members[0].name);
  });

  it('reports a pending request as a COUNT to a non-admin, without the name', async () => {
    const doc = await createDoctorWithClinic(app);
    const recep = await joinReceptionist(app, doc.joinCode);
    await seedPendingMember(doc.clinicId, 'Hopeful Applicant');

    const res = await app.inject({
      method: 'GET',
      url: '/clinics/members',
      headers: authHeader(recep.accessToken),
    });
    expect(res.statusCode).toBe(200);

    const body = res.json().data;
    // The chip can render.
    expect(body.counts.pending).toBe(1);
    // But who it is does not travel. Asserted on the PAYLOAD, not on a rendered view — a
    // name filtered in React has already reached the browser.
    expect(JSON.stringify(body)).not.toContain('Hopeful Applicant');
    expect(body.members.every((m: { status: string }) => m.status === 'ACTIVE')).toBe(true);
  });

  it('does not count a pending member as staff', async () => {
    const doc = await createDoctorWithClinic(app);
    await seedPendingMember(doc.clinicId, 'Not Yet Staff');

    const res = await app.inject({
      method: 'GET',
      url: '/clinics/members',
      headers: authHeader(doc.accessToken),
    });
    const { counts } = res.json().data;
    // "2 doctors" must mean two doctors who actually work here.
    expect(counts.receptionists).toBe(0);
    expect(counts.pending).toBe(1);
  });

  it('is scoped to the caller’s own clinic', async () => {
    const a = await createDoctorWithClinic(app);
    const b = await createDoctorWithClinic(app);
    await joinReceptionist(app, b.joinCode);

    const res = await app.inject({
      method: 'GET',
      url: '/clinics/members',
      headers: authHeader(a.accessToken),
    });
    const { counts } = res.json().data;
    // B's receptionist must not appear in A's roster.
    expect(counts.receptionists).toBe(0);
    expect(counts.doctors).toBe(1);
  });

  it('requires authentication', async () => {
    const res = await app.inject({ method: 'GET', url: '/clinics/members' });
    expect(res.statusCode).toBe(401);
  });
});
