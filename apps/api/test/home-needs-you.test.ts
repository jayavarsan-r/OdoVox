import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { runAsSystem } from '../src/lib/request-context.js';
import {
  authHeader,
  buildTestApp,
  cleanup,
  createDoctorWithClinic,
  joinReceptionist,
  type ClinicSetup,
} from './helpers.js';

let app: FastifyInstance;
let doc: ClinicSetup;
let receptionToken: string;
const phones: string[] = [];
const clinicIds: string[] = [];

beforeAll(async () => {
  app = await buildTestApp();
  await app.ready();
  doc = await createDoctorWithClinic(app);
  phones.push(doc.phone);
  clinicIds.push(doc.clinicId);
  const recept = await joinReceptionist(app, doc.joinCode);
  receptionToken = recept.accessToken;
  phones.push(recept.phone);
});
afterAll(async () => {
  await cleanup(app, { phones, clinicIds });
  await app.close();
});

describe('Doctor home', () => {
  it('PAYMENT_OVERDUE rule fires for an overdue patient', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/patients',
      headers: authHeader(doc.accessToken),
      payload: { name: 'Overdue Olu', phone: '9876500011', age: 60, gender: 'MALE' },
    });
    const id = created.json().data.id;
    await runAsSystem(async () => {
      return await app.prisma.patient.update({
        where: { id },
        data: { outstandingPaise: 350000, lastVisitAt: new Date(Date.now() - 20 * 864e5) },
      });
    });

    const res = await app.inject({ method: 'GET', url: '/home/needs-you', headers: authHeader(doc.accessToken) });
    expect(res.statusCode).toBe(200);
    const items = res.json().data.items as { kind: string; patientId: string }[];
    expect(items.some((i) => i.kind === 'PAYMENT_OVERDUE' && i.patientId === id)).toBe(true);
  });

  it('needs-you is doctor-only (receptionist → 403)', async () => {
    const res = await app.inject({ method: 'GET', url: '/home/needs-you', headers: authHeader(receptionToken) });
    expect(res.statusCode).toBe(403);
  });

  it('recent returns an array of visits', async () => {
    const res = await app.inject({ method: 'GET', url: '/home/recent', headers: authHeader(doc.accessToken) });
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.json().data.items)).toBe(true);
  });

  it("today's appointments is an (empty in Phase 2) array", async () => {
    const res = await app.inject({ method: 'GET', url: '/home/today', headers: authHeader(doc.accessToken) });
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.json().data.items)).toBe(true);
  });

  it('receptionist today/stats returns counts', async () => {
    const res = await app.inject({ method: 'GET', url: '/today/stats', headers: authHeader(receptionToken) });
    expect(res.statusCode).toBe(200);
    const d = res.json().data;
    expect(d).toHaveProperty('appointmentsToday');
    expect(d).toHaveProperty('inChair');
  });
});
