import type { FastifyInstance } from 'fastify';
import { runWithContext } from '../src/lib/request-context.js';
import { MockWhatsAppProvider } from '../src/lib/whatsapp/mock-provider.js';
import type { SendDeps } from '../src/lib/whatsapp/send.js';

/** Create an APPROVED, enabled template for a test clinic (tests run against fresh clinics). */
export async function seedTemplate(
  app: FastifyInstance,
  clinicId: string,
  templateKey: string,
  over: Partial<{ body: string; variables: string[]; approvalStatus: string; isEnabled: boolean; estimatedCostPaise: number; category: string }> = {},
): Promise<string> {
  return runWithContext({ clinicId }, async () => {
    const t = await app.prisma.whatsAppTemplate.create({
      data: {
        clinicId,
        templateKey,
        templateName: templateKey,
        category: (over.category as never) ?? 'UTILITY',
        approvalStatus: (over.approvalStatus as never) ?? 'APPROVED',
        body: over.body ?? 'Hi {{1}}, this is {{2}}.',
        variables: over.variables ?? ['patient_name', 'clinic_name'],
        isEnabled: over.isEnabled ?? true,
        estimatedCostPaise: over.estimatedCostPaise ?? 35,
      },
    });
    return t.id;
  });
}

/** Opt a patient in so the consent gate passes. */
export async function optIn(app: FastifyInstance, clinicId: string, patientId: string): Promise<void> {
  await runWithContext({ clinicId }, async () => {
    await app.prisma.patientWhatsAppConsent.upsert({
      where: { clinicId_patientId: { clinicId, patientId } },
      update: { status: 'OPTED_IN', optedInAt: new Date() },
      create: { clinicId, patientId, status: 'OPTED_IN', optedInAt: new Date(), optedInMethod: 'verbal' },
    });
  });
}

/** Set (or clear) a clinic's monthly WhatsApp budget cap. */
export async function setBudget(app: FastifyInstance, clinicId: string, budgetPaise: number | null): Promise<void> {
  await runWithContext({ clinicId }, async () => {
    await app.prisma.clinic.update({ where: { id: clinicId }, data: { whatsappBudgetPaise: budgetPaise } });
  });
}

export interface CapturingDeps extends SendDeps {
  enqueued: string[];
  provider: MockWhatsAppProvider;
}

/** SendDeps wired to the real prisma + a mock provider, capturing every enqueued message id. */
export function makeSendDeps(app: FastifyInstance, opts: { failureRate?: number } = {}): CapturingDeps {
  const enqueued: string[] = [];
  const provider = new MockWhatsAppProvider({ failureRate: opts.failureRate ?? 0 });
  return {
    prisma: app.prisma,
    provider,
    enqueue: async (messageId) => void enqueued.push(messageId),
    audit: async () => undefined,
    enqueued,
  };
}
