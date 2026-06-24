import { z } from 'zod';
import { MediaType, Timestamps } from './common.js';

export const ALLOWED_MEDIA_MIME = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
] as const;
export const MAX_MEDIA_BYTES = 15 * 1024 * 1024;

export const PresignUploadInput = z.object({
  filename: z.string().min(1).max(255),
  mimeType: z.enum(ALLOWED_MEDIA_MIME),
  sizeBytes: z.number().int().min(1).max(MAX_MEDIA_BYTES),
  patientId: z.string().min(1),
});
export type PresignUploadInput = z.infer<typeof PresignUploadInput>;

export const PresignUploadResponse = z.object({
  uploadUrl: z.string().url(),
  storageKey: z.string(),
});
export type PresignUploadResponse = z.infer<typeof PresignUploadResponse>;

export const CreateMediaInput = z.object({
  patientId: z.string().min(1),
  visitId: z.string().min(1).optional(),
  storageKey: z.string().min(1),
  type: MediaType,
  mimeType: z.enum(ALLOWED_MEDIA_MIME),
  sizeBytes: z.number().int().min(1).max(MAX_MEDIA_BYTES),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  thumbnailKey: z.string().optional(),
  /** PHI — encrypted at rest (notesEnc). */
  notes: z.string().max(2000).optional(),
});
export type CreateMediaInput = z.infer<typeof CreateMediaInput>;

export const MediaResponse = z
  .object({
    id: z.string(),
    patientId: z.string(),
    visitId: z.string().nullable(),
    type: MediaType,
    mimeType: z.string(),
    sizeBytes: z.number().int(),
    width: z.number().int().nullable(),
    height: z.number().int().nullable(),
    notes: z.string().nullable(),
    uploadedById: z.string(),
    uploadedAt: z.coerce.date(),
  })
  .merge(Timestamps);
export type MediaResponse = z.infer<typeof MediaResponse>;
