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
/**
 * `liveState` is passed in rather than read off the patient: it comes from the patient's
 * open visit / lab cases, which the list query includes. `Patient.status` cannot serve
 * this — nothing writes IN_CHAIR or LAB_PENDING to it, so the ring it fed was always off.
 */
export function toPatientListItem(
  p: Patient,
  liveState: PatientListItem['liveState'] = null,
): PatientListItem {
  return {
    liveState,
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
/**
 * `clinical` decides whether the patient's medical detail leaves the server at all.
 *
 * Owner ruling B1/B4: a receptionist may open a patient record — they need it for billing,
 * scheduling and contact — but must not receive medical flags, allergies or history. The
 * ruling is explicit that this happens at the data boundary, "not by hiding the UI with
 * CSS", so the fields are withheld here rather than filtered in React. A response the
 * client never receives cannot leak through a devtools panel, a cached payload or the next
 * component that happens to read the object.
 *
 * It defaults to FALSE. A new caller that forgets to think about role gets the safe answer.
 */
export function toPatientResponse(p: Patient, clinical = false): PatientResponse {
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
    // Clinical PHI — decrypted only for the roles entitled to read it.
    medicalHistory: clinical ? safeDecrypt(p.medicalHistoryEnc) : null,
    allergies: clinical ? safeDecrypt(p.allergiesEnc) : null,
    chiefComplaint: p.chiefComplaint ?? null,
    medicalFlags: clinical ? p.medicalFlags : [],
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
