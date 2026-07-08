import {
  ClinicalExtraction,
  PatientIntakeExtraction,
  PrescriptionExtraction,
  type ActivePlanContext,
  type ClinicalExtractionContext,
  type ExtractedPrescription,
  type MedicineFrequency,
  type PrescriptionContext,
  type TemplateHint,
  type ToothStatus,
} from '@odovox/types';
import type { IClinicalExtractor } from './extractor.js';

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

// ---------------------------------------------------------------------------
// Keyword tables — deliberately small + dental-focused. The mock pattern-matches these so its
// output is realistic for the input (the mock policy's "mock isn't lying" rule).
// ---------------------------------------------------------------------------

const PROCEDURES: ReadonlyArray<readonly [RegExp, string]> = [
  [/\b(rct|root canal)\b/i, 'RCT'],
  [/\b(scaling|cleaning|polish\w*)\b/i, 'Scaling'],
  [/\b(extraction|extract\w*|removed|removal)\b/i, 'Extraction'],
  [/\b(filling|composite|restoration|filled)\b/i, 'Filling'],
  [/\b(crown|cap)\b/i, 'Crown fitting'],
  [/\b(implant)\b/i, 'Implant'],
  [/\b(bridge)\b/i, 'Bridge'],
  [/\b(whitening|bleaching)\b/i, 'Whitening'],
];

const PROCEDURE_TOOTH_STATUS: Record<string, ToothStatus> = {
  RCT: 'RCT',
  Extraction: 'EXTRACTED',
  'Crown fitting': 'CROWN',
  Filling: 'FILLED',
  Implant: 'IMPLANT',
};

const MEDICINES: ReadonlyArray<{ canonical: string; pattern: RegExp }> = [
  { canonical: 'Amoxicillin-Clavulanate', pattern: /augmentin|clavulanate|co-?amoxiclav/i },
  { canonical: 'Amoxicillin', pattern: /amoxicillin|\bamox\b/i },
  { canonical: 'Paracetamol', pattern: /paracetamol|acetaminophen|crocin|\bdolo\b/i },
  { canonical: 'Ibuprofen', pattern: /ibuprofen|brufen/i },
  { canonical: 'Metronidazole', pattern: /metronidazole|metrogyl|flagyl/i },
  { canonical: 'Diclofenac', pattern: /diclofenac|voveran/i },
  { canonical: 'Aceclofenac', pattern: /aceclofenac/i },
  { canonical: 'Ketorolac', pattern: /ketorolac|ketanov/i },
  { canonical: 'Azithromycin', pattern: /azithromycin|azithral/i },
  { canonical: 'Cephalexin', pattern: /cephalexin|sporidex/i },
  { canonical: 'Chlorhexidine', pattern: /chlorhexidine|hexidine|clohex/i },
  { canonical: 'Pantoprazole', pattern: /pantoprazole|pantop|pan\s?40/i },
];

const ORDINALS: Record<string, number> = {
  first: 1, second: 2, third: 3, fourth: 4, fifth: 5,
  sixth: 6, seventh: 7, eighth: 8, ninth: 9, tenth: 10,
};

const TEENS: Record<string, number> = {
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14,
  fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18,
};
const TENS: Record<string, number> = { twenty: 20, thirty: 30, forty: 40 };
const ONES: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8,
};

const MEDICAL_FLAGS: ReadonlyArray<readonly [RegExp, string]> = [
  [/diabet/i, 'Diabetes'],
  [/hypertension|high bp|\bbp\b/i, 'Hypertension'],
  [/pregnan/i, 'Pregnancy'],
  [/asthma/i, 'Asthma'],
  [/thyroid/i, 'Thyroid'],
  [/cardiac|heart (disease|condition)/i, 'Cardiac'],
];

// ---------------------------------------------------------------------------
// Field parsers (pure).
// ---------------------------------------------------------------------------

