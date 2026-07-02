import type { Prisma } from '@odovox/db';
import type { LabCasePhoto, LabCaseResponse, LabCaseSummary, LabVendorResponse } from '@odovox/types';
import { decryptField } from '../encryption.js';

// Prisma include shapes — keep the joins the serializers depend on in one place.
export const LAB_CASE_SUMMARY_INCLUDE = {
  patient: { select: { name: true } },
  vendor: { select: { name: true } },
} satisfies Prisma.LabCaseInclude;

export const LAB_CASE_DETAIL_INCLUDE = {
  patient: { select: { name: true } },
  vendor: { select: { name: true } },
  photos: {
    where: { deletedAt: null },
    orderBy: { uploadedAt: 'asc' },
    select: { id: true, url: true, thumbnailKey: true, mimeType: true, uploadedAt: true },
  },
  // Phase 9.7 timeline — newest first, capped (a case rarely has more than a dozen events).
  events: { orderBy: { createdAt: 'desc' as const }, take: 50 },
} satisfies Prisma.LabCaseInclude;

type LabCaseSummaryRow = Prisma.LabCaseGetPayload<{ include: typeof LAB_CASE_SUMMARY_INCLUDE }>;
type LabCaseDetailRow = Prisma.LabCaseGetPayload<{ include: typeof LAB_CASE_DETAIL_INCLUDE }>;

export function toLabCaseSummary(row: LabCaseSummaryRow): LabCaseSummary {
  return {
    id: row.id,
    clinicId: row.clinicId,
    caseNumber: row.caseNumber,
    caseCode: row.caseCode,
    patientId: row.patientId,
    patientName: row.patient.name,
    doctorId: row.doctorId,
    vendorId: row.vendorId,
    vendorName: row.vendor?.name ?? null,
    type: row.type,
    teeth: row.teeth,
    material: row.material,
    shade: row.shade,
    status: row.status,
    expectedReturnAt: row.expectedReturnAt,
    createdAt: row.createdAt,
  };
}

export function toLabCaseResponse(row: LabCaseDetailRow): LabCaseResponse {
  const photos: LabCasePhoto[] = row.photos.map((p) => ({
    id: p.id,
    url: p.url,
    thumbnailKey: p.thumbnailKey,
    mimeType: p.mimeType,
    uploadedAt: p.uploadedAt,
  }));
  return {
    ...toLabCaseSummary(row),
    description: row.description,
    impressionTakenAt: row.impressionTakenAt,
    sentAt: row.sentAt,
    returnedAt: row.returnedAt,
    deliveredAt: row.deliveredAt,
    completedAt: row.completedAt,
    rejectionReason: row.rejectionReason,
    costPaise: row.costPaise,
    patientChargePaise: row.patientChargePaise,
    notes: row.notesEnc ? decryptField(row.notesEnc) : null,
    treatmentPlanId: row.treatmentPlanId,
    visitId: row.visitId,
    reworkOfId: row.reworkOfId,
    createdById: row.createdById,
    updatedAt: row.updatedAt,
    photos,
    statusUpdatedAt: row.statusUpdatedAt,
    statusUpdatedBy: row.statusUpdatedBy,
    events: row.events.map((e) => ({
      id: e.id,
      fromStatus: e.fromStatus,
      toStatus: e.toStatus,
      trigger: e.trigger,
      sourceLabMessageId: e.sourceLabMessageId,
      note: e.note,
      byUserId: e.byUserId,
      undoneAt: e.undoneAt,
      createdAt: e.createdAt,
    })),
  };
}

type VendorRow = Prisma.LabVendorGetPayload<object>;

/** Serialize a vendor. Phone/address are decrypted only when `revealContact` is true (audited at call site). */
export function toLabVendorResponse(row: VendorRow, revealContact: boolean): LabVendorResponse {
  return {
    id: row.id,
    clinicId: row.clinicId,
    name: row.name,
    contactPhone: revealContact && row.contactPhoneEnc ? decryptField(row.contactPhoneEnc) : null,
    contactPersonName: row.contactPersonName,
    address: revealContact && row.addressEnc ? decryptField(row.addressEnc) : null,
    email: row.email,
    defaultTurnaroundDays: row.defaultTurnaroundDays,
    specialties: row.specialties,
    notes: row.notes,
    isArchived: row.isArchived,
    createdById: row.createdById,
    whatsappPhoneNumbers: row.whatsappPhoneNumbers,
    preferredLanguage: row.preferredLanguage,
    consentLoggedAt: row.consentLoggedAt,
    automationPaused: row.automationPaused,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
