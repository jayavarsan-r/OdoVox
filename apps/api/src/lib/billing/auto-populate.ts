import type { BillItemInput } from '@odovox/types';
import type { BillingTx } from './service.js';

/**
 * Build draft Bill line items from what happened in a visit. Sources, in order:
 *   1. PROCEDURE  — procedures with a sitting recorded against this visit (one item per procedure,
 *      with the sitting number as a hint). Unit price comes from the procedure's estimated cost
 *      (Phase 8 Part 4.2 wires voice → Procedure.estimatedCostPaise; until then 0, editable).
 *   2. LAB_CHARGE — lab cases linked to this visit that carry a patientChargePaise and haven't
 *      already been billed (LabCase.billedInBillId guards double-billing — Phase 8 Part 6.2).
 *   3. MATERIAL   — CONSUMPTION inventory movements for this visit, only when the clinic opts in to
 *      charging for materials (Clinic.chargeForMaterials).
 *
 * All items are editable before the receptionist finalizes the bill. Pure-ish: read-only DB access
 * via the passed client (works with the base or a transaction client).
 */
export async function buildItemsFromVisit(
  db: BillingTx,
  opts: { clinicId: string; visitId: string; chargeForMaterials: boolean },
): Promise<BillItemInput[]> {
  const items: BillItemInput[] = [];
  const { clinicId, visitId } = opts;

  // 1. Procedures (via sittings recorded against this visit).
  const sittings = await db.sitting.findMany({
    where: { visitId },
    include: { procedure: true },
    orderBy: { sittingNumber: 'asc' },
  });
  const seenProcedures = new Set<string>();
  for (const s of sittings) {
    if (seenProcedures.has(s.procedureId)) continue;
    seenProcedures.add(s.procedureId);
    const teeth = s.procedure.toothNumbers.length ? ` on ${s.procedure.toothNumbers.join(', ')}` : '';
    items.push({
      kind: 'PROCEDURE',
      description: `${s.procedure.name}${teeth} (sitting ${s.sittingNumber})`,
      sourceType: 'procedure',
      sourceId: s.procedureId,
      quantity: 1,
      // Phase 8 Part 4.2 wires voice → Procedure.estimatedCostPaise; until then 0 (receptionist edits).
      unitPricePaise: 0,
      discountPaise: 0,
    });
  }

  // 2. Lab charges (linked to this visit, with a patient charge set). Phase 8 Part 6.2 adds
  //    LabCase.billedInBillId to guard double-billing; until then nothing is filtered out.
  const labCases = await db.labCase.findMany({
    where: { clinicId, visitId, patientChargePaise: { not: null } },
  });
  for (const lc of labCases) {
    items.push({
      kind: 'LAB_CHARGE',
      description: labChargeDescription(lc),
      sourceType: 'lab_case',
      sourceId: lc.id,
      quantity: 1,
      unitPricePaise: lc.patientChargePaise ?? 0,
      discountPaise: 0,
    });
  }

  // 3. Materials consumed in this visit (opt-in per clinic).
  if (opts.chargeForMaterials) {
    const movements = await db.inventoryMovement.findMany({
      where: { clinicId, visitId, kind: 'CONSUMPTION' },
      include: { item: { select: { name: true, unitOfMeasure: true, lastPurchasePricePaise: true } } },
    });
    for (const m of movements) {
      const qty = Math.abs(m.quantity);
      items.push({
        kind: 'MATERIAL',
        description: `${m.item.name}${m.procedureName ? ` (${m.procedureName})` : ''}`,
        sourceType: 'inventory',
        sourceId: m.id,
        quantity: qty || 1,
        unitPricePaise: m.item.lastPurchasePricePaise ?? 0,
        discountPaise: 0,
      });
    }
  }

  return items;
}

function labChargeDescription(lc: { type: string; material: string | null; teeth: number[] }): string {
  const teeth = lc.teeth.length ? ` (${lc.teeth.join(', ')})` : '';
  const material = lc.material ? ` — ${lc.material}` : '';
  return `${lc.type}${material}${teeth}`;
}