/** Replace spoken two-word tooth numbers (e.g. "twenty six", "thirty eight", "sixteen") with digits. */
function spokenToothToDigits(text: string): string {
  let out = text.replace(
    /\b(twenty|thirty|forty)[\s-](one|two|three|four|five|six|seven|eight)\b/gi,
    (_m, t: string, o: string) => String(TENS[t.toLowerCase()]! + ONES[o.toLowerCase()]!),
  );
  out = out.replace(
    /\b(eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen)\b/gi,
    (m) => String(TEENS[m.toLowerCase()]!),
  );
  // Tanglish separated digits (Phase 9.6 Issue 8): dentists dictate "3 6 la" for tooth 36 —
  // join quadrant-digit pairs the way the real prompt instructs Gemini to.
  out = out.replace(/\b([1-4])\s+([1-8])\b(?!\s*(?:days?|sittings?|sessions?|weeks?|months?))/g, '$1$2');
  return out;
}

function parseTeeth(transcript: string): number[] {
  const normalized = spokenToothToDigits(transcript);
  const teeth = new Set<number>();
  for (const m of normalized.matchAll(/\b([1-4][1-8])\b/g)) teeth.add(Number(m[1]));
  return [...teeth];
}

/** "fees 5000 collect" / "5000 rupees" / "₹3,500" → paise. Null when no cost was spoken. */
function parseCost(transcript: string): number | null {
  const m =
    transcript.match(/\b(?:fees?|cost|charge[sd]?)\s+(?:is\s+|of\s+)?(?:₹\s*)?([\d,]+)\b/i) ??
    transcript.match(/₹\s*([\d,]+)/) ??
    transcript.match(/\b([\d,]+)\s*(?:rupees|rs\.?)\b/i);
  if (!m) return null;
  const rupees = Number(m[1]!.replaceAll(',', ''));
  return Number.isFinite(rupees) && rupees > 0 ? rupees * 100 : null;
}

function parseProcedure(transcript: string): string | null {
  for (const [pattern, name] of PROCEDURES) if (pattern.test(transcript)) return name;
  return null;
}

function parseSitting(transcript: string): { current: number | null; total: number | null } {
  let current: number | null = null;
  let total: number | null = null;

  const ordinal = transcript.match(
    /\b(first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth)\s+(?:sitting|session|sittings)\b/i,
  );
  if (ordinal) current = ORDINALS[ordinal[1]!.toLowerCase()]!;

  // Numeric ordinals ("1st sitting panniaachu") — common in Tanglish dictation (Issue 8).
  const numOrdinal = transcript.match(/\b(\d+)(?:st|nd|rd|th)\s+(?:sitting|session)\b/i);
  if (numOrdinal) current = Number(numOrdinal[1]);

  const numeric = transcript.match(/\b(?:sitting|session)\s+(\d+)\b/i);
  if (numeric) current = Number(numeric[1]);

  const slash = transcript.match(/\b(\d+)\s*\/\s*(\d+)\b/);
  if (slash) {
    current = Number(slash[1]);
    total = Number(slash[2]);
  }
  const outOf = transcript.match(/\b(?:out of|of)\s+(\d+)\s*(?:sittings|sessions)?\b/i);
  if (outOf && /sitting|session/i.test(transcript)) total = Number(outOf[1]);

  return { current, total };
}

function parseStatus(transcript: string): 'IN_PROGRESS' | 'COMPLETED' | 'ABORTED' | null {
  // Tanglish (Phase 9.6 Issue 8): "panniaachu"/"pannitaachu" = done today.
  if (/\b(completed|complete|finished|done|panniaachu|pannitaachu|pannitachu)\b/i.test(transcript)) return 'COMPLETED';
  if (/\b(aborted|stopped|abandoned|cancelled)\b/i.test(transcript)) return 'ABORTED';
  if (/\b(in[-\s]?progress|ongoing|continuing)\b/i.test(transcript)) return 'IN_PROGRESS';
  return null;
}

function parseFrequency(window: string): MedicineFrequency | null {
  if (/\bQID\b|four times/i.test(window)) return 'QID';
  if (/\bTID\b|thrice|three times/i.test(window)) return 'TID';
  if (/\bBD\b|\bBID\b|twice/i.test(window)) return 'BD';
  if (/\bSOS\b|\bPRN\b|as needed|when (required|needed)/i.test(window)) return 'SOS';
  if (/\bOD\b|once (a day|daily)/i.test(window)) return 'OD';
  return null;
}

