import type { ExtendedPrismaClient } from '../../plugins/prisma.js';

/** Prisma transaction-or-client — the consent gate runs both standalone and inside send transactions. */
type Db = ExtendedPrismaClient | Parameters<Parameters<ExtendedPrismaClient['$transaction']>[0]>[0];

export type ConsentBlockReason = 'NOT_ASKED' | 'PENDING' | 'OPTED_OUT' | 'EXPIRED';

export interface ConsentCheck {
  canSend: boolean;
  reason?: ConsentBlockReason;
}

/** Consent TTL — DPDP best practice re-consent window. */
export const CONSENT_TTL_MONTHS = 12;
const MONTH_MS = 1000 * 60 * 60 * 24 * 30;

/**
 * The single gate every WhatsApp send passes through. No message is sent unless the patient is
 * actively OPTED_IN and the consent hasn't aged past the 12-month TTL. Pure enough to unit-test.
 */
export async function checkConsent(prisma: Db, clinicId: string, patientId: string): Promise<ConsentCheck> {
  const consent = await prisma.patientWhatsAppConsent.findUnique({
    where: { clinicId_patientId: { clinicId, patientId } },
  });

  if (!consent) return { canSend: false, reason: 'NOT_ASKED' };
  if (consent.status === 'OPTED_OUT') return { canSend: false, reason: 'OPTED_OUT' };
  if (consent.status !== 'OPTED_IN') return { canSend: false, reason: consent.status as ConsentBlockReason };

  const lastConfirmed = consent.lastReconfirmedAt ?? consent.optedInAt;
  if (lastConfirmed) {
    const ageMonths = (Date.now() - lastConfirmed.getTime()) / MONTH_MS;
    if (ageMonths > CONSENT_TTL_MONTHS) return { canSend: false, reason: 'EXPIRED' };
  }

  return { canSend: true };
}
