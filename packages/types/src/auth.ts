import { z } from 'zod';
import { IndianPhone, MemberRole, MemberStatus, Timestamps } from './common.js';

/** Request an OTP for a phone number. */
export const RequestOtpInput = z.object({
  phone: IndianPhone,
});
export type RequestOtpInput = z.infer<typeof RequestOtpInput>;

/** Verify an OTP. */
export const VerifyOtpInput = z.object({
  phone: IndianPhone,
  otp: z.string().regex(/^\d{6}$/, 'OTP must be 6 digits'),
});
export type VerifyOtpInput = z.infer<typeof VerifyOtpInput>;

/** Decoded access-token claims attached to a request. */
export const AuthUser = z.object({
  id: z.string().min(1),
  phone: IndianPhone,
});
export type AuthUser = z.infer<typeof AuthUser>;

/** JWT access-token payload. */
export const AccessTokenPayload = z.object({
  sub: z.string().min(1),
  phone: IndianPhone,
  clinicId: z.string().min(1).optional(),
  role: MemberRole.optional(),
});
export type AccessTokenPayload = z.infer<typeof AccessTokenPayload>;

export const TokenPair = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  expiresIn: z.number().int(),
});
export type TokenPair = z.infer<typeof TokenPair>;

export const UserResponse = z
  .object({
    id: z.string(),
    phone: IndianPhone,
    name: z.string(),
    profilePhotoUrl: z.string().url().nullable(),
    lastLoginAt: z.coerce.date().nullable(),
  })
  .merge(Timestamps);
export type UserResponse = z.infer<typeof UserResponse>;

export const ClinicMemberResponse = z
  .object({
    id: z.string(),
    clinicId: z.string(),
    userId: z.string(),
    role: MemberRole,
    status: MemberStatus,
    qualification: z.string().nullable(),
    registrationNumber: z.string().nullable(),
    specialization: z.string().nullable(),
    joinedAt: z.coerce.date(),
  })
  .merge(Timestamps);
export type ClinicMemberResponse = z.infer<typeof ClinicMemberResponse>;
