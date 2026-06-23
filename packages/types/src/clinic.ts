import { z } from 'zod';
import { Gstin, IndianPhone, MemberRole, Pincode } from './common.js';

/** HH:mm 24-hour clock string. */
export const TimeOfDay = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Must be a HH:mm time');

/** Indian states & union territories — used by the clinic-create state dropdown. */
export const INDIAN_STATES = [
  'Andhra Pradesh',
  'Arunachal Pradesh',
  'Assam',
  'Bihar',
  'Chhattisgarh',
  'Goa',
  'Gujarat',
  'Haryana',
  'Himachal Pradesh',
  'Jharkhand',
  'Karnataka',
  'Kerala',
  'Madhya Pradesh',
  'Maharashtra',
  'Manipur',
  'Meghalaya',
  'Mizoram',
  'Nagaland',
  'Odisha',
  'Punjab',
  'Rajasthan',
  'Sikkim',
  'Tamil Nadu',
  'Telangana',
  'Tripura',
  'Uttar Pradesh',
  'Uttarakhand',
  'West Bengal',
  'Andaman and Nicobar Islands',
  'Chandigarh',
  'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi',
  'Jammu and Kashmir',
  'Ladakh',
  'Lakshadweep',
  'Puducherry',
] as const;

export const RoomInput = z.object({
  name: z.string().min(1).max(40),
  number: z.string().max(20).optional(),
});
export type RoomInput = z.infer<typeof RoomInput>;

/** Doctor profile captured on the caller's own membership. */
export const DoctorProfileInput = z.object({
  qualification: z.string().min(2, 'Qualification is required').max(80),
  registrationNumber: z
    .string()
    .min(3, 'Registration number is required')
    .max(60),
  specialization: z.array(z.string().min(1)).max(12).optional(),
});
export type DoctorProfileInput = z.infer<typeof DoctorProfileInput>;

export const ClinicCreateInput = z.object({
  // Section 1 — basics
  name: z.string().min(2, 'Clinic name is too short').max(80),
  addressLine: z.string().min(5, 'Address is too short').max(200),
  city: z.string().min(2).max(60),
  state: z.string().min(2).max(60),
  pincode: Pincode,
  contactPhone: IndianPhone,
  gstNumber: Gstin.optional().or(z.literal('')).transform((v) => v || undefined),

  // Section 2 — hours
  openingTime: TimeOfDay,
  closingTime: TimeOfDay,
  lunchStart: TimeOfDay.optional(),
  lunchEnd: TimeOfDay.optional(),
  weeklyOffDays: z.array(z.number().int().min(0).max(6)).max(7),

  // Section 3 — rooms
  chairsCount: z.number().int().min(1).max(20),
  rooms: z.array(RoomInput).max(20).optional(),

  // Section 4 — doctor profile (the creator becomes ADMIN + DOCTOR)
  doctorName: z.string().min(2, 'Your name is required').max(80),
  qualification: DoctorProfileInput.shape.qualification,
  registrationNumber: DoctorProfileInput.shape.registrationNumber,
  specialization: DoctorProfileInput.shape.specialization,
});
export type ClinicCreateInput = z.infer<typeof ClinicCreateInput>;

export const ClinicJoinInput = z
  .object({
    joinCode: z
      .string()
      .trim()
      .min(4, 'Enter the join code')
      .max(12)
      .transform((s) => s.toUpperCase()),
    name: z.string().min(2, 'Your name is required').max(80),
    role: MemberRole.exclude(['ADMIN']),
    qualification: z.string().max(80).optional(),
    registrationNumber: z.string().max(60).optional(),
    specialization: z.array(z.string().min(1)).max(12).optional(),
  })
  .refine(
    (v) =>
      v.role !== 'DOCTOR' ||
      (!!v.qualification && v.qualification.length >= 2 && !!v.registrationNumber && v.registrationNumber.length >= 3),
    {
      message: 'Doctors must provide a qualification and registration number',
      path: ['qualification'],
    },
  );
export type ClinicJoinInput = z.infer<typeof ClinicJoinInput>;

export const ClinicLookupResponse = z.object({
  name: z.string(),
  city: z.string(),
  state: z.string(),
});
export type ClinicLookupResponse = z.infer<typeof ClinicLookupResponse>;

export const ClinicResponse = z.object({
  id: z.string(),
  name: z.string(),
  joinCode: z.string(),
  city: z.string(),
  state: z.string(),
  addressLine: z.string(),
  pincode: z.string(),
  contactPhone: z.string(),
});
export type ClinicResponse = z.infer<typeof ClinicResponse>;
