import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { Socket } from 'socket.io-client';
import { authHeader, buildTestApp, createDoctorWithClinic, joinReceptionist, seedConsultation } from './helpers.js';
import { collect, connectClient, listenApp } from './socket-helpers.js';
import { getRecordingVisitIds } from '../src/lib/realtime/recording.js';

let app: FastifyInstance;
let url: string;
const clients: Socket[] = [];

beforeAll(async () => {
  app = await buildTestApp();
  url = await listenApp(app);
});
afterAll(async () => {
  for (const c of clients) c.close();
  await app.close();
});

const FINAL = {
  procedure: 'RCT',
  teeth: [26],
  sittingCurrent: 3,
  sittingTotal: 4,
  status: 'COMPLETED' as const,
  prescriptions: [{ name: 'Amoxicillin', dosage: '500mg', frequency: 'TID' as const, durationDays: 5, instructions: null }],
  followUp: { afterDays: 7, procedureHint: 'Crown' },
  toothStatusUpdates: [{ tooth: 26, status: 'RCT' as const, note: null }],
  notes: null,
  clarifications: [],
  safetyWarnings: [],
};

describe('Phase 3 consultation → Phase 4 queue cross-flow', () => {
  it('confirming a consultation broadcasts queue.visit.checkout to the clinic (§3.3)', async () => {
    const doctor = await createDoctorWithClinic(app);
    const recp = await joinReceptionist(app, doctor.joinCode);
    const { consultationId, visitId } = await seedConsultation(app, doctor.clinicId, doctor.userId, FINAL);

    const recpSocket = await connectClient(url, recp.accessToken);
    clients.push(recpSocket);
    const events = collect(recpSocket);
    await events.waitFor((e) => e.type === 'queue.snapshot');

    const res = await app.inject({
      method: 'POST',
      url: `/consultations/${consultationId}/confirm`,
      headers: authHeader(doctor.accessToken),
      payload: { structuredData: FINAL, confirmedWithWarning: false },
    });
    expect(res.statusCode).toBe(200);

    const evt = await events.waitFor((e) => e.type === 'queue.visit.checkout');
    expect(evt.type).toBe('queue.visit.checkout');
    if (evt.type === 'queue.visit.checkout') {
      expect(evt.payload.id).toBe(visitId);
      expect(evt.payload.status).toBe('CHECKOUT');
    }
  });

  it('processing audio fires doctor.recording.started and marks the visit as recording (§3.6)', async () => {
    const doctor = await createDoctorWithClinic(app);
    const recp = await joinReceptionist(app, doctor.joinCode);
    const { consultationId, visitId } = await seedConsultation(app, doctor.clinicId, doctor.userId, {});
    await app.prisma.consultation.update({
      where: { id: consultationId },
      data: { audioStorageKey: `clinics/${doctor.clinicId}/audio/${consultationId}.webm` },
    });

    const recpSocket = await connectClient(url, recp.accessToken);
    clients.push(recpSocket);
    const events = collect(recpSocket);
    await events.waitFor((e) => e.type === 'queue.snapshot');

    const res = await app.inject({
      method: 'POST',
      url: `/consultations/${consultationId}/process`,
      headers: authHeader(doctor.accessToken),
      payload: {},
    });
    expect(res.statusCode).toBe(200);

    const evt = await events.waitFor((e) => e.type === 'doctor.recording.started');
    expect(evt.type).toBe('doctor.recording.started');
    if (evt.type === 'doctor.recording.started') {
      expect(evt.payload.visitId).toBe(visitId);
      expect(evt.payload.doctorId).toBe(doctor.userId);
    }

    // Redis-backed presence so a reconnecting client's snapshot reflects the recording state.
    const recording = await getRecordingVisitIds(app.redis, doctor.clinicId);
    expect(recording.has(visitId)).toBe(true);
  });
});