function parseDosage(window: string): string | null {
  const m = window.match(/(\d+(?:\.\d+)?)\s*mg\b/i);
  if (m) return `${m[1]}mg`;
  // Spoken shorthand drops the unit ("paracetamol 650 bd") — a bare 2-4 digit number right after
  // the medicine name is its strength in mg, as long as it isn't a duration (Phase 9.6 Issue 8).
  const bare = window.match(/^[a-z][a-z-]*\s+(\d{2,4})\b(?!\s*(?:days?|weeks?|times|%))/i);
  return bare ? `${bare[1]}mg` : null;
}

function parseDuration(window: string): number | null {
  const m = window.match(/(\d+)\s*days?\b/i);
  return m ? Number(m[1]) : null;
}

function parseInstructions(window: string): string | null {
  const m = window.match(
    /\b(after food|before food|after meals|before meals|empty stomach|with water|at bedtime|with milk)\b/i,
  );
  return m ? m[1]! : null;
}

function parseMedicines(transcript: string): ExtractedPrescription[] {
  const hits = MEDICINES.map((m) => ({ canonical: m.canonical, idx: transcript.search(m.pattern) }))
    .filter((h) => h.idx >= 0)
    .sort((a, b) => a.idx - b.idx);

  return hits.map((hit, i) => {
    const window = transcript.slice(hit.idx, hits[i + 1]?.idx ?? transcript.length);
    return {
      name: hit.canonical,
      dosage: parseDosage(window),
      frequency: parseFrequency(window),
      durationDays: parseDuration(window),
      instructions: parseInstructions(window),
    };
  });
}

const MONTHS: Record<string, number> = {
  january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
  july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
};

/** "7th July" / "July 7" → days from now until the next such date (min 1). */
function absoluteDateToAfterDays(window: string, now = new Date()): number | null {
  const m =
    window.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+(january|february|march|april|may|june|july|august|september|october|november|december)\b/i) ??
    window.match(/\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})(?:st|nd|rd|th)?\b/i);
  if (!m) return null;
  const [a, b] = [m[1]!, m[2]!];
  const day = Number(/^\d/.test(a) ? a : b);
  const month = MONTHS[(/^\d/.test(a) ? b : a).toLowerCase()]!;
  const target = new Date(now.getFullYear(), month, day);
  if (target.getTime() <= now.getTime()) target.setFullYear(target.getFullYear() + 1);
  return Math.max(1, Math.round((target.getTime() - now.getTime()) / 86_400_000));
}

function parseFollowUp(transcript: string): { afterDays: number | null; procedureHint: string | null } | null {
  // "next sitting … vechikalam" (Tanglish: will schedule) counts as a follow-up cue (Issue 8).
  const triggerIdx = transcript.search(
    /\b(review|follow[-\s]?up|recall|come back|next visit|revisit|next sitting|vechikalam|vaikalam)\b/i,
  );
  if (triggerIdx < 0) return null;
  const window = transcript.slice(triggerIdx);

  let afterDays: number | null = null;
  const inWeeks = window.match(/\b(?:in|after)\s+(\d+)\s+weeks?\b/i);
  const inDays = window.match(/\b(?:in|after)\s+(\d+)\s+days?\b/i) ?? window.match(/\b(\d+)\s+days?\b/i);
  if (/\bnext week\b|\b(?:in|after)\s+a\s+week\b|\ba week\b/i.test(window)) afterDays = 7;
  else if (inWeeks) afterDays = Number(inWeeks[1]) * 7;
  else if (inDays) afterDays = Number(inDays[1]);
  else if (/\bnext month\b|\ba month\b/i.test(window)) afterDays = 30;
  else afterDays = absoluteDateToAfterDays(window);

  if (afterDays === null) return null;
  return { afterDays, procedureHint: null };
}

function parseMedicalFlags(transcript: string): string[] {
  const flags = new Set<string>();
  for (const [pattern, label] of MEDICAL_FLAGS) if (pattern.test(transcript)) flags.add(label);
  return [...flags];
}

