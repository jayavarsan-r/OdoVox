import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { authHeader, buildTestApp, createDoctorWithClinic } from './helpers.js';
import { runWithContext } from '../src/lib/request-context.js';
import { labBucketWhere } from '../src/lib/lab/buckets.js';

/**
 * Frame 56's stat pills, and the property that matters about them: the COUNT on a pill and
 * the LIST it filters to must agree.
 *
 * They can only disagree if the two are defined separately, which is why they are not — both
 * read labBucketWhere(). These tests seed a clinic with one case in each interesting state
 * and assert the pill and its list return the same thing, because a pill that says "1
 * OVERDUE" and opens onto three rows is worse than no pill: it is the app being wrong about
 * the clinic's own work.
 */
let app: FastifyInstance;
beforeAll(async () => {
  app = await buildTestApp();
  await app.ready();
});
afterAll(async () => {
  await app.close();
});

const DAY = 24 * 60 * 60 * 1000;

async function seedCase(
  clinicId: string,
  doctorId: string,
  patientId: string,
  status: string,
  expectedReturnAt: Date | null,
) {
  return runWithContext({ clinicId, userId: doctorId }, async () =>
    app.prisma.labCase.create({
      data: {
        clinicId,
        patientId,
        doctorId,
        createdById: doctorId,
        caseNumber: `LC-${Math.random().toString(36).slice(2, 10).toUpperCase()}`,
        type: 'CROWN',
        teeth: [26],
        status: status as never,
        expectedReturnAt,
      },
    }),
  );
}

async function setup() {
  const doc = await createDoctorWithClinic(app);
  const patient = await runWithContext({ clinicId: doc.clinicId, userId: doc.userId }, async () =>
    app.prisma.patient.create({
      data: {
        clinicId: doc.clinicId,
        patientCode: `PT-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
        name: 'Lab Patient',
        phone: '9800000001',
        age: 40,
        gender: 'FEMALE',
        createdById: doc.userId,
      },
    }),
  );
  return { doc, patientId: patient.id };
}

describe('lab stat buckets', () => {
  it('counts a sent case as active and a draft as nothing', async () => {
    const { doc, patientId } = await setup();
    await seedCase(doc.clinicId, doc.userId, patientId, 'SENT', new Date(Date.now() + 5 * DAY));
    // A jotted-down draft is not work in flight — nobody is waiting on it.
    await seedCase(doc.clinicId, doc.userId, patientId, 'DRAFT', null);

    const res = await app.inject({
      method: 'GET',
      url: '/lab/cases/stats',
      headers: authHeader(doc.accessToken),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data).toEqual({ active: 1, overdue: 0, ready: 0 });
  });

  it('counts a past-due case as BOTH active and overdue', async () => {
    const { doc, patientId } = await setup();
    await seedCase(
      doc.clinicId,
      doc.userId,
      patientId,
      'IN_PROGRESS',
      new Date(Date.now() - 2 * DAY),
    );

    const { active, overdue } = (
      await app.inject({
        method: 'GET',
        url: '/lab/cases/stats',
        headers: authHeader(doc.accessToken),
      })
    ).json().data;
    // Overdue is a subset of active, not a separate stage — it is still in flight.
    expect(active).toBe(1);
    expect(overdue).toBe(1);
  });

  it('never calls a case with no promised date overdue', async () => {
    // expectedReturnAt is computed from the vendor's turnaround; a vendor without one makes
    // no promise. Flagging those would make the red pill permanent background noise.
    const { doc, patientId } = await setup();
    await seedCase(doc.clinicId, doc.userId, patientId, 'IN_PROGRESS', null);

    const { active, overdue } = (
      await app.inject({
        method: 'GET',
        url: '/lab/cases/stats',
        headers: authHeader(doc.accessToken),
      })
    ).json().data;
    expect(active).toBe(1);
    expect(overdue).toBe(0);
  });

  it('a READY case past its date is ready, not overdue — the LAB is not late', async () => {
    const { doc, patientId } = await setup();
    await seedCase(doc.clinicId, doc.userId, patientId, 'READY', new Date(Date.now() - 3 * DAY));

    const { overdue, ready } = (
      await app.inject({
        method: 'GET',
        url: '/lab/cases/stats',
        headers: authHeader(doc.accessToken),
      })
    ).json().data;
    expect(ready).toBe(1);
    expect(overdue).toBe(0);
  });

  it('a finished case counts for nothing', async () => {
    const { doc, patientId } = await setup();
    await seedCase(doc.clinicId, doc.userId, patientId, 'FITTED', new Date(Date.now() - 9 * DAY));

    expect(
      (
        await app.inject({
          method: 'GET',
          url: '/lab/cases/stats',
          headers: authHeader(doc.accessToken),
        })
      ).json().data,
    ).toEqual({ active: 0, overdue: 0, ready: 0 });
  });
});

describe('a pill and the list it opens agree', () => {
  it('every bucket returns exactly as many rows as its count claims', async () => {
    const { doc, patientId } = await setup();
    await seedCase(doc.clinicId, doc.userId, patientId, 'SENT', new Date(Date.now() + 4 * DAY));
    await seedCase(
      doc.clinicId,
      doc.userId,
      patientId,
      'IN_PROGRESS',
      new Date(Date.now() - 1 * DAY),
    );
    await seedCase(doc.clinicId, doc.userId, patientId, 'READY', null);
    await seedCase(doc.clinicId, doc.userId, patientId, 'DRAFT', null);
    await seedCase(doc.clinicId, doc.userId, patientId, 'COMPLETED', null);

    const stats = (
      await app.inject({
        method: 'GET',
        url: '/lab/cases/stats',
        headers: authHeader(doc.accessToken),
      })
    ).json().data;

    for (const bucket of ['active', 'overdue', 'ready'] as const) {
      const list = await app.inject({
        method: 'GET',
        url: `/lab/cases?bucket=${bucket}&limit=100`,
        headers: authHeader(doc.accessToken),
      });
      expect(list.statusCode).toBe(200);
      // The assertion this whole file exists for.
      expect(list.json().data.items).toHaveLength(stats[bucket]);
    }

    expect(stats).toEqual({ active: 3, overdue: 1, ready: 1 });
  });
});

describe('labBucketWhere is the single definition', () => {
  it('overdue is active-minus-READY plus a real past date', () => {
    const now = new Date('2026-09-19T00:00:00Z');
    const w = labBucketWhere('overdue', now) as {
      status: { in: string[] };
      expectedReturnAt: { not: null; lt: Date };
    };
    expect(w.status.in).not.toContain('READY');
    expect(w.status.in).not.toContain('DRAFT');
    expect(w.expectedReturnAt.lt).toBe(now);
    // Null is excluded at the query level, not filtered out afterwards.
    expect(w.expectedReturnAt.not).toBeNull();
  });
});
