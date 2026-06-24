import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { Socket } from 'socket.io-client';
import { buildTestApp, createDoctorWithClinic, joinReceptionist } from './helpers.js';
import { collect, connectClient, listenApp } from './socket-helpers.js';
import { broadcastToClinic } from '../src/lib/realtime/broadcast.js';

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

describe('doctor recording indicator over the socket', () => {
  it('a doctor.recording.started broadcast reaches the receptionist screen', async () => {
    const doctor = await createDoctorWithClinic(app);
    const recp = await joinReceptionist(app, doctor.joinCode);

    const recpSocket = await connectClient(url, recp.accessToken);
    clients.push(recpSocket);
    const events = collect(recpSocket);
    await events.waitFor((e) => e.type === 'queue.snapshot');

    // Stage 5 fires this from the consultation /process handler; here we exercise the transport.
    broadcastToClinic(doctor.clinicId, {
      type: 'doctor.recording.started',
      payload: { visitId: 'visit-x', doctorId: doctor.userId, patientName: 'Akhilesh Guhan' },
    });

    const evt = await events.waitFor((e) => e.type === 'doctor.recording.started');
    expect(evt.type).toBe('doctor.recording.started');
    if (evt.type === 'doctor.recording.started') {
      expect(evt.payload.doctorId).toBe(doctor.userId);
      expect(evt.payload.patientName).toBe('Akhilesh Guhan');
    }
  });
});
