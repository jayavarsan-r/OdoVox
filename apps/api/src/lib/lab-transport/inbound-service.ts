import { nanoid } from 'nanoid';
import type { LabVendor } from '@odovox/db';
import type { LabCaseStatus } from '@odovox/types';
import type { ExtendedPrismaClient } from '../../plugins/prisma.js';
import { storage } from '../storage.js';
import { broadcastToClinic } from '../realtime/broadcast.js';
import { transitionLabCase } from '../lab/transition-service.js';
import { OPEN_LAB_STATUSES } from '../lab/transitions.js';
import { LAB_CASE_SUMMARY_INCLUDE, toLabCaseSummary } from '../lab/serialize.js';
import type { InboundEvent } from '../whatsapp/provider.js';
import { parseButtonPayload } from './adapters.js';
import { sendLabTemplate } from './send-service.js';
import { extractCaseCode, matchConsentReply, matchStatusKeyword } from './keywords.js';

/**
 * Phase 9.7 §2.9 — the four-tier lab parser, tiers 1–2 (sub-stage 2.B). Each inbound lab message
 * becomes a LabMessage row (idempotent on waMessageId), then the tiers try to resolve
 * {caseId, newStatus}:
 *   Tier 1 — structured button payload (deterministic, ~70%)
 *   Tier 2 — case code + one clear keyword (en/ta/hi, ~15%)
 * Unresolved rows keep resolved=false — tier 3 (LLM) and tier 4 (reception inbox) pick them up
 * in sub-stage 2.C. Media auto-attaches when the case is unambiguous (§2.9.1).
 */

export interface LabInboundResult {
  outcome: 'transitioned' | 'consent' | 'unresolved' | 'duplicate';
  labMessageId?: string;
  caseId?: string;
  newStatus?: LabCaseStatus;
  parseTier?: 'button' | 'case_code';
}

/** Download inbound media into our bucket. `mock://` URLs short-circuit (hermetic tests). */
async function persistInboundMedia(clinicId: string, mediaUrl: string): Promise<string | null> {
  try {
    const key = `clinics/${clinicId}/lab-inbound/${nanoid()}.jpg`;
    if (mediaUrl.startsWith('mock://')) {
      await storage.putObject(key, Buffer.from(`mock-media:${mediaUrl}`), 'image/jpeg');
      return key;
    }
    const res = await fetch(mediaUrl);
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    await storage.putObject(key, buf, res.headers.get('content-type') ?? 'image/jpeg');
    return key;
  } catch {
    return null;
  }
}

