import type { LabMessage } from '@odovox/db';
import type { ExtendedPrismaClient } from '../../plugins/prisma.js';
import { NotFoundError, UnprocessableError } from '../errors.js';
import { decryptField } from '../encryption.js';
import { normalizeIndianPhone } from '../whatsapp/render.js';
import { getLabTransport } from './adapters.js';
import { renderLabTemplate, type LabTemplateVars } from './templates.js';
import type { LabTemplateKey } from './types.js';

/**
 * Phase 9.7 — outbound lab sends. Hard gates (§2.10/§2.11): no consent → no send, ever;
 * automationPaused blocks AUTOMATED sends but not explicit manual ones. Every send is logged as an
 * OUTBOUND LabMessage carrying the template key + cost — that row is the cost ledger and the
 * timeline source link.
 */

export type LabSendBlockReason = 'NO_CONSENT' | 'NO_WHATSAPP_NUMBER' | 'AUTOMATION_PAUSED';

export interface SendLabTemplateArgs {
  clinicId: string;
  vendorId: string;
  caseId?: string | null;
  templateKey: LabTemplateKey;
  /** Automated sends (timeouts, transition side effects) respect automationPaused; manual ones don't. */
  automated: boolean;
  /** Throw instead of silently skipping (manual "Send to lab" should explain itself). */
  throwOnBlock?: boolean;
}

export interface SendLabTemplateResult {
  sent: boolean;
  blockReason?: LabSendBlockReason;
  message?: LabMessage;
}

const initials = (name: string): string =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0]!.toUpperCase())
    .join('');

const fmtDate = (d: Date | null): string =>
  d ? d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' }) : '—';

export async function sendLabTemplate(prisma: ExtendedPrismaClient, args: SendLabTemplateArgs): Promise<SendLabTemplateResult> {
  const vendor = await prisma.labVendor.findFirst({ where: { id: args.vendorId, clinicId: args.clinicId } });
  if (!vendor) throw new NotFoundError('Lab vendor not found');

  const block = (blockReason: LabSendBlockReason): SendLabTemplateResult => {
    if (args.throwOnBlock) {
      const msg =
        blockReason === 'NO_CONSENT'
          ? 'This lab hasn’t opted in to WhatsApp. Confirm consent first.'
          : blockReason === 'NO_WHATSAPP_NUMBER'
            ? 'This lab has no WhatsApp number saved.'
            : 'Automation is paused for this lab.';
      throw new UnprocessableError(msg, `LAB_SEND_${blockReason}`);
    }
    return { sent: false, blockReason };
  };

  // T-consent is the one template allowed BEFORE consent (it asks for it).
  if (args.templateKey !== 'lab_t_consent' && !vendor.consentLoggedAt) return block('NO_CONSENT');
  if (args.automated && vendor.automationPaused) return block('AUTOMATION_PAUSED');
  const destination = vendor.whatsappPhoneNumbers[0] ?? normalizeIndianPhone(decryptField(vendor.contactPhoneEnc) ?? '') ?? null;
  if (!destination) return block('NO_WHATSAPP_NUMBER');

  const labCase = args.caseId
    ? await prisma.labCase.findFirst({ where: { id: args.caseId, clinicId: args.clinicId }, include: { patient: { select: { name: true } }, photos: { where: { deletedAt: null }, select: { id: true }, take: 1 } } })
    : null;
  const clinic = await prisma.clinic.findUniqueOrThrow({ where: { id: args.clinicId }, select: { name: true } });

  const vars: LabTemplateVars = {
    clinicName: clinic.name,
    caseCode: labCase?.caseCode ?? '—',
    caseType: labCase?.type.replaceAll('_', ' ').toLowerCase() ?? '—',
    teeth: labCase?.teeth.join(', ') ?? '—',
    shade: labCase?.shade ?? '—',
    patientInitials: labCase ? initials(labCase.patient.name) : '—',
    expectedDate: fmtDate(labCase?.expectedReturnAt ?? null),
    instructions: labCase?.description ?? '—',
    hasPhotos: (labCase?.photos.length ?? 0) > 0,
  };
  const { body, buttons } = renderLabTemplate(args.templateKey, vendor.preferredLanguage, vars, labCase?.id ?? '');

  const result = await getLabTransport().sendCaseTemplate({
    destination,
    vendorName: vendor.name,
    templateKey: args.templateKey,
    language: vendor.preferredLanguage,
    body,
    buttons,
  });

  // waMessageId is the INBOUND dedupe key; outbound rows get a suffix so the deterministic mock
  // provider (same body → same id, by design) can never trip the unique constraint on re-sends.
  const message = await prisma.labMessage.create({
    data: {
      clinicId: args.clinicId,
      labVendorId: vendor.id,
      labCaseId: labCase?.id ?? null,
      direction: 'OUTBOUND',
      waMessageId: `${result.providerMessageId}#${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      body,
      templateKey: args.templateKey,
      costPaise: result.costPaise,
      resolved: true, // outbound rows never need reception action
    },
  });
  return { sent: true, message };
}
