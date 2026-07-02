import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { authHeader, buildTestApp, createDoctorWithClinic, createPatient, type ClinicSetup } from './helpers.js';
import { runWithContext } from '../src/lib/request-context.js';
import { transitionLabCase } from '../src/lib/lab/transition-service.js';

let app: FastifyInstance;
beforeAll(async () => {
  app = await buildTestApp();
});
afterAll(async () => {
  await app.close();
});

async function seedCase(s: ClinicSetup): Promise<{ caseId: string; vendorId: string }> {
  const vendor = await app.inject({
    method: 'POST',
    url: '/lab/vendors',
    headers: authHeader(s.accessToken),
    payload: { name: `Saveetha Lab ${Math.random().toString(36).slice(2, 6)}`, contactPhone: '9876500000' },
  });
  const vendorId = vendor.json().data.id as string;
  const patientId = await createPatient(app, s.clinicId, s.userId);
  const created = await app.inject({
    method: 'POST',
    url: '/lab/cases',
    headers: authHeader(s.accessToken),
    payload: { patientId, vendorId, type: 'CROWN', teeth: [26] },
  });
  return { caseId: created.json().data.id as string, vendorId };
}

describe('transitionLabCase (Phase 9.7 §2.3)', () => {
  it('walks the happy path and writes a LabCaseEvent per hop in the same transaction', async () => {
    const s = await createDoctorWithClinic(app);
    const { caseId } = await seedCase(s);

    await runWithContext({ clinicId: s.clinicId, userId: s.userId }, async () => {
      for (const to of ['SENT', 'ACKNOWLEDGED', 'IN_PROGRESS', 'READY', 'DISPATCHED', 'RECEIVED', 'FITTED'] as const) {
        const { labCase } = await transitionLabCase(app.prisma, {
          clinicId: s.clinicId,
          caseId,
          to,
          trigger: to === 'ACKNOWLEDGED' ? 'lab_button' : 'reception_manual',
        });
        expect(labCase.status).toBe(to);
      }
      const events = await app.prisma.labCaseEvent.findMany({ where: { labCaseId: caseId }, orderBy: { createdAt: 'asc' } });
      expect(events.map((e) => e.toStatus)).toEqual(['SENT', 'ACKNOWLEDGED', 'IN_PROGRESS', 'READY', 'DISPATCHED', 'RECEIVED', 'FITTED']);
      expect(events[1]!.trigger).toBe('lab_button');
      const final = await app.prisma.labCase.findUniqueOrThrow({ where: { id: caseId } });
      expect(final.statusUpdatedBy).toBe('reception_manual');
      expect(final.caseCode).toMatch(/^[A-Z]{2,3}-\d{4}$/);
    });
  });

  it('rejects invalid moves for non-manual triggers; backward corrections need reception_manual', async () => {
    const s = await createDoctorWithClinic(app);
    const { caseId } = await seedCase(s);

    await runWithContext({ clinicId: s.clinicId, userId: s.userId }, async () => {
      // DRAFT → READY is not in the matrix — a lab button can't do it.
      await expect(
        transitionLabCase(app.prisma, { clinicId: s.clinicId, caseId, to: 'READY', trigger: 'lab_button' }),
      ).rejects.toMatchObject({ code: 'INVALID_TRANSITION' });

      await transitionLabCase(app.prisma, { clinicId: s.clinicId, caseId, to: 'SENT', trigger: 'reception_manual' });
      await transitionLabCase(app.prisma, { clinicId: s.clinicId, caseId, to: 'READY', trigger: 'lab_text' });

      // Backward READY → SENT: rejected for the lab, allowed as a reception correction.
      await expect(
        transitionLabCase(app.prisma, { clinicId: s.clinicId, caseId, to: 'SENT', trigger: 'lab_text' }),
      ).rejects.toMatchObject({ code: 'INVALID_TRANSITION' });
      const corrected = await transitionLabCase(app.prisma, {
        clinicId: s.clinicId,
        caseId,
        to: 'SENT',
        trigger: 'reception_manual',
      });
      expect(corrected.labCase.status).toBe('SENT');
    });
  });

  it('timeout_job NEVER changes status, and llm_parse is gated at confidence ≥ 0.85', async () => {
    const s = await createDoctorWithClinic(app);
    const { caseId } = await seedCase(s);

    await runWithContext({ clinicId: s.clinicId, userId: s.userId }, async () => {
      await transitionLabCase(app.prisma, { clinicId: s.clinicId, caseId, to: 'SENT', trigger: 'reception_manual' });

      await expect(
        transitionLabCase(app.prisma, { clinicId: s.clinicId, caseId, to: 'READY', trigger: 'timeout_job' }),
      ).rejects.toMatchObject({ code: 'TIMEOUT_CANNOT_TRANSITION' });

      await expect(
        transitionLabCase(app.prisma, { clinicId: s.clinicId, caseId, to: 'READY', trigger: 'llm_parse', parseConfidence: 0.7 }),
      ).rejects.toMatchObject({ code: 'LLM_CONFIDENCE_TOO_LOW' });

      const ok = await transitionLabCase(app.prisma, {
        clinicId: s.clinicId,
        caseId,
        to: 'READY',
        trigger: 'llm_parse',
        parseConfidence: 0.92,
      });
      expect(ok.labCase.status).toBe('READY');
      expect(ok.labCase.statusUpdatedBy).toBe('llm_parse');
    });
  });

  it('replaying the same source message id is a no-op (idempotent webhooks)', async () => {
    const s = await createDoctorWithClinic(app);
    const { caseId } = await seedCase(s);

    await runWithContext({ clinicId: s.clinicId, userId: s.userId }, async () => {
      await transitionLabCase(app.prisma, { clinicId: s.clinicId, caseId, to: 'SENT', trigger: 'reception_manual' });
      const msg = await app.prisma.labMessage.create({
        data: { clinicId: s.clinicId, direction: 'INBOUND', waMessageId: `wamid_${Date.now()}`, body: 'ok received' },
      });

      const first = await transitionLabCase(app.prisma, {
        clinicId: s.clinicId,
        caseId,
        to: 'ACKNOWLEDGED',
        trigger: 'lab_button',
        sourceLabMessageId: msg.id,
      });
      expect(first.replayed).toBe(false);

      const replay = await transitionLabCase(app.prisma, {
        clinicId: s.clinicId,
        caseId,
        to: 'ACKNOWLEDGED',
        trigger: 'lab_button',
        sourceLabMessageId: msg.id,
      });
      expect(replay.replayed).toBe(true);
      const events = await app.prisma.labCaseEvent.findMany({ where: { labCaseId: caseId, sourceLabMessageId: msg.id } });
      expect(events).toHaveLength(1);
    });
  });
});
