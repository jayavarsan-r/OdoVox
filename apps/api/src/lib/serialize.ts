import type { Clinic, ClinicMember } from '@odovox/db';
import type { ClinicMemberResponse, ClinicResponse } from '@odovox/types';

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
