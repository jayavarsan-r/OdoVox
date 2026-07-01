import type { FastifyInstance } from 'fastify';
import { WhatsAppBudgetInput, TemplateToggleInput } from '@odovox/types';
import { NotFoundError } from '../lib/errors.js';
import { ok, parse } from '../lib/http.js';
import { requireAdmin } from '../lib/rbac.js';
import { loadEnv } from '../lib/env.js';
import { monthSpendPaise } from '../lib/whatsapp/send.js';
import { startOfMonth } from '../lib/whatsapp/render.js';

export async function whatsappSettingsRoutes(fastify: FastifyInstance): Promise<void> {
  const { prisma } = fastify;
  const adminOnly = { preHandler: [fastify.authenticate, requireAdmin()] };

  // GET /clinic/whatsapp — account + templates (with usage) + budget + spend + 6-month cost history.
  fastify.get('/clinic/whatsapp', adminOnly, async (req) => {
    const clinicId = req.clinicId!;
    const clinic = await prisma.clinic.findUniqueOrThrow({ where: { id: clinicId } });
    const templates = await prisma.whatsAppTemplate.findMany({ where: { clinicId }, orderBy: { templateKey: 'asc' } });

    const monthStart = startOfMonth();
    const templatesWithUsage = await Promise.all(
      templates.map(async (t) => {
        const sentThisMonth = await prisma.whatsAppMessage.count({
          where: { clinicId, templateId: t.id, status: { in: ['SENT', 'DELIVERED', 'READ'] }, createdAt: { gte: monthStart } },
        });
        const last = await prisma.whatsAppMessage.findFirst({
          where: { clinicId, templateId: t.id, status: { in: ['SENT', 'DELIVERED', 'READ'] } },
          orderBy: { createdAt: 'desc' },
          select: { sentAt: true, createdAt: true },
        });
        return {
          id: t.id,
          templateKey: t.templateKey,
          templateName: t.templateName,
          language: t.language,
          category: t.category,
          approvalStatus: t.approvalStatus,
          body: t.body,
          variables: t.variables,
          isEnabled: t.isEnabled,
          estimatedCostPaise: t.estimatedCostPaise,
          sentThisMonth,
          lastSentAt: last?.sentAt ?? last?.createdAt ?? null,
        };
      }),
    );

    const costLogs = await prisma.whatsAppCostLog.findMany({
      where: { clinicId },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
      take: 6,
    });

    return ok({
      accountStatus: clinic.whatsappAccountStatus,
      accountPhoneNumber: clinic.whatsappAccountPhoneNumber,
      provider: loadEnv().WHATSAPP_PROVIDER,
      budgetPaise: clinic.whatsappBudgetPaise,
      warningThreshold: Number(clinic.whatsappBudgetWarningThreshold),
      spentThisMonthPaise: await monthSpendPaise(prisma, clinicId),
      templates: templatesWithUsage,
      costHistory: costLogs
        .map((c) => ({ year: c.year, month: c.month, conversationsCount: c.conversationsCount, totalCostPaise: c.totalCostPaise }))
        .reverse(),
    });
  });

  // PATCH /clinic/whatsapp/budget — set the monthly cap (null = unlimited) + warning threshold.
  fastify.patch('/clinic/whatsapp/budget', adminOnly, async (req) => {
    const clinicId = req.clinicId!;
    const body = parse(WhatsAppBudgetInput, req.body);
    await prisma.clinic.update({
      where: { id: clinicId },
      data: {
        whatsappBudgetPaise: body.budgetPaise,
        ...(body.warningThreshold !== undefined ? { whatsappBudgetWarningThreshold: body.warningThreshold } : {}),
      },
    });
    await fastify.audit('WHATSAPP_BUDGET_UPDATED', 'Clinic', clinicId, { budgetPaise: body.budgetPaise });
    return ok({ budgetPaise: body.budgetPaise });
  });

  // PATCH /clinic/whatsapp/templates/:key — enable/disable a template clinic-wide.
  fastify.patch('/clinic/whatsapp/templates/:key', adminOnly, async (req) => {
    const clinicId = req.clinicId!;
    const { key } = req.params as { key: string };
    const body = parse(TemplateToggleInput, req.body);
    const template = await prisma.whatsAppTemplate.findUnique({ where: { clinicId_templateKey: { clinicId, templateKey: key } } });
    if (!template) throw new NotFoundError('Template not found');
    await prisma.whatsAppTemplate.update({ where: { id: template.id }, data: { isEnabled: body.isEnabled } });
    await fastify.audit('WHATSAPP_TEMPLATE_TOGGLED', 'WhatsAppTemplate', template.id, { templateKey: key, isEnabled: body.isEnabled });
    return ok({ templateKey: key, isEnabled: body.isEnabled });
  });
}
