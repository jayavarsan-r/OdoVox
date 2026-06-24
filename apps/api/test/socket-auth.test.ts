import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { Socket } from 'socket.io-client';
import { buildTestApp, createDoctorWithClinic } from './helpers.js';
import { collect, connectClient, listenApp } from './socket-helpers.js';

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

describe('Socket.IO handshake auth', () => {
  it('rejects a connection with no token (AUTH_MISSING)', async () => {
    await expect(connectClient(url)).rejects.toMatchObject({ message: 'AUTH_MISSING' });
  });

  it('rejects a connection with an invalid token (AUTH_INVALID)', async () => {
    await expect(connectClient(url, 'not-a-real-jwt')).rejects.toMatchObject({ message: 'AUTH_INVALID' });
  });

  it('accepts a valid token and immediately emits the clinic snapshot', async () => {
    const doctor = await createDoctorWithClinic(app);
    const socket = await connectClient(url, doctor.accessToken);
    clients.push(socket);
    const events = collect(socket);
    const snapshot = await events.waitFor((e) => e.type === 'queue.snapshot');
    expect(snapshot.type).toBe('queue.snapshot');
    if (snapshot.type === 'queue.snapshot') {
      expect(Array.isArray(snapshot.payload.visits)).toBe(true);
      expect(Array.isArray(snapshot.payload.doctors)).toBe(true);
      expect(snapshot.payload.doctors.some((d) => d.id === doctor.userId)).toBe(true);
    }
  });
});
