import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import {
  authHeader,
  buildTestApp,
  createDoctorWithClinic,
  futureWeekdayISO,
  seedDoctorAvailability,
  type ClinicSetup,
} from './helpers.js';
import { runWithContext } from '../src/lib/request-context.js';
import { storage } from '../src/lib/storage.js';
import { MOCK_TRANSCRIPT_PREFIX } from '../src/lib/stt/mock-provider.js';

let app: FastifyInstance;
beforeAll(async () => {
  app = await buildTestApp();
});
afterAll(async () => {
  await app.close();
});

async function putAudio(clinicId: string, transcript: string): Promise<string> {
  const key = `clinics/${clinicId}/dictation/${Date.now()}-${Math.random().toString(36).slice(2)}.webm`;
  await storage.putObject(key, Buffer.from(`${MOCK_TRANSCRIPT_PREFIX}${transcript}`), 'audio/webm');
  return key;
}

async function namedPatient(clinicId: string, userId: string, name: string): Promise<string> {
  return runWithContext({ clinicId, userId }, async () => {
    const p = await app.prisma.patient.create({
      data: {
        clinicId,
        patientCode: `PT-A${Math.floor(Math.random() * 1e9)}`,
        name,
        phone: `98${Math.floor(Math.random() * 1e8).toString().padStart(8, '0')}`,
        age: 30,
        gender: 'MALE',
        status: 'ACTIVE',
        createdById: userId,
      },
    });
    return p.id;
  });
}

const dictate = (s: ClinicSetup, payload: Record<string, unknown>) =>
  app.inject({ method: 'POST', url: '/appointments/dictate', headers: authHeader(s.accessToken), payload });

/** A spoken phrase chrono resolves deterministically: "on July 16 2026 at 10 am" style. */
function spokenDate(daysAhead = 14, time = '10 am'): string {
  const iso = futureWeekdayISO(daysAhead); // yyyy-mm-dd
  const [y, m, d] = iso.split('-').map(Number);
  const month = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][m! - 1];
  return `on ${month} ${d} ${y} at ${time}`;
}

describe('POST /appointments/dictate (Phase 9.7 W1.2.5)', () => {
  it('extracts a single booking: patient + doctor + chrono-parsed datetime + duration', async () => {
    const s = await createDoctorWithClinic(app);
    await seedDoctorAvailability(app, s.clinicId, s.userId);
    const patientId = await namedPatient(s.clinicId, s.userId, 'Ramesh Kumar');

    const key = await putAudio(s.clinicId, `Book cleaning for Ramesh with Dr Asha ${spokenDate()} for 45 minutes`);
    const res = await dictate(s, { storageKey: key });

    expect(res.statusCode).toBe(200);
    const data = res.json().data;
    expect(data.extraction.procedureHint).toBe('cleaning');
    expect(data.extraction.isRecurring).toBe(false);
    expect(data.durationMinutes).toBe(45);
    expect(data.suggestedDateTime).toBeTruthy();
    // 10am IST on the spoken date = 04:30 UTC.
    expect(new Date(data.suggestedDateTime).toISOString()).toContain('T04:30:00');
    expect(data.dateHasTime).toBe(true);
    expect(data.patientMatches[0]).toMatchObject({ id: patientId, name: 'Ramesh Kumar' });
    expect(data.doctorMatches[0]).toMatchObject({ id: s.userId });
    expect(data.conflicts).toEqual([]); // availability seeded → clean slot
  });

  it('extracts a recurring series (every week for 6 weeks)', async () => {
    const s = await createDoctorWithClinic(app);
    const key = await putAudio(s.clinicId, `Book scaling for Ramesh with Dr Asha ${spokenDate(14, '9 am')} every week for 6 weeks`);
    const res = await dictate(s, { storageKey: key });

    const { extraction } = res.json().data;
    expect(extraction.isRecurring).toBe(true);
    expect(extraction.recurringInterval).toBe('WEEKLY');
    expect(extraction.recurringCount).toBe(6);
  });

  it('runs Phase 6 conflict detection immediately (double-booking surfaces on the card)', async () => {
    const s = await createDoctorWithClinic(app);
    await seedDoctorAvailability(app, s.clinicId, s.userId);
    const patientId = await namedPatient(s.clinicId, s.userId, 'Lakshmi Devi');

    // Occupy the slot first via the normal booking endpoint.
    const iso = futureWeekdayISO(14);
    const startsAt = new Date(`${iso}T04:30:00.000Z`); // 10:00 IST
    const booked = await app.inject({
      method: 'POST',
      url: '/appointments',
      headers: authHeader(s.accessToken),
      payload: { patientId, doctorId: s.userId, startsAt: startsAt.toISOString(), durationMinutes: 30 },
    });
    expect(booked.statusCode).toBe(201);

    // Dictate the same slot — text mode (home hero hand-off path), no audio needed.
    const res = await dictate(s, { text: `book checkup for Lakshmi with Dr Asha ${spokenDate(14, '10 am')}` });
    expect(res.statusCode).toBe(200);
    const data = res.json().data;
    expect(data.conflicts).not.toBeNull();
    expect(data.conflicts.map((c: { code: string }) => c.code)).toContain('DOCTOR_DOUBLE_BOOKED');
  });
});
