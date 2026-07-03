import type { FastifyInstance, FastifyRequest } from 'fastify';
import { nanoid } from 'nanoid';
import {
  AttachLabPhotoInput,
  CancelLabCaseInput,
  CompleteLabCaseInput,
  ConfirmReceivedLabCaseInput,
  CreateLabCaseInput,
  CreateLabVendorInput,
  DeliverLabCaseInput,
  LabPhotoPresignInput,
  LabVendorAutomationInput,
  LabVendorConsentInput,
  ListLabCasesQuery,
  ReceiveLabCaseInput,
  ReworkLabCaseInput,
  SendLabCaseInput,
  TransitionLabCaseInput,
  UpdateLabCaseInput,
  UpdateLabVendorInput,
} from '@odovox/types';
import { ForbiddenError, NotFoundError, UnprocessableError, ValidationError } from '../lib/errors.js';
import { ok, parse } from '../lib/http.js';
import { requireRole } from '../lib/rbac.js';
import { encryptField } from '../lib/encryption.js';
import { storage, extForMime } from '../lib/storage.js';
import { broadcastToClinic } from '../lib/realtime/broadcast.js';
import { generateUniqueCaseNumber } from '../lib/lab/case-number.js';
import { allocateCaseCode } from '../lib/lab/case-code.js';
import { assertTransition } from '../lib/lab/transitions.js';
import { transitionLabCase } from '../lib/lab/transition-service.js';
import { sendLabTemplate } from '../lib/lab-transport/send-service.js';
import { normalizeIndianPhone } from '../lib/whatsapp/render.js';
import { notifyLabCaseReady } from '../lib/whatsapp/cross-wire.js';
import {
  LAB_CASE_DETAIL_INCLUDE,
  LAB_CASE_SUMMARY_INCLUDE,
  toLabCaseResponse,
  toLabCaseSummary,
  toLabVendorResponse,
} from '../lib/lab/serialize.js';

const DAY_MS = 24 * 60 * 60 * 1000;