export async function processLabInbound(
  prisma: ExtendedPrismaClient,
  args: { vendor: LabVendor; event: InboundEvent },
): Promise<LabInboundResult> {
  const { vendor, event } = args;
  const clinicId = vendor.clinicId;
  const waMessageId = event.providerMessageId ?? `wamid_${nanoid()}`;

  // Duplicate webhook → the earlier row already handled it.
  const existing = await prisma.labMessage.findFirst({ where: { clinicId, waMessageId } });
  if (existing) return { outcome: 'duplicate', labMessageId: existing.id };

  const text = event.text ?? '';
  const button = event.type === 'button_reply' ? parseButtonPayload(event.buttonId) : null;

  // Inbound media → our bucket; attachment decided below.
  const mediaPaths: string[] = [];
  if (event.mediaUrl) {
    const key = await persistInboundMedia(clinicId, event.mediaUrl);
    if (key) mediaPaths.push(key);
  }

  const message = await prisma.labMessage.create({
    data: {
      clinicId,
      labVendorId: vendor.id,
      direction: 'INBOUND',
      waMessageId,
      body: text || null,
      mediaPaths,
      fromPhone: event.fromPhone,
      buttonPayload: button ? (button as object) : undefined,
      createdAt: event.timestamp ?? new Date(),
    },
  });

  const finalize = async (
    caseId: string,
    to: LabCaseStatus,
    tier: 'button' | 'case_code',
  ): Promise<LabInboundResult> => {
    const trigger = tier === 'button' ? ('lab_button' as const) : ('lab_text' as const);
    const { labCase } = await transitionLabCase(prisma, {
      clinicId,
      caseId,
      to,
      trigger,
      note: tier === 'case_code' ? text.slice(0, 300) : null,
      sourceLabMessageId: message.id,
    });
    await prisma.labMessage.update({
      where: { id: message.id },
      data: { labCaseId: caseId, parseTier: tier, parseConfidence: 1, resolved: true },
    });
    await attachMediaToCase(prisma, { clinicId, caseId, message: { id: message.id, mediaPaths } });
    if (to === 'READY') {
      // T3 — dispatch confirm fires when the lab reports READY (automated, pause-gated).
      await sendLabTemplate(prisma, { clinicId, vendorId: vendor.id, caseId, templateKey: 'lab_t3_dispatch', automated: true, throwOnBlock: false });
    }
    const full = await prisma.labCase.findFirstOrThrow({ where: { id: caseId, clinicId }, include: LAB_CASE_SUMMARY_INCLUDE });
    broadcastToClinic(clinicId, { type: 'lab.case.updated', payload: toLabCaseSummary(full) });
    void labCase;
    return { outcome: 'transitioned', labMessageId: message.id, caseId, newStatus: to, parseTier: tier };
  };

  // ── Consent replies (button or YES/NO text) — §2.11 step 4. ────────────────
  const consentAnswer = button?.action === 'consent' ? (button.value === 'yes' ? 'yes' : 'no') : matchConsentReply(text);
  if (!vendor.consentLoggedAt && consentAnswer) {
    if (consentAnswer === 'yes') {
      await prisma.labVendor.update({ where: { id: vendor.id }, data: { consentLoggedAt: new Date() } });
    } else {
      await prisma.labVendor.update({ where: { id: vendor.id }, data: { automationPaused: true } });
    }
    await prisma.labMessage.update({
      where: { id: message.id },
      data: { parseTier: button ? 'button' : 'case_code', resolved: true },
    });
    return { outcome: 'consent', labMessageId: message.id };
  }

  // ── Tier 1 — structured status button. ──────────────────────────────────────
  if (button?.action === 'status' && button.caseId && button.to) {
    const target = await prisma.labCase.findFirst({ where: { id: button.caseId, clinicId } });
    if (target) return finalize(target.id, button.to as LabCaseStatus, 'button');
  }

  // ── Tier 2 — case code + one clear keyword. ────────────────────────────────
  const caseCode = extractCaseCode(text);
  const keyword = matchStatusKeyword(text);
  if (caseCode && keyword) {
    const target = await prisma.labCase.findFirst({ where: { clinicId, caseCode } });
    if (target) return finalize(target.id, keyword.status, 'case_code');
  }

  // ── Unresolved → tiers 3/4. Media may still auto-attach when unambiguous. ──
  const attached = await autoAttachByContext(prisma, { clinicId, vendorId: vendor.id, messageId: message.id, caseCode, mediaPaths });
  return { outcome: 'unresolved', labMessageId: message.id, caseId: attached ?? undefined };
}

/**
 * §2.9.1 — media auto-attach: case code in the caption, OR the sender lab has exactly ONE open
 * case with this clinic. Otherwise the media waits on the LabMessage for reception.
 */
async function autoAttachByContext(
  prisma: ExtendedPrismaClient,
  args: { clinicId: string; vendorId: string; messageId: string; caseCode: string | null; mediaPaths: string[] },
): Promise<string | null> {
  if (args.mediaPaths.length === 0) return null;
  let caseId: string | null = null;
  if (args.caseCode) {
    const byCode = await prisma.labCase.findFirst({ where: { clinicId: args.clinicId, caseCode: args.caseCode } });
    caseId = byCode?.id ?? null;
  }
  if (!caseId) {
    const open = await prisma.labCase.findMany({
      where: { clinicId: args.clinicId, vendorId: args.vendorId, status: { in: OPEN_LAB_STATUSES } },
      select: { id: true },
      take: 2,
    });
    if (open.length === 1) caseId = open[0]!.id;
  }
  if (!caseId) return null;
  await prisma.labMessage.update({ where: { id: args.messageId }, data: { labCaseId: caseId } });
  await attachMediaToCase(prisma, { clinicId: args.clinicId, caseId, message: { id: args.messageId, mediaPaths: args.mediaPaths } });
  return caseId;
}

/** Turn a message's stored media into Media rows on the case (source=lab_whatsapp). */
async function attachMediaToCase(
  prisma: ExtendedPrismaClient,
  args: { clinicId: string; caseId: string; message: { id: string; mediaPaths: string[] } },
): Promise<void> {
  if (args.message.mediaPaths.length === 0) return;
  const labCase = await prisma.labCase.findFirst({ where: { id: args.caseId, clinicId: args.clinicId } });
  if (!labCase) return;
  for (const storageKey of args.message.mediaPaths) {
    const already = await prisma.media.findFirst({ where: { clinicId: args.clinicId, storageKey } });
    if (already) continue;
    await prisma.media.create({
      data: {
        clinicId: args.clinicId,
        patientId: labCase.patientId,
        labCaseId: labCase.id,
        type: 'LAB_PHOTO',
        source: 'lab_whatsapp',
        storageKey,
        mimeType: 'image/jpeg',
        sizeBytes: 0,
        uploadedById: labCase.createdById,
      },
    });
  }
}