/** "allergic to penicillin and latex" / "penicillin allergy" → ["Penicillin", "Latex"]. */
function parseIntakeAllergies(transcript: string): string[] {
  const out = new Set<string>();
  const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
  const listMatch = transcript.match(/\ballerg(?:ic|y|ies)\s+(?:to\s+)?([^.,;]+)/i);
  if (listMatch) {
    for (const item of listMatch[1]!.split(/\s+and\s+|\s*,\s*/i)) {
      const cleaned = item.trim().replace(/\ballerg(?:ic|y|ies)\b/gi, '').trim();
      if (cleaned && cleaned.length <= 40) out.add(cap(cleaned));
    }
  }
  const suffixMatch = transcript.match(/\b([a-z]+)\s+allerg(?:y|ies)\b/i);
  if (suffixMatch) out.add(cap(suffixMatch[1]!));
  return [...out];
}

/**
 * Phase 5: decide whether today's dictation continues one of the patient's ACTIVE plans. A match
 * needs the SAME procedure and overlapping (or unspecified) teeth — the spec's hard rule is "never
 * assume continuation when teeth or procedure don't match". An explicit "starting / new plan / first
 * sitting" cue forces a fresh plan even when the procedure matches an active one.
 */
function detectContinuesPlan(
  transcript: string,
  procedure: string | null,
  teeth: number[],
  activePlans: ActivePlanContext[],
): ActivePlanContext | null {
  if (!procedure || activePlans.length === 0) return null;
  if (/\b(starting|started|start a|new plan|fresh plan|first sitting)\b/i.test(transcript)) return null;
  const norm = procedure.toLowerCase();
  for (const plan of activePlans) {
    if ((plan.procedureName ?? '').toLowerCase() !== norm) continue;
    const toothOverlap =
      teeth.length === 0 || plan.teeth.length === 0 || plan.teeth.some((t) => teeth.includes(t));
    if (toothOverlap) return plan;
  }
  return null;
}

/**
 * Phase 5: resolve a spoken template name ("apply RCT pack", "post-extraction kit") to a template
 * id. Match on normalized (alphanumeric-only) containment so punctuation/spacing variations survive;
 * prefer the longest template name to avoid a short name shadowing a more specific one.
 */
function detectTemplate(transcript: string, templates: TemplateHint[]): string | null {
  if (templates.length === 0) return null;
  const norm = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const haystack = norm(transcript);
  let best: { id: string; len: number } | null = null;
  for (const t of templates) {
    const needle = norm(t.name);
    if (needle && haystack.includes(needle) && (!best || needle.length > best.len)) {
      best = { id: t.id, len: needle.length };
    }
  }
  return best?.id ?? null;
}

// ---------------------------------------------------------------------------
// MockExtractor
// ---------------------------------------------------------------------------

/**
 * Deterministic keyword extractor for dev + tests. Same input → same output, no API calls. It
 * pattern-matches realistic dental vocabulary; it never invents a medicine or diagnosis the
 * doctor didn't say. Latency defaults to 0 (fast tests); the factory adds ~1200ms in dev.
 */
/**
 * Phase 9.7 §2.5.1 — lab-case suggestion: only when the doctor spoke an impression AND a
 * prosthetic keyword; the timeline ("after one week", "in 15 days") sets dueInDays. Mirrors the
 * real prompt's "never invent this" rule: no impression mention → null.
 */
const LAB_SUGGESTION_TYPES: Array<[RegExp, string]> = [
  [/\bbridge\b/i, 'BRIDGE'],
  [/\bpartial\s+denture\b/i, 'DENTURE_PARTIAL'],
  [/\bdenture\b/i, 'DENTURE_FULL'],
  [/\baligner\b/i, 'ALIGNER'],
  [/\bveneer\b/i, 'VENEER'],
  [/\bnight\s*guard\b/i, 'NIGHT_GUARD'],
  [/\bcrown\b/i, 'CROWN'],
];

function parseLabCaseSuggestion(
  transcript: string,
  teeth: number[],
): { type: string; teeth: number[]; dueInDays: number | null } | null {
  if (!/\bimpression\b/i.test(transcript)) return null;
  const type = LAB_SUGGESTION_TYPES.find(([re]) => re.test(transcript))?.[1];
  if (!type) return null;
  const days = transcript.match(/\b(?:after|in|within)\s+(\d+)\s+days?\b/i)?.[1];
  const weeks = transcript.match(/\b(?:after|in|within)\s+(?:(one|a|two|three)\s+)?weeks?\b/i)?.[1];
  const dueInDays = days
    ? Number.parseInt(days, 10)
    : weeks
      ? (weeks === 'two' ? 14 : weeks === 'three' ? 21 : 7)
      : null;
  return { type, teeth, dueInDays };
}

