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
    isAdmin: z.boolean(),
    status: MemberStatus,
    qualification: z.string().nullable(),
    // The registration number is encrypted at rest and never returned to clients;
    // we expose only whether one is on file.
    hasRegistrationNumber: z.boolean(),
    specialization: z.string().nullable(),
    joinedAt: z.coerce.date(),
  })
  .merge(Timestamps);
export type ClinicMemberResponse = z.infer<typeof ClinicMemberResponse>;

/** Where the client should send the user after a successful OTP verification. */
export const OnboardingNextStep = z.enum(['ROLE_SELECT', 'HOME']);
export type OnboardingNextStep = z.infer<typeof OnboardingNextStep>;

export const RequestOtpResponse = z.object({
  expiresInSeconds: z.number().int(),
  resendInSeconds: z.number().int(),
});
export type RequestOtpResponse = z.infer<typeof RequestOtpResponse>;

export const VerifyOtpResponse = z.object({
  accessToken: z.string(),
  expiresIn: z.number().int(),
  user: z.object({
    id: z.string(),
    phone: IndianPhone,
    name: z.string().nullable(),
  }),
  activeMembership: ClinicMemberResponse.nullable(),
  nextStep: OnboardingNextStep,
});
export type VerifyOtpResponse = z.infer<typeof VerifyOtpResponse>;
