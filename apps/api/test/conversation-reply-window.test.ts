import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { runWithContext } from '../src/lib/request-context.js';
import { authHeader, buildTestApp, createDoctorWithClinic, createPatient } from './helpers.js';

let app: FastifyInstance;
beforeAll(async () => {
  app = await buildTestApp();
  await app.ready();
});
afterAll(async () => {
  await app.close();
});

async function makeConvo(clinicId: string, patientId: string, windowExpiresAt: Date) {
  return runWithContext({ clinicId }, async () => {
    const c = await app.prisma.patientConversation.create({
      data: { clinicId, patientId, status: 'OPEN', category: 'GENERAL_QUERY', lastInboundAt: new Date(), windowExpiresAt, lastMessageAt: new Date(), unreadCount: 2 },
    });
    return c.id;
  });
}

describe('Conversation reply — 24h window', () => {
  it('allows a free-text reply inside the window and clears unread on open', async () => {
    const doc = await createDoctorWithClinic(app);
    const patientId = await createPatient(app, doc.clinicId, doc.userId);
    const convoId = await makeConvo(doc.clinicId, patientId, new Date(Date.now() + 60 * 60 * 1000));

    const detail = await app.inject({ method: 'GET', url: `/whatsapp/conversations/${convoId}`, headers: authHeader(doc.accessToken) });
    expect(detail.statusCode).toBe(200);
    expect(detail.json().data.windowOpen).toBe(true);
    expect(detail.json().data.unreadCount).toBe(0);

    const reply = await app.inject({ method: 'POST', url: `/whatsapp/conversations/${convoId}/reply`, headers: authHeader(doc.accessToken), payload: { text: 'Yes, we are open till 8pm.' } });
    expect(reply.statusCode).toBe(200);
    expect(reply.json().data.direction).toBe('OUTBOUND');
    expect(reply.json().data.status).toBe('SENT');
  });

  it('blocks a free-text reply after the window closes', async () => {
    const doc = await createDoctorWithClinic(app);
    const patientId = await createPatient(app, doc.clinicId, doc.userId);
    const convoId = await makeConvo(doc.clinicId, patientId, new Date(Date.now() - 60 * 1000));

    const reply = await app.inject({ method: 'POST', url: `/whatsapp/conversations/${convoId}/reply`, headers: authHeader(doc.accessToken), payload: { text: 'too late' } });
    expect(reply.statusCode).toBe(422);
    expect(reply.json().error.code).toBe('WHATSAPP_WINDOW_CLOSED');
  });

  it('resolves a conversation', async () => {
    const doc = await createDoctorWithClinic(app);
    const patientId = await createPatient(app, doc.clinicId, doc.userId);
    const convoId = await makeConvo(doc.clinicId, patientId, new Date(Date.now() + 60 * 60 * 1000));
    const res = await app.inject({ method: 'POST', url: `/whatsapp/conversations/${convoId}/resolve`, headers: authHeader(doc.accessToken), payload: {} });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.status).toBe('RESOLVED');
  });
});
