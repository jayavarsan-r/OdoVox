import type { FastifyInstance } from 'fastify';
import {
  CreateTemplateInput,
  UpdateTemplateInput,
  TemplateListQuery,
  type TemplateMedicine,
  type TemplateResponse,
} from '@odovox/types';
import type { Prisma, PrescriptionTemplate } from '@odovox/db';
import { ForbiddenError, NotFoundError } from '../lib/errors.js';
import { ok, parse } from '../lib/http.js';
import { requireRole } from '../lib/rbac.js';

function toTemplateResponse(t: PrescriptionTemplate): TemplateResponse {
  return {
    id: t.id,
    clinicId: t.clinicId,
    createdById: t.createdById,
    name: t.name,
    description: t.description,
    isShared: t.isShared,
    isArchived: t.isArchived,
    medicines: (t.medicines as TemplateMedicine[]) ?? [],
    instructions: t.instructions,
    reviewAfterDays: t.reviewAfterDays,
    tags: t.tags,
    usageCount: t.usageCount,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
  };
}

export async function prescriptionTemplateRoutes(fastify: FastifyInstance): Promise<void> {
  const { prisma } = fastify;
  const anyRole = { preHandler: [fastify.authenticate, requireRole('DOCTOR', 'RECEPTIONIST', 'ADMIN')] };
  const doctorOnly = { preHandler: [fastify.authenticate, requireRole('DOCTOR', 'ADMIN')] };

  /** Load a non-deleted template in the caller's clinic (auto clinic-scoped). 404 otherwise. */
  async function loadInClinic(id: string): Promise<PrescriptionTemplate> {
    const t = await prisma.prescriptionTemplate.findFirst({ where: { id } });
    if (!t) throw new NotFoundError('Template not found');
    return t;
  }

  /** Editing/archiving is restricted to the creator or a clinic admin. */
  function assertCanMutate(t: PrescriptionTemplate, userId: string, role: string): void {
    if (role !== 'ADMIN' && t.createdById !== userId) {
      throw new ForbiddenError('Only the template creator or a clinic admin can modify it');
    }
  }

  // GET /prescription-templates — clinic-scoped, non-archived, optional text search.
  fastify.get('/prescription-templates', anyRole, async (req) => {
    const q = parse(TemplateListQuery, req.query);
    const where: Prisma.PrescriptionTemplateWhereInput = { isArchived: false };
    if (q.search) {
      where.OR = [
        { name: { contains: q.search, mode: 'insensitive' } },
        { tags: { has: q.search.toLowerCase() } },
      ];
    }
    const rows = await prisma.prescriptionTemplate.findMany({
      where,
      orderBy: [{ usageCount: 'desc' }, { name: 'asc' }],
    });
    return ok({ items: rows.map(toTemplateResponse) });
  });

  // POST /prescription-templates — create (DOCTOR + ADMIN).
  fastify.post('/prescription-templates', doctorOnly, async (req) => {
    const input = parse(CreateTemplateInput, req.body);
    const created = await prisma.prescriptionTemplate.create({
      data: {
        clinicId: req.clinicId!,
        createdById: req.user!.id,
        name: input.name,
        description: input.description ?? null,
        isShared: input.isShared ?? true,
        medicines: input.medicines as unknown as object,
        instructions: input.instructions ?? null,
        reviewAfterDays: input.reviewAfterDays ?? null,
        tags: input.tags ?? [],
      },
    });
    await fastify.audit('TEMPLATE_CREATED', 'PrescriptionTemplate', created.id, { name: created.name });
    return ok(toTemplateResponse(created));
  });

  // GET /prescription-templates/:id — detail (any role can read).
  fastify.get('/prescription-templates/:id', anyRole, async (req) => {
    const { id } = req.params as { id: string };
    return ok(toTemplateResponse(await loadInClinic(id)));
  });

  // PATCH /prescription-templates/:id — update (creator OR admin).
  fastify.patch('/prescription-templates/:id', doctorOnly, async (req) => {
    const { id } = req.params as { id: string };
    const input = parse(UpdateTemplateInput, req.body);
    const existing = await loadInClinic(id);
    assertCanMutate(existing, req.user!.id, req.role!);

    const updated = await prisma.prescriptionTemplate.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.description !== undefined ? { description: input.description ?? null } : {}),
        ...(input.isShared !== undefined ? { isShared: input.isShared } : {}),
        ...(input.medicines !== undefined ? { medicines: input.medicines as unknown as object } : {}),
        ...(input.instructions !== undefined ? { instructions: input.instructions ?? null } : {}),
        ...(input.reviewAfterDays !== undefined ? { reviewAfterDays: input.reviewAfterDays ?? null } : {}),
        ...(input.tags !== undefined ? { tags: input.tags } : {}),
      },
    });
    await fastify.audit('TEMPLATE_UPDATED', 'PrescriptionTemplate', id, { name: updated.name });
    return ok(toTemplateResponse(updated));
  });

  // DELETE /prescription-templates/:id — archive (soft delete; preserves prescription history).
  fastify.delete('/prescription-templates/:id', doctorOnly, async (req) => {
    const { id } = req.params as { id: string };
    const existing = await loadInClinic(id);
    assertCanMutate(existing, req.user!.id, req.role!);
    await prisma.prescriptionTemplate.update({ where: { id }, data: { isArchived: true } });
    await fastify.audit('TEMPLATE_ARCHIVED', 'PrescriptionTemplate', id, { name: existing.name });
    return ok({ id, isArchived: true });
  });

  // POST /prescription-templates/:id/use — bump usageCount, return the medicines to populate the sheet.
  fastify.post('/prescription-templates/:id/use', doctorOnly, async (req) => {
    const { id } = req.params as { id: string };
    const existing = await loadInClinic(id);
    const updated = await prisma.prescriptionTemplate.update({
      where: { id },
      data: { usageCount: { increment: 1 } },
    });
    await fastify.audit('TEMPLATE_USED', 'PrescriptionTemplate', id, { name: existing.name });
    return ok({
      id: updated.id,
      name: updated.name,
      medicines: (updated.medicines as TemplateMedicine[]) ?? [],
      instructions: updated.instructions,
      reviewAfterDays: updated.reviewAfterDays,
      usageCount: updated.usageCount,
    });
  });
}
