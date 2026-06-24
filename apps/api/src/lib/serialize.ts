import type { Clinic, ClinicMember, Consultation, Patient, Media } from '@odovox/db';
import type {
  ClinicMemberResponse,
  ClinicResponse,
  MediaResponse,
  PatientListItem,
  PatientResponse,
} from '@odovox/types';
import { decryptField } from './encryption.js';

function safeDecrypt(value: string | null): string | null {
  if (!value) return null;
  try {
    return decryptField(value);
  } catch {
    return null;
  }
}

/** Map a ClinicMember row to its client response, never leaking the encrypted reg number. */
export function toMemberResponse(m: ClinicMember): ClinicMemberResponse {
  return {
    id: m.id,
    clinicId: m.clinicId,
    userId: m.userId,
    role: m.role,
    isAdmin: m.isAdmin,
    status: m.status,
    qualification: m.qualification ?? null,
    hasRegistrationNumber: m.registrationNumberEnc !== null,
    specialization: m.specialization ?? null,
    joinedAt: m.joinedAt,
    createdAt: m.createdAt,
    updatedAt: m.updatedAt,
    deletedAt: m.deletedAt ?? null,
  };
}

export function toClinicResponse(c: Clinic): ClinicResponse {
  return {
    id: c.id,
    name: c.name,
    joinCode: c.joinCode,
    city: c.city,
    state: c.state,
    addressLine: c.addressLine,
    pincode: c.pincode,
    contactPhone: c.contactPhone,
  };
}

/** List row — never decrypts PHI. */
export function toPatientListItem(p: Patient): PatientListItem {
  return {
    id: p.id,
    patientCode: p.patientCode,
    name: p.name,
    phone: p.phone,
    age: p.age,
    gender: p.gender,
    status: p.status,
    chiefComplaint: p.chiefComplaint ?? null,
    medicalFlags: p.medicalFlags,
    outstandingPaise: p.outstandingPaise,
    lastVisitAt: p.lastVisitAt ?? null,
  };
}

/** Full detail — decrypts PHI fields for an authorized read. */
export function toPatientResponse(p: Patient): PatientResponse {
  return {
    id: p.id,
    clinicId: p.clinicId,
    patientCode: p.patientCode,
    name: p.name,
    phone: p.phone,
    age: p.age,
    gender: p.gender,
    bloodGroup: (p.bloodGroup as PatientResponse['bloodGroup']) ?? null,
    address: safeDecrypt(p.addressEnc),
    medicalHistory: safeDecrypt(p.medicalHistoryEnc),
    allergies: safeDecrypt(p.allergiesEnc),
    chiefComplaint: p.chiefComplaint ?? null,
    medicalFlags: p.medicalFlags,
    status: p.status,
    outstandingPaise: p.outstandingPaise,
    lastVisitAt: p.lastVisitAt ?? null,
    createdById: p.createdById,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    deletedAt: p.deletedAt ?? null,
  };
}

/**
 * Consultation response. NEVER includes `rawTranscriptEnc` (the ciphertext column). The decrypted
 * transcript is included ONLY when `includeTranscript` is true (doctor/admin) — a receptionist sees
 * status + structured data but never the transcript. Strip happens here, at the serializer.
 */
export function toConsultationResponse(c: Consultation, opts: { includeTranscript: boolean }) {
  return {
    id: c.id,
    visitId: c.visitId,
    status: c.status,
    structuredData: c.structuredData,
    safetyWarnings: c.safetyWarnings,
    languageCode: c.languageCode ?? null,
    audioDurationMs: c.audioDurationMs ?? null,
    provider: c.provider ?? null,
    sttLatencyMs: c.sttLatencyMs ?? null,
    extractionLatencyMs: c.extractionLatencyMs ?? null,
    confirmedById: c.confirmedById ?? null,
    confirmedAt: c.confirmedAt ?? null,
    rejectedById: c.rejectedById ?? null,
    rejectedReason: c.rejectedReason ?? null,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
    ...(opts.includeTranscript ? { transcript: safeDecrypt(c.rawTranscriptEnc) } : {}),
  };
}

export function toMediaResponse(m: Media): MediaResponse {
  return {
    id: m.id,
    patientId: m.patientId,
    visitId: m.visitId ?? null,
    type: m.type,
    mimeType: m.mimeType,
    sizeBytes: m.sizeBytes,
    width: m.width ?? null,
    height: m.height ?? null,
    notes: safeDecrypt(m.notesEnc),
    uploadedById: m.uploadedById,
    uploadedAt: m.uploadedAt,
    createdAt: m.createdAt,
    updatedAt: m.updatedAt,
    deletedAt: m.deletedAt ?? null,
  };
}
