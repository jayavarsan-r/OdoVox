import { PrismaClient, Prisma } from '@prisma/client';

export { PrismaClient, Prisma };
export * from '@prisma/client';
export * from './starter-templates.js';

/**
 * Models that carry a direct `clinicId` column. Every read/write to these from a
 * request context MUST be scoped by `clinicId` — enforced by Prisma middleware in
 * `apps/api/src/plugins/prisma.ts`.
 */
export const CLINIC_SCOPED_MODELS = [
  'ClinicMember',
  'Room',
  'Patient',
  'Visit',
  'QueueEvent',
  'Appointment',
  'LabPartner',
  'LabCase',
  'InventoryItem',
  'Notification',
  'ClinicSetting',
  'Media',
  'PrescriptionTemplate',
] as const;

export type ClinicScopedModel = (typeof CLINIC_SCOPED_MODELS)[number];

const clinicScopedSet = new Set<string>(CLINIC_SCOPED_MODELS);

export function isClinicScopedModel(model: string | undefined): model is ClinicScopedModel {
  return model !== undefined && clinicScopedSet.has(model);
}