export async function labRoutes(fastify: FastifyInstance): Promise<void> {
  const { prisma } = fastify;
  const anyRole = { preHandler: [fastify.authenticate, requireRole('DOCTOR', 'RECEPTIONIST', 'ADMIN')] };
  const doctorAdmin = { preHandler: [fastify.authenticate, requireRole('DOCTOR', 'ADMIN')] };

  // ── Helpers ─────────────────────────────────────────────────────────────────
  async function loadVendorOr404(clinicId: string, id: string) {
    const v = await prisma.labVendor.findFirst({ where: { id, clinicId } });
    if (!v) throw new NotFoundError('Lab vendor not found');
    return v;
  }

  async function loadCaseOr404(clinicId: string, id: string) {
    const c = await prisma.labCase.findFirst({ where: { id, clinicId } });
    if (!c) throw new NotFoundError('Lab case not found');
    return c;
  }

  /** Doctors may only edit/send/receive/rework their OWN cases. ADMIN/RECEPTIONIST bypass. */
  function assertDoctorOwns(req: FastifyRequest, doctorId: string): void {
    if (req.role === 'DOCTOR' && doctorId !== req.user!.id) {
      throw new ForbiddenError('Doctors can only manage their own lab cases');
    }
  }

  /** Re-load with summary joins and broadcast a lab event after commit. */
  async function broadcastCase(clinicId: string, id: string, type: 'lab.case.created' | 'lab.case.updated') {
    const full = await prisma.labCase.findFirstOrThrow({
      where: { id, clinicId },
      include: LAB_CASE_SUMMARY_INCLUDE,
    });
    const payload = toLabCaseSummary(full);
    broadcastToClinic(clinicId, { type, payload });
    return payload;
  }

  async function caseDetail(clinicId: string, id: string) {
    const full = await prisma.labCase.findFirstOrThrow({
      where: { id, clinicId },
      include: LAB_CASE_DETAIL_INCLUDE,
    });
    return toLabCaseResponse(full);
  }

  // ===========================================================================
  // Vendors
  // ===========================================================================

  fastify.get('/lab/vendors', anyRole, async (req) => {
    const rows = await prisma.labVendor.findMany({
      where: { clinicId: req.clinicId!, isArchived: false },
      orderBy: { name: 'asc' },
    });
    // List view never reveals contact PII.
    return ok({ items: rows.map((r) => toLabVendorResponse(r, false)) });
  });

  /** WhatsApp numbers stored normalized to E.164 (+91…) — the inbound router matches on them. */
  const normalizeWaNumbers = (numbers: string[]): string[] =>
    [...new Set(numbers.map((n) => normalizeIndianPhone(n) ?? n).filter(Boolean))];

  fastify.post('/lab/vendors', doctorAdmin, async (req, reply) => {
    const body = parse(CreateLabVendorInput, req.body);
    const vendor = await prisma.labVendor.create({
      data: {
        clinicId: req.clinicId!,
        name: body.name,
        contactPhoneEnc: encryptField(body.contactPhone),
        contactPersonName: body.contactPersonName ?? null,
        addressEnc: body.address ? encryptField(body.address) : null,
        email: body.email ?? null,
        defaultTurnaroundDays: body.defaultTurnaroundDays,
        specialties: body.specialties,
        notes: body.notes ?? null,
        whatsappPhoneNumbers: normalizeWaNumbers(body.whatsappPhoneNumbers),
        preferredLanguage: body.preferredLanguage,
        createdById: req.user!.id,
      },
    });
    await fastify.audit('LAB_VENDOR_CREATED', 'LabVendor', vendor.id, { name: body.name });
    reply.status(201);
    return ok(toLabVendorResponse(vendor, true));
  });

  // ── Phase 9.7 §2.11 — one-time consent + per-lab automation kill switch ─────
  fastify.post('/lab/vendors/:id/consent', anyRole, async (req) => {
    const { id } = req.params as { id: string };
    const body = parse(LabVendorConsentInput, req.body);
    const vendor = await loadVendorOr404(req.clinicId!, id);

    if (body.action === 'send_optin') {
      // T-consent is the one template allowed pre-consent; consentLoggedAt is stamped when the
      // lab replies YES (inbound router) or when reception marks it confirmed manually.
      const result = await sendLabTemplate(prisma, {
        clinicId: req.clinicId!,
        vendorId: vendor.id,
        templateKey: 'lab_t_consent',
        automated: false,
        throwOnBlock: true,
      });
      await fastify.audit('LAB_VENDOR_CONSENT_OPTIN_SENT', 'LabVendor', id, {});
      return ok({ sent: result.sent, consentLoggedAt: vendor.consentLoggedAt });
    }

    const updated = await prisma.labVendor.update({ where: { id }, data: { consentLoggedAt: new Date() } });
    await fastify.audit('LAB_VENDOR_CONSENT_CONFIRMED', 'LabVendor', id, { via: 'reception_manual' });
    return ok({ sent: false, consentLoggedAt: updated.consentLoggedAt });
  });

  fastify.post('/lab/vendors/:id/automation', anyRole, async (req) => {
    const { id } = req.params as { id: string };
    const body = parse(LabVendorAutomationInput, req.body);
    await loadVendorOr404(req.clinicId!, id);
    const updated = await prisma.labVendor.update({ where: { id }, data: { automationPaused: body.paused } });
    await fastify.audit('LAB_VENDOR_AUTOMATION_TOGGLED', 'LabVendor', id, { paused: body.paused });
    return ok(toLabVendorResponse(updated, false));
  });

  // Detail reveals the decrypted phone/address — audited.
  fastify.get('/lab/vendors/:id', anyRole, async (req) => {
    const { id } = req.params as { id: string };
    const vendor = await loadVendorOr404(req.clinicId!, id);
    await fastify.audit('LAB_VENDOR_CONTACT_REVEALED', 'LabVendor', id);
    return ok(toLabVendorResponse(vendor, true));
  });

  fastify.patch('/lab/vendors/:id', doctorAdmin, async (req) => {
    const { id } = req.params as { id: string };
    const body = parse(UpdateLabVendorInput, req.body);
    const vendor = await loadVendorOr404(req.clinicId!, id);
    // DOCTORs may only edit vendors they created; ADMIN may edit any.
    if (req.role === 'DOCTOR' && vendor.createdById !== req.user!.id) {
      throw new ForbiddenError('Only the creator or an admin can edit this vendor');
    }
    const updated = await prisma.labVendor.update({
      where: { id },
      data: {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.contactPhone !== undefined ? { contactPhoneEnc: encryptField(body.contactPhone) } : {}),
        ...(body.contactPersonName !== undefined ? { contactPersonName: body.contactPersonName } : {}),
        ...(body.address !== undefined ? { addressEnc: body.address ? encryptField(body.address) : null } : {}),
        ...(body.email !== undefined ? { email: body.email } : {}),
        ...(body.defaultTurnaroundDays !== undefined ? { defaultTurnaroundDays: body.defaultTurnaroundDays } : {}),
        ...(body.specialties !== undefined ? { specialties: body.specialties } : {}),
        ...(body.notes !== undefined ? { notes: body.notes } : {}),
        ...(body.whatsappPhoneNumbers !== undefined ? { whatsappPhoneNumbers: normalizeWaNumbers(body.whatsappPhoneNumbers) } : {}),
        ...(body.preferredLanguage !== undefined ? { preferredLanguage: body.preferredLanguage } : {}),
      },
    });
    await fastify.audit('LAB_VENDOR_UPDATED', 'LabVendor', id, {});
    return ok(toLabVendorResponse(updated, true));
  });

  fastify.delete('/lab/vendors/:id', doctorAdmin, async (req) => {
    const { id } = req.params as { id: string };
    await loadVendorOr404(req.clinicId!, id);
    await prisma.labVendor.update({ where: { id }, data: { isArchived: true } });
    await fastify.audit('LAB_VENDOR_ARCHIVED', 'LabVendor', id);
    return ok({ archived: true });
  });

  // ===========================================================================
  // Cases — CRUD
  // ===========================================================================

  fastify.get('/lab/cases', anyRole, async (req) => {
    const q = parse(ListLabCasesQuery, req.query);
    const clinicId = req.clinicId!;
    const where: Record<string, unknown> = { clinicId };
    if (q.status) where.status = q.status;
    if (q.vendorId) where.vendorId = q.vendorId;
    if (q.patientId) where.patientId = q.patientId;
    if (q.search) {
      where.OR = [
        { caseNumber: { contains: q.search, mode: 'insensitive' } },
        { patient: { name: { contains: q.search, mode: 'insensitive' } } },
      ];
    }
    const rows = await prisma.labCase.findMany({
      where,
      include: LAB_CASE_SUMMARY_INCLUDE,
      orderBy: { createdAt: 'desc' },
      take: q.limit + 1,
      ...(q.cursor ? { cursor: { id: q.cursor }, skip: 1 } : {}),
    });
    const hasMore = rows.length > q.limit;
    const items = rows.slice(0, q.limit).map(toLabCaseSummary);
    return ok({ items, nextCursor: hasMore ? items[items.length - 1]!.id : null });
  });

  fastify.post('/lab/cases', doctorAdmin, async (req, reply) => {
    const body = parse(CreateLabCaseInput, req.body);
    const clinicId = req.clinicId!;
    const doctorId = body.doctorId ?? req.user!.id;
    assertDoctorOwns(req, doctorId);

    // Validate FK targets are in this clinic (vendor optional — DRAFTs may pick a lab later).
    const [patient, vendor, clinic] = await Promise.all([
      prisma.patient.findFirst({ where: { id: body.patientId, clinicId } }),
      body.vendorId ? prisma.labVendor.findFirst({ where: { id: body.vendorId, clinicId } }) : Promise.resolve(null),
      prisma.clinic.findUniqueOrThrow({ where: { id: clinicId }, select: { joinCode: true } }),
    ]);
    if (!patient) throw new NotFoundError('Patient not found');
    if (body.vendorId && !vendor) throw new NotFoundError('Lab vendor not found');

    const caseNumber = await generateUniqueCaseNumber(prisma, clinicId, clinic.joinCode);

    const created = await prisma.$transaction(async (tx) => {
      // Human case code (DK-0042) allocated atomically — in every WhatsApp message from day one.
      const caseCode = await allocateCaseCode(tx, clinicId);
      return tx.labCase.create({
        data: {
          clinicId,
          patientId: body.patientId,
          doctorId,
          vendorId: body.vendorId ?? null,
          caseNumber,
          caseCode,
          type: body.type,
          teeth: body.teeth,
          material: body.material ?? null,
          shade: body.shade ?? null,
          description: body.description ?? null,
          impressionTakenAt: body.impressionTakenAt ?? new Date(),
          expectedReturnAt: body.expectedReturnAt ?? null,
          costPaise: body.costPaise ?? null,
          patientChargePaise: body.patientChargePaise ?? null,
          notesEnc: body.notes ? encryptField(body.notes) : null,
          treatmentPlanId: body.treatmentPlanId ?? null,
          visitId: body.visitId ?? null,
          status: 'DRAFT',
          createdById: req.user!.id,
        },
      });
    });
    await fastify.audit('LAB_CASE_CREATED', 'LabCase', created.id, { caseNumber, type: body.type });
    await broadcastCase(clinicId, created.id, 'lab.case.created');
    reply.status(201);
    return ok(await caseDetail(clinicId, created.id));
  });

  fastify.get('/lab/cases/:id', anyRole, async (req) => {
    const { id } = req.params as { id: string };
    await loadCaseOr404(req.clinicId!, id);
    return ok(await caseDetail(req.clinicId!, id));
  });

  fastify.patch('/lab/cases/:id', doctorAdmin, async (req) => {
    const { id } = req.params as { id: string };
    const body = parse(UpdateLabCaseInput, req.body);
    const clinicId = req.clinicId!;
    const existing = await loadCaseOr404(clinicId, id);
    assertDoctorOwns(req, existing.doctorId);
    if (existing.status !== 'DRAFT' && existing.status !== 'SENT') {
      throw new ValidationError('Only DRAFT or SENT cases can be edited');
    }
    if (body.vendorId) {
      const vendor = await prisma.labVendor.findFirst({ where: { id: body.vendorId, clinicId } });
      if (!vendor) throw new NotFoundError('Lab vendor not found');
    }
    await prisma.labCase.update({
      where: { id },
      data: {
        ...(body.vendorId !== undefined ? { vendorId: body.vendorId } : {}),
        ...(body.type !== undefined ? { type: body.type } : {}),
        ...(body.teeth !== undefined ? { teeth: body.teeth } : {}),
        ...(body.material !== undefined ? { material: body.material } : {}),
        ...(body.shade !== undefined ? { shade: body.shade } : {}),
        ...(body.description !== undefined ? { description: body.description } : {}),
        ...(body.impressionTakenAt !== undefined ? { impressionTakenAt: body.impressionTakenAt } : {}),
        ...(body.expectedReturnAt !== undefined ? { expectedReturnAt: body.expectedReturnAt } : {}),
        ...(body.costPaise !== undefined ? { costPaise: body.costPaise } : {}),
        ...(body.patientChargePaise !== undefined ? { patientChargePaise: body.patientChargePaise } : {}),
        ...(body.notes !== undefined ? { notesEnc: body.notes ? encryptField(body.notes) : null } : {}),
        ...(body.treatmentPlanId !== undefined ? { treatmentPlanId: body.treatmentPlanId } : {}),
        ...(body.visitId !== undefined ? { visitId: body.visitId } : {}),
      },
    });
    await fastify.audit('LAB_CASE_UPDATED', 'LabCase', id, {});
    await broadcastCase(clinicId, id, 'lab.case.updated');
    return ok(await caseDetail(clinicId, id));
  });

  // ── Phase 9.7 §2.3 — generic manual transition (reception status buttons) ────
  // ALL 9.7 status moves go through transitionLabCase (matrix + history + idempotency).
  // Side effects after commit: T1 on → SENT (consent-gated, blocking for manual sends unless
  // skipWhatsApp), T4 auto-fires on → RECEIVED, patient notification on → READY.
  fastify.post('/lab/cases/:id/transition', anyRole, async (req) => {
    const { id } = req.params as { id: string };
    const body = parse(TransitionLabCaseInput, req.body);
    const clinicId = req.clinicId!;
    const existing = await loadCaseOr404(clinicId, id);
    if (req.role === 'DOCTOR') assertDoctorOwns(req, existing.doctorId);

    // A case can't go to the lab without a lab (voice-suggested DRAFTs start vendorless).
    if (body.to === 'SENT' && !existing.vendorId) {
      throw new UnprocessableError('Pick a lab before sending this case.', 'LAB_SEND_NO_VENDOR');
    }
    // §2.11 — a manual Send for a non-consented lab blocks BEFORE the status moves, so the UI
    // can show the consent modal and the case stays DRAFT. skipWhatsApp = "sent by other means".
    if (body.to === 'SENT' && !body.skipWhatsApp) {
      const vendor = await prisma.labVendor.findUniqueOrThrow({ where: { id: existing.vendorId! } });
      if (!vendor.consentLoggedAt) {
        throw new UnprocessableError(
          'This lab hasn’t opted in to WhatsApp. Confirm consent first, or mark as sent without WhatsApp.',
          'LAB_SEND_NO_CONSENT',
        );
      }
    }

    const { labCase } = await transitionLabCase(prisma, {
      clinicId,
      caseId: id,
      to: body.to,
      trigger: 'reception_manual',
      note: body.note ?? null,
      byUserId: req.user!.id,
    });

    // Post-commit side effects (best-effort — the status change is already durable).
    if (body.to === 'SENT' && !body.skipWhatsApp && labCase.vendorId) {
      await sendLabTemplate(prisma, { clinicId, vendorId: labCase.vendorId, caseId: id, templateKey: 'lab_t1_new_case', automated: false, throwOnBlock: false });
    }
    if (body.to === 'RECEIVED' && labCase.vendorId) {
      await sendLabTemplate(prisma, { clinicId, vendorId: labCase.vendorId, caseId: id, templateKey: 'lab_t4_receipt', automated: true, throwOnBlock: false });
    }
    if (body.to === 'READY') {
      await notifyLabCaseReady(fastify, clinicId, id); // Phase 9 patient T5 (consent-gated)
      if (labCase.vendorId) {
        // T3 — "when will it reach the clinic?" (automated → respects pause + consent).
        await sendLabTemplate(prisma, { clinicId, vendorId: labCase.vendorId, caseId: id, templateKey: 'lab_t3_dispatch', automated: true, throwOnBlock: false });
      }
    }

    await fastify.audit('LAB_CASE_TRANSITION', 'LabCase', id, { to: body.to, trigger: 'reception_manual' });
    await broadcastCase(clinicId, id, 'lab.case.updated');
    return ok(await caseDetail(clinicId, id));
  });

  // ── Transitions (legacy Phase 7 endpoints — still served for the existing UI) ─
  // Each: load → ownership → assertTransition → update → audit → broadcast.

  fastify.post('/lab/cases/:id/send', doctorAdmin, async (req) => {
    const { id } = req.params as { id: string };
    const body = parse(SendLabCaseInput, req.body);
    const clinicId = req.clinicId!;
    const existing = await loadCaseOr404(clinicId, id);
    assertDoctorOwns(req, existing.doctorId);
    assertTransition(existing.status, 'SENT');
    if (!existing.vendorId) throw new UnprocessableError('Pick a lab before sending this case.', 'LAB_SEND_NO_VENDOR');

    const vendor = await prisma.labVendor.findUniqueOrThrow({ where: { id: existing.vendorId } });
    const sentAt = body.sentAt ?? new Date();
    const expectedReturnAt =
      body.expectedReturnAt ?? new Date(sentAt.getTime() + vendor.defaultTurnaroundDays * DAY_MS);

    await prisma.labCase.update({
      where: { id },
      data: { status: 'SENT', sentAt, expectedReturnAt, rejectionReason: null },
    });
    await fastify.audit('LAB_CASE_SENT', 'LabCase', id, { vendorId: existing.vendorId });
    await broadcastCase(clinicId, id, 'lab.case.updated');
    return ok(await caseDetail(clinicId, id));
  });

  fastify.post('/lab/cases/:id/confirm-received', doctorAdmin, async (req) => {
    const { id } = req.params as { id: string };
    parse(ConfirmReceivedLabCaseInput, req.body ?? {});
    const clinicId = req.clinicId!;
    const existing = await loadCaseOr404(clinicId, id);
    assertDoctorOwns(req, existing.doctorId);
    assertTransition(existing.status, 'IN_PROGRESS');
    await prisma.labCase.update({ where: { id }, data: { status: 'IN_PROGRESS' } });
    await fastify.audit('LAB_CASE_IN_PROGRESS', 'LabCase', id, {});
    await broadcastCase(clinicId, id, 'lab.case.updated');
    return ok(await caseDetail(clinicId, id));
  });

  fastify.post('/lab/cases/:id/receive', doctorAdmin, async (req) => {
    const { id } = req.params as { id: string };
    const body = parse(ReceiveLabCaseInput, req.body ?? {});
    const clinicId = req.clinicId!;
    const existing = await loadCaseOr404(clinicId, id);
    assertDoctorOwns(req, existing.doctorId);
    assertTransition(existing.status, 'READY');
    await prisma.labCase.update({
      where: { id },
      data: {
        status: 'READY',
        returnedAt: body.returnedAt ?? new Date(),
        ...(body.costPaise !== undefined ? { costPaise: body.costPaise } : {}),
      },
    });
    await fastify.audit('LAB_CASE_RECEIVED', 'LabCase', id, {});
    await broadcastCase(clinicId, id, 'lab.case.updated');
    // Phase 9: notify the patient their case is ready for fitting (best-effort, consent-gated).
    await notifyLabCaseReady(fastify, clinicId, id);
    return ok(await caseDetail(clinicId, id));
  });

  fastify.post('/lab/cases/:id/deliver', anyRole, async (req) => {
    const { id } = req.params as { id: string };
    const body = parse(DeliverLabCaseInput, req.body ?? {});
    const clinicId = req.clinicId!;
    const existing = await loadCaseOr404(clinicId, id);

    if (body.requireRework) {
      // Mark this case for rework and clone a fresh DRAFT linked back to it.
      assertTransition(existing.status, 'RETURNED_FOR_REWORK');
      const clinic = await prisma.clinic.findUniqueOrThrow({ where: { id: clinicId }, select: { joinCode: true } });
      const caseNumber = await generateUniqueCaseNumber(prisma, clinicId, clinic.joinCode);
      const clone = await prisma.$transaction(async (tx) => {
        await tx.labCase.update({
          where: { id },
          data: { status: 'RETURNED_FOR_REWORK', rejectionReason: body.reworkReason ?? 'Rework required at delivery' },
        });
        return tx.labCase.create({
          data: {
            clinicId,
            patientId: existing.patientId,
            doctorId: existing.doctorId,
            vendorId: existing.vendorId,
            caseNumber,
            type: existing.type,
            teeth: existing.teeth,
            material: existing.material,
            shade: existing.shade,
            description: existing.description,
            costPaise: existing.costPaise,
            patientChargePaise: existing.patientChargePaise,
            treatmentPlanId: existing.treatmentPlanId,
            visitId: existing.visitId,
            status: 'DRAFT',
            reworkOfId: id,
            createdById: req.user!.id,
          },
        });
      });
      await fastify.audit('LAB_CASE_REWORK', 'LabCase', id, { cloneId: clone.id });
      await broadcastCase(clinicId, id, 'lab.case.updated');
      await broadcastCase(clinicId, clone.id, 'lab.case.created');
      return ok(await caseDetail(clinicId, id));
    }

    assertTransition(existing.status, 'DELIVERED');
    await prisma.labCase.update({
      where: { id },
      data: {
        status: 'DELIVERED',
        deliveredAt: body.deliveredAt ?? new Date(),
        ...(body.patientChargePaise !== undefined ? { patientChargePaise: body.patientChargePaise } : {}),
      },
    });
    await fastify.audit('LAB_CASE_DELIVERED', 'LabCase', id, {});
    await broadcastCase(clinicId, id, 'lab.case.updated');
    return ok(await caseDetail(clinicId, id));
  });

  fastify.post('/lab/cases/:id/rework', doctorAdmin, async (req) => {
    const { id } = req.params as { id: string };
    const body = parse(ReworkLabCaseInput, req.body);
    const clinicId = req.clinicId!;
    const existing = await loadCaseOr404(clinicId, id);
    assertDoctorOwns(req, existing.doctorId);
    assertTransition(existing.status, 'RETURNED_FOR_REWORK');
    await prisma.labCase.update({
      where: { id },
      data: { status: 'RETURNED_FOR_REWORK', rejectionReason: body.reason },
    });
    await fastify.audit('LAB_CASE_REWORK', 'LabCase', id, { reason: body.reason });
    await broadcastCase(clinicId, id, 'lab.case.updated');
    return ok(await caseDetail(clinicId, id));
  });

  fastify.post('/lab/cases/:id/complete', anyRole, async (req) => {
    const { id } = req.params as { id: string };
    const body = parse(CompleteLabCaseInput, req.body ?? {});
    const clinicId = req.clinicId!;
    const existing = await loadCaseOr404(clinicId, id);
    assertTransition(existing.status, 'COMPLETED');
    await prisma.labCase.update({
      where: { id },
      data: { status: 'COMPLETED', completedAt: body.completedAt ?? new Date() },
    });
    await fastify.audit('LAB_CASE_COMPLETED', 'LabCase', id, {});
    await broadcastCase(clinicId, id, 'lab.case.updated');
    return ok(await caseDetail(clinicId, id));
  });

  fastify.post('/lab/cases/:id/cancel', anyRole, async (req) => {
    const { id } = req.params as { id: string };
    const body = parse(CancelLabCaseInput, req.body);
    const clinicId = req.clinicId!;
    const existing = await loadCaseOr404(clinicId, id);
    assertTransition(existing.status, 'CANCELLED');
    await prisma.labCase.update({
      where: { id },
      data: { status: 'CANCELLED', rejectionReason: body.reason },
    });
    await fastify.audit('LAB_CASE_CANCELLED', 'LabCase', id, { reason: body.reason });
    await broadcastCase(clinicId, id, 'lab.case.updated');
    return ok(await caseDetail(clinicId, id));
  });

  // ===========================================================================
  // Photos (reuse Media, type=LAB_PHOTO)
  // ===========================================================================

  fastify.post('/lab/cases/:id/photos/presign', anyRole, async (req) => {
    const { id } = req.params as { id: string };
    const body = parse(LabPhotoPresignInput, req.body);
    const c = await loadCaseOr404(req.clinicId!, id);
    const key = `clinics/${req.clinicId}/lab/${c.id}/${nanoid()}.${extForMime(body.mimeType)}`;
    const uploadUrl = await storage.presignUpload(key, body.mimeType, 300);
    return ok({ uploadUrl, storageKey: key });
  });

  fastify.post('/lab/cases/:id/photos', anyRole, async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = parse(AttachLabPhotoInput, req.body);
    const c = await loadCaseOr404(req.clinicId!, id);
    const media = await prisma.media.create({
      data: {
        clinicId: req.clinicId!,
        patientId: c.patientId,
        labCaseId: c.id,
        type: 'LAB_PHOTO',
        storageKey: body.storageKey,
        mimeType: body.mimeType,
        sizeBytes: body.sizeBytes,
        width: body.width ?? null,
        height: body.height ?? null,
        thumbnailKey: body.thumbnailKey ?? null,
        uploadedById: req.user!.id,
      },
    });
    await fastify.audit('LAB_PHOTO_ATTACHED', 'Media', media.id, { labCaseId: c.id });
    reply.status(201);
    return ok({ id: media.id, storageKey: media.storageKey, mimeType: media.mimeType, uploadedAt: media.uploadedAt });
  });

  fastify.get('/lab/cases/:id/photos', anyRole, async (req) => {
    const { id } = req.params as { id: string };
    await loadCaseOr404(req.clinicId!, id);
    const rows = await prisma.media.findMany({
      where: { labCaseId: id, deletedAt: null },
      orderBy: { uploadedAt: 'asc' },
    });
    const items = await Promise.all(
      rows.map(async (m) => ({
        id: m.id,
        url: await storage.getSignedUrl(m.storageKey, 300).catch(() => null),
        thumbnailKey: m.thumbnailKey,
        mimeType: m.mimeType,
        uploadedAt: m.uploadedAt,
      })),
    );
    return ok({ items });
  });

  fastify.delete('/lab/cases/photos/:mediaId', anyRole, async (req) => {
    const { mediaId } = req.params as { mediaId: string };
    const media = await prisma.media.findFirst({
      where: { id: mediaId, clinicId: req.clinicId!, type: 'LAB_PHOTO', deletedAt: null },
    });
    if (!media) throw new NotFoundError('Photo not found');
    await prisma.media.update({ where: { id: mediaId }, data: { deletedAt: new Date() } });
    await storage.deleteObject(media.storageKey).catch(() => undefined);
    await fastify.audit('LAB_PHOTO_DELETED', 'Media', mediaId, {});
    return ok({ deletedAt: new Date().toISOString() });
  });
}