export class MockExtractor implements IClinicalExtractor {
  constructor(private readonly opts: { latencyMs?: number } = {}) {}

  private async simulateLatency(): Promise<void> {
    const ms = this.opts.latencyMs ?? 0;
    if (ms > 0) await delay(ms);
  }

  async extractClinical(
    transcript: string,
    ctx: ClinicalExtractionContext,
  ): Promise<ClinicalExtraction> {
    await this.simulateLatency();

    const procedure = parseProcedure(transcript);
    const teeth = parseTeeth(transcript);
    const parsedSitting = parseSitting(transcript);
    let current = parsedSitting.current;
    const total = parsedSitting.total;
    const status = parseStatus(transcript);
    const prescriptions = parseMedicines(transcript);
    const followUp = parseFollowUp(transcript);

    // Phase 5: plan continuation. When matched, default the sitting number to the plan's next
    // sitting if the doctor didn't speak an explicit one.
    const continuedPlan = detectContinuesPlan(transcript, procedure, teeth, ctx.activePlans ?? []);
    const continuesPlanId = continuedPlan?.planId ?? null;
    if (continuedPlan && current == null) current = continuedPlan.completedSittings + 1;

    const toothStatus = procedure ? PROCEDURE_TOOTH_STATUS[procedure] : undefined;
    const toothStatusUpdates = toothStatus
      ? teeth.map((tooth) => ({ tooth, status: toothStatus, note: null }))
      : [];

    const clarifications: string[] = [];
    if (procedure && teeth.length === 0) {
      clarifications.push('Procedure mentioned but no tooth number was clear — please confirm.');
    }

    return ClinicalExtraction.parse({
      procedure,
      teeth,
      sittingCurrent: current,
      sittingTotal: total,
      continuesPlanId,
      status,
      estimatedCostPaise: parseCost(transcript),
      prescriptions,
      followUp,
      toothStatusUpdates,
      labCaseSuggestion: parseLabCaseSuggestion(transcript, teeth),
      notes: null,
      clarifications,
      safetyWarnings: [],
    });
  }

  async extractPrescription(
    transcript: string,
    ctx: PrescriptionContext,
  ): Promise<PrescriptionExtraction> {
    await this.simulateLatency();
    return PrescriptionExtraction.parse({
      prescriptions: parseMedicines(transcript),
      applyTemplateId: detectTemplate(transcript, ctx.templates ?? []),
      clarifications: [],
      safetyWarnings: [],
    });
  }

  async extractPatientIntake(transcript: string): Promise<PatientIntakeExtraction> {
    await this.simulateLatency();

    const nameMatch = transcript.match(
      /\b(?:patient|mr\.?|mrs\.?|ms\.?|name is|named)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/,
    );
    const ageMatch = transcript.match(/\b(\d{1,3})\s*(?:years?|yrs?|year[-\s]old|y\/o)\b/i)
      ?? transcript.match(/\bage\s+(\d{1,3})\b/i);
    const phoneMatch = transcript.match(/\b([6-9]\d{9})\b/);
    const complaintMatch = transcript.match(
      /\b(?:complains? of|complaint of|c\/o|presents with|pain (?:in|of))\s+([^.]+)/i,
    );

    let gender: 'MALE' | 'FEMALE' | 'OTHER' | null = null;
    if (/\bfemale|\bwoman\b|\bgirl\b/i.test(transcript)) gender = 'FEMALE';
    else if (/\bmale\b|\bman\b|\bboy\b/i.test(transcript)) gender = 'MALE';

    return PatientIntakeExtraction.parse({
      name: nameMatch ? nameMatch[1]!.trim() : null,
      phone: phoneMatch ? phoneMatch[1] : null,
      age: ageMatch ? Number(ageMatch[1]) : null,
      gender,
      chiefComplaint: complaintMatch ? complaintMatch[0]!.trim() : null,
      medicalFlags: parseMedicalFlags(transcript),
      allergies: parseIntakeAllergies(transcript),
      clarifications: [],
    });
  }
}
