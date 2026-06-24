import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { PresignUploadInput, CreateMediaInput } from '@odovox/types';
import { NotFoundError } from '../lib/errors.js';
import { ok, parse } from '../lib/http.js';
import { encryptField } from '../lib/encryption.js';
import { requireRole } from '../lib/rbac.js';
import { storage, extForMime } from '../lib/storage.js';
import { toMediaResponse } from '../lib/serialize.js';

const ListQuery = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(60).default(30),
});

export async function mediaRoutes(fastify: FastifyInstance): Promise<void> {
  const { prisma } = fastify;
  const anyRole = { preHandler: [fastify.authenticate, requireRole('DOCTOR', 'RECEPTIONIST', 'ADMIN')] };

  const assertPatient = async (id: string) => {
    const p = await prisma.patient.findFirst({ where: { id, deletedAt: null } });
    if (!p) throw new NotFoundError('Patient not found');
    return p;
  };

  // List a patient's media (newest first, cursor pagination).
  fastify.get('/patients/:id/media', anyRole, async (req) => {
    const { id } = req.params as { id: string };
    await assertPatient(id);
    const q = parse(ListQuery, req.query);
    const rows = await prisma.media.findMany({
      where: { patientId: id, deletedAt: null },
      orderBy: { uploadedAt: 'desc' },
      take: q.limit + 1,
      ...(q.cursor ? { cursor: { id: q.cursor }, skip: 1 } : {}),
    });
    const hasMore = rows.length > q.limit;
    const items = rows.slice(0, q.limit).map(toMediaResponse);
    return ok({ items, nextCursor: hasMore ? items[items.length - 1]!.id : null });
  });

  // Presigned direct-to-storage upload URL.
  fastify.post('/media/presign', anyRole, async (req) => {
    const input = parse(PresignUploadInput, req.body);
    await assertPatient(input.patientId);
    const key = `clinics/${req.clinicId}/patients/${input.patientId}/${nanoid()}.${extForMime(input.mimeType)}`;
    const uploadUrl = await storage.presignUpload(key, input.mimeType, 300);
    return ok({ uploadUrl, storageKey: key });
  });

  // Create the Media row after the browser PUTs the file.
  fastify.post('/media', anyRole, async (req) => {
    const input = parse(CreateMediaInput, req.body);
    await assertPatient(input.patientId);
    const media = await prisma.media.create({
      data: {
        clinicId: req.clinicId!,
        patientId: input.patientId,
        visitId: input.visitId ?? null,
        type: input.type,
        storageKey: input.storageKey,
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes,
        width: input.width ?? null,
        height: input.height ?? null,
        thumbnailKey: input.thumbnailKey ?? null,
        notesEnc: input.notes ? encryptField(input.notes) : null,
        uploadedById: req.user!.id,
      },
    });
    await fastify.audit('MEDIA_CREATED', 'Media', media.id, { type: input.type });
    return ok(toMediaResponse(media));
  });

  // Fresh signed GET URL (regenerated each call, 5-min TTL).
  fastify.get('/media/:id/url', anyRole, async (req) => {
    const { id } = req.params as { id: string };
    const media = await prisma.media.findFirst({ where: { id, deletedAt: null } });
    if (!media) throw new NotFoundError('Media not found');
    const url = await storage.getSignedUrl(media.storageKey, 300);
    return ok({ url, type: media.type, mimeType: media.mimeType });
  });

  // Soft delete + remove the object from storage.
  fastify.delete('/media/:id', anyRole, async (req) => {
    const { id } = req.params as { id: string };
    const media = await prisma.media.findFirst({ where: { id, deletedAt: null } });
    if (!media) throw new NotFoundError('Media not found');
    await prisma.media.update({ where: { id }, data: { deletedAt: new Date() } });
    await storage.deleteObject(media.storageKey).catch(() => undefined);
    await fastify.audit('MEDIA_DELETED', 'Media', id);
    return ok({ deletedAt: new Date().toISOString() });
  });
}
