import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildTestApp, createDoctorWithClinic, seedConsultation, authHeader } from './helpers.js';
import { startWorkers } from '../src/queues/start-workers.js';
import { storage } from '../src/lib/storage.js';
import { MOCK_TRANSCRIPT_PREFIX } from '../src/lib/stt/index.js';
import { getConsultationEventsSince } from '../src/queues/events.js';

/**
 * End-to-end voice pipeline regression (Phase 9.5). The existing pipeline tests call the worker
 * processors directly with a mock `emit`, so they never exercise the *real* seams: BullMQ enqueue →
 * worker consume → real publishConsultationEvent → Redis log → SSE HTTP delivery. Those seams are
 * exactly where a regression hides while every unit test stays green. These drive the whole thing
 * over the real queue, Redis, and a real socket.
 */

let app: FastifyInstance;
let workers: { stop: () => Promise<void> };
let baseUrl: string;
beforeAll(async () => {
  app = await buildTestApp();
  await app.ready();
  workers = startWorkers(app);
  await app.listen({ port: 0, host: '127.0.0.1' });
  const addr = app.server.address();
  const port = typeof addr === 'object' && addr ? addr.port : 0;
  baseUrl = `http://127.0.0.1:${port}`;
});
afterAll(async () => {
  await workers.stop();
  await app.close();
});

const TRANSCRIPT = 'RCT on 26 completed, third sitting. Amoxicillin 500mg TID for 5 days. Review next week.';

async function seedAudioConsult() {
  const setup = await createDoctorWithClinic(app);
  const { consultationId } = await seedConsultation(app, setup.clinicId, setup.userId, {});
  const key = `clinics/${setup.clinicId}/audio/${consultationId}.webm`;
  await storage.putObject(key, Buffer.from(`${MOCK_TRANSCRIPT_PREFIX}${TRANSCRIPT}`), 'audio/webm');
  await app.prisma.consultation.update({ where: { id: consultationId }, data: { audioStorageKey: key } });
  return { setup, consultationId, key };
}

describe('voice pipeline — real queue + Redis', () => {
  it('POST /process drives STT → extraction → READY through BullMQ and the Redis event log', async () => {
    const { setup, consultationId } = await seedAudioConsult();

    const res = await app.inject({
      method: 'POST',
      url: `/consultations/${consultationId}/process`,
      headers: authHeader(setup.accessToken),
      payload: {},
    });
    expect(res.statusCode).toBe(200);

    let types: string[] = [];
    for (let i = 0; i < 100; i++) {
      const events = await getConsultationEventsSince(app.redis, consultationId, 0);
      types = events.map((e) => e.event.type);
      if (types.includes('READY') || types.includes('FAILED')) break;
      await new Promise((r) => setTimeout(r, 100));
    }
    expect(types).toEqual(['RECORDED', 'TRANSCRIBING', 'TRANSCRIBED', 'EXTRACTING', 'READY']);

    const consult = await app.prisma.consultation.findUniqueOrThrow({ where: { id: consultationId } });
    expect(consult.status).toBe('PENDING_REVIEW');
    const sd = consult.structuredData as { procedure?: string };
    expect(sd.procedure).toBe('RCT');
  }, 30000);
});

describe('voice pipeline — SSE delivery over a real socket', () => {
  it('streams RECORDED..READY frames to a fetch client (browser-shaped consumer)', async () => {
    const { setup, consultationId } = await seedAudioConsult();

    const proc = await fetch(`${baseUrl}/consultations/${consultationId}/process`, {
      method: 'POST',
      headers: { ...authHeader(setup.accessToken), 'content-type': 'application/json' },
      body: '{}',
    });
    expect(proc.status).toBe(200);

    const ctrl = new AbortController();
    const res = await fetch(`${baseUrl}/consultations/${consultationId}/stream?since=0`, {
      headers: authHeader(setup.accessToken),
      signal: ctrl.signal,
    });
    expect(res.status).toBe(200);

    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    const seen: string[] = [];
    const deadline = Date.now() + 12000;
    let buffer = '';
    try {
      while (Date.now() < deadline && !seen.includes('READY')) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const frames = buffer.split('\n\n');
        buffer = frames.pop() ?? '';
        for (const f of frames) {
          const line = f.split('\n').find((l) => l.startsWith('data:'));
          if (!line) continue;
          try {
            seen.push((JSON.parse(line.slice(5).trim()) as { type: string }).type);
          } catch {
            /* ignore heartbeat / malformed */
          }
        }
      }
    } finally {
      ctrl.abort();
    }
    expect(seen).toContain('TRANSCRIBING');
    expect(seen).toContain('EXTRACTING');
    expect(seen).toContain('READY');
  }, 30000);
});
