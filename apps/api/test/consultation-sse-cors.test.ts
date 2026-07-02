import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildTestApp, createDoctorWithClinic, seedConsultation, authHeader } from './helpers.js';

/**
 * Regression (Phase 9.5): the consult SSE stream is a hand-rolled `reply.hijack()` response. Hijack
 * bypasses Fastify's normal onSend serialization — which is where @fastify/cors writes the
 * Access-Control-Allow-Origin / -Credentials headers. Without them, a browser at CORS_ORIGINS
 * (localhost:3000) opening the cross-origin stream (localhost:4000) has its response BLOCKED, the
 * fetch rejects, and the consult UI freezes on "Transcribing" forever. Node fetch does not enforce
 * CORS, so this was invisible to every other test — hence this explicit header assertion.
 */

let app: FastifyInstance;
let baseUrl: string;
beforeAll(async () => {
  app = await buildTestApp();
  await app.ready();
  await app.listen({ port: 0, host: '127.0.0.1' });
  const addr = app.server.address();
  const port = typeof addr === 'object' && addr ? addr.port : 0;
  baseUrl = `http://127.0.0.1:${port}`;
});
afterAll(async () => {
  await app.close();
});

const ORIGIN = 'http://localhost:3000';

describe('consult SSE — CORS headers survive reply.hijack()', () => {
  it('reflects the allowed Origin + credentials on the hijacked stream response', async () => {
    const setup = await createDoctorWithClinic(app);
    const { consultationId } = await seedConsultation(app, setup.clinicId, setup.userId, {});

    const ctrl = new AbortController();
    const res = await fetch(`${baseUrl}/consultations/${consultationId}/stream?since=0`, {
      headers: { ...authHeader(setup.accessToken), origin: ORIGIN },
      signal: ctrl.signal,
    });
    try {
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toBe('text/event-stream');
      // The bug: these were null on the hijacked response, so the browser blocked the stream.
      expect(res.headers.get('access-control-allow-origin')).toBe(ORIGIN);
      expect(res.headers.get('access-control-allow-credentials')).toBe('true');
      // SSE transport headers must also be present (proxy-buffering + caching guards).
      expect(res.headers.get('cache-control')).toContain('no-cache');
      expect(res.headers.get('x-accel-buffering')).toBe('no');
    } finally {
      ctrl.abort();
    }
  }, 20000);
});
