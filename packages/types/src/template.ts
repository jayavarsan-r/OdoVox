import { z } from 'zod';
import { Timestamps } from './common.js';

/**
 * Prescription templates (Phase 5) — clinic-level reusable medicine bundles. A medicine row is
 * intentionally looser than the dictation `ExtractedPrescription`: durations can be absent (SOS),
 * and frequency is a free string so mouthwash/MW conventions survive.
 */
export const TemplateMedicine = z.object({
  name: z.string().min(1),
  dosage: z.string().min(1),
  frequency: z.string().min(1),
  durationDays: z.number().int().min(1).nullable().default(null),
  instructions: z.string().optional(),
});
export type TemplateMedicine = z.infer<typeof TemplateMedicine>;

export const CreateTemplateInput = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional(),
  isShared: z.boolean().optional(),
  medicines: z.array(TemplateMedicine).min(1),
  instructions: z.string().max(2000).optional(),
  reviewAfterDays: z.number().int().min(0).nullable().optional(),
  tags: z.array(z.string().min(1).max(40)).max(20).optional(),
});
export type CreateTemplateInput = z.infer<typeof CreateTemplateInput>;

export const UpdateTemplateInput = CreateTemplateInput.partial();
export type UpdateTemplateInput = z.infer<typeof UpdateTemplateInput>;

export const TemplateListQuery = z.object({
  search: z.string().max(120).optional(),
});
export type TemplateListQuery = z.infer<typeof TemplateListQuery>;

export const TemplateResponse = z
  .object({
    id: z.string(),
    clinicId: z.string(),
    createdById: z.string(),
    name: z.string(),
    description: z.string().nullable(),
    isShared: z.boolean(),
    isArchived: z.boolean(),
    medicines: z.array(TemplateMedicine),
    instructions: z.string().nullable(),
    reviewAfterDays: z.number().int().nullable(),
    tags: z.array(z.string()),
    usageCount: z.number().int(),
  })
  .merge(Timestamps);
export type TemplateResponse = z.infer<typeof TemplateResponse>;
