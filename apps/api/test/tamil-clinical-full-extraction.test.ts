import { describe, expect, it } from 'vitest';
import { MockExtractor } from '../src/lib/ai/mock-extractor.js';
import type { ClinicalExtractionContext } from '@odovox/types';

/**
 * Phase 9.6 Issue 8: the user's real Tanglish consultation. Every dictated fact must extract —
 * tooth 36 (from "3 6 la"), RCT, sitting 1 completed ("panniaachu"), the follow-up date, the
 * Paracetamol course, and the ₹5,000 fee. This is the exact transcript from the field report.
 */

const TRANSCRIPT =
  'patient ku deep root pain 3 6 la, patient ku same tooth la root canal rct perform pannanum, ' +
  'ippa 1st sitting panniaachu next sitting 7th july vechikalam, ' +
  'paracetamol 650 for 5 days bd prescribed, patient is adviced to not have hot or cold foods, fees 5000 collect';

const ctx: ClinicalExtractionContext = {
  name: 'Ravi',
  age: 34,
  gender: 'MALE',
  allergies: [],
  medicalFlags: [],
  currentPlanSummary: null,
  lastVisitSummary: null,
  chiefComplaint: 'deep root pain',
  activePlans: [],
};

describe('rich Tanglish consultation extracts all fields', () => {
  it('captures teeth, procedure, sitting, prescription, follow-up and cost', async () => {
    const x = await new MockExtractor().extractClinical(TRANSCRIPT, ctx);

    expect(x.teeth).toEqual([36]); // "3 6 la" — not 3, 6, or 16
    expect(x.procedure).toBe('RCT');
    expect(x.sittingCurrent).toBe(1); // "1st sitting panniaachu"
    expect(x.status).toBe('COMPLETED'); // panniaachu = done

    // Paracetamol 650mg BD for 5 days — never "Systory" or an invented course.
    expect(x.prescriptions).toHaveLength(1);
    expect(x.prescriptions[0]!.name).toBe('Paracetamol');
    expect(x.prescriptions[0]!.dosage).toBe('650mg');
    expect(x.prescriptions[0]!.frequency).toBe('BD');
    expect(x.prescriptions[0]!.durationDays).toBe(5);

    // "next sitting 7th july vechikalam" resolves to a future follow-up.
    expect(x.followUp).not.toBeNull();
    expect(x.followUp!.afterDays).toBeGreaterThan(0);
    expect(x.followUp!.afterDays).toBeLessThanOrEqual(366);

    // "fees 5000 collect" → ₹5,000 in paise.
    expect(x.estimatedCostPaise).toBe(500_000);

    // And no identity leakage — the contract has no such fields.
    expect(x).not.toHaveProperty('name');
    expect(x).not.toHaveProperty('age');
  });
});
