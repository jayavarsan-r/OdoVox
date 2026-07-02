/**
 * Phase 9.7 §2.4 — human case codes: `{prefix}-{seq:0000}` (DK-0042). Short enough for a lab tech
 * to type back, unique per clinic, present in EVERY message about a case — the threading key,
 * because one lab serves many clinics and chat context cannot be trusted.
 */

// Structural minimum (same pattern as case-number.ts) — works with both the extended Prisma
// client and its transaction client, whose nominal types diverge under client extensions.
interface CaseCodeTx {
  clinic: {
    update(args: {
      where: { id: string };
      data: { labCaseSeq?: { increment: number }; caseCodePrefix?: string };
      select?: { labCaseSeq: true; caseCodePrefix: true; name: true };
    }): Promise<{ labCaseSeq: number; caseCodePrefix: string | null; name: string }>;
  };
}

/** 2-3 uppercase letters from the clinic name: "Dental Klinik" → DK, "Smile" → SM. */
export function deriveCaseCodePrefix(clinicName: string): string {
  const words = clinicName
    .toUpperCase()
    .replace(/[^A-Z\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
  const initials = words.map((w) => w[0]!).join('');
  if (initials.length >= 2) return initials.slice(0, 3);
  const letters = (words[0] ?? 'XX').replace(/[^A-Z]/g, '');
  return (letters + 'XX').slice(0, 2);
}

export function formatCaseCode(prefix: string, seq: number): string {
  return `${prefix}-${String(seq).padStart(4, '0')}`;
}

/** Case-code regex for inbound parsing (tier 2): DK-0042, SM-089, KAVR-12345. */
export const CASE_CODE_RE = /[A-Z]{2,4}-\d{3,5}/;

/**
 * Allocate the next case code inside a transaction: atomically increments Clinic.labCaseSeq
 * (concurrency-safe — the row update serializes) and persists the derived prefix on first use.
 */
export async function allocateCaseCode(tx: CaseCodeTx, clinicId: string): Promise<string> {
  const clinic = await tx.clinic.update({
    where: { id: clinicId },
    data: { labCaseSeq: { increment: 1 } },
    select: { labCaseSeq: true, caseCodePrefix: true, name: true },
  });
  let prefix = clinic.caseCodePrefix;
  if (!prefix) {
    prefix = deriveCaseCodePrefix(clinic.name);
    await tx.clinic.update({ where: { id: clinicId }, data: { caseCodePrefix: prefix } });
  }
  return formatCaseCode(prefix, clinic.labCaseSeq);
}
