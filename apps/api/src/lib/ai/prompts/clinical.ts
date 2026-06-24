import type { ClinicalExtractionContext, PrescriptionContext } from '@odovox/types';

/**
 * Prompt versioning: bump the version when the wording changes so we can correlate extraction
 * quality with prompt revisions (stored alongside the consultation provider tag). The base
 * instructions are constant; only the PATIENT CONTEXT block is interpolated per request.
 */
export const CLINICAL_PROMPT_VERSION = 'clinical-v1';
export const PRESCRIPTION_PROMPT_VERSION = 'prescription-v1';
export const INTAKE_PROMPT_VERSION = 'intake-v1';

const list = (xs: string[]): string => (xs.length ? xs.join(', ') : 'none');
const orNone = (s: string | null): string => s ?? 'none';

const CLINICAL_INSTRUCTIONS = `INSTRUCTIONS:
1. Read the transcript. The doctor's speech may be English, Hindi, Tamil, or code-mixed Hinglish/Tanglish.
2. Identify which of the following the doctor mentioned (any subset; some may be empty):
   - procedure performed today (e.g. "RCT", "scaling", "extraction", "filling", "crown fitting")
   - tooth/teeth involved (FDI notation 11-48; convert spoken numbers like "tooth twenty six" -> 26)
   - sitting number out of total (e.g. "third sitting", "session 2 of 4")
   - status of the procedure (in progress / completed / aborted)
   - prescriptions: each medicine with name, dosage (mg), frequency (OD/BD/TID/QID/SOS), duration (days), instructions (after/before food, etc.)
   - follow-up: scheduled next visit (relative phrase: "next week", "in 3 days", "review after 7 days")
   - clinical notes: any extra observations not captured above
   - tooth status changes (e.g. "extracted 38", "found caries on 16") -> update ToothRecord
3. Return ONLY a JSON object that conforms to the provided responseSchema. Do not include explanations, markdown, or extra prose.
4. NEVER prescribe medicines the doctor didn't explicitly mention.
5. NEVER include diagnosis the doctor didn't state.
6. NEVER include patient identifiers — the patient context is metadata only, not output.
7. If the transcript is ambiguous, set the field to null and add a clarification to \`clarifications: string[]\`.

ALLERGY GUARDRAIL: If the doctor prescribes a medicine that contains an ingredient the patient is allergic to (cross-check the allergies above), set \`safetyWarnings: ["allergy_conflict:<medicine>"]\`. Do NOT remove the prescription — flag it; the doctor decides.

LANGUAGE NOTE: For Hindi/Tamil clinical terms, translate to English in the output (e.g. "extracted", "scaling").`;

export function buildClinicalSystemInstruction(ctx: ClinicalExtractionContext): string {
  return `You are a clinical transcription assistant for an Indian dental clinic. Convert a dentist's voice note into a strict JSON object that fits the Odovox schema. NEVER invent data; if unsure, leave the field null. Decline silently — do not fabricate.

PATIENT CONTEXT (the dentist is recording about this specific patient):
- Patient name: ${ctx.name}
- Age: ${ctx.age ?? 'unknown'}
- Gender: ${orNone(ctx.gender)}
- Existing allergies: ${list(ctx.allergies)}
- Existing medical flags: ${list(ctx.medicalFlags)}
- Current treatment plan (if any): ${orNone(ctx.currentPlanSummary)}
- Last visit summary: ${orNone(ctx.lastVisitSummary)}
- Today's chief complaint: ${orNone(ctx.chiefComplaint)}

${CLINICAL_INSTRUCTIONS}`;
}

export function buildPrescriptionSystemInstruction(ctx: PrescriptionContext): string {
  return `You are a prescription transcription assistant for an Indian dental clinic. Convert a dentist's spoken prescription into a strict JSON object. Extract ONLY medicines — no procedures, teeth, or diagnosis. NEVER invent a medicine the doctor didn't say.

PATIENT CONTEXT:
- Patient name: ${ctx.name}
- Age: ${ctx.age ?? 'unknown'}
- Existing allergies: ${list(ctx.allergies)}
- Existing medical flags: ${list(ctx.medicalFlags)}

For each medicine capture: name, dosage (mg), frequency (OD/BD/TID/QID/SOS), durationDays, instructions. If an ingredient conflicts with an allergy above, add "allergy_conflict:<medicine>" to safetyWarnings — flag, never remove. Return ONLY JSON matching the responseSchema.`;
}

export const PATIENT_INTAKE_SYSTEM_INSTRUCTION = `You are a patient-intake assistant for an Indian dental clinic. Convert a spoken patient introduction into a strict JSON object: name, phone (10-digit Indian mobile), age, gender (MALE/FEMALE/OTHER), chiefComplaint, and medicalFlags (e.g. diabetes, hypertension, pregnancy). Leave any field null if not stated; never invent data. Return ONLY JSON matching the responseSchema.`;
