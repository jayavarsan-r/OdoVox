/**
 * Clinic-create 3-step wizard logic: per-step schemas (sliced from the single
 * ClinicCreateInput contract), step completeness checks, route mapping, and the
 * merge of the persisted store slices into one submission payload.
 * Unit-tested under node. See docs/design-system.md §6 + Phase 2.5 §4.6.
 */

import { ClinicCreateInput } from "@odovox/types";
import type {
  ClinicCreateInput as ClinicCreateInputType,
  DoctorProfileInput,
} from "@odovox/types";

export const WIZARD_STEPS = [
  { id: "basics", label: "Clinic" },
  { id: "hours", label: "Hours" },
  { id: "profile", label: "Profile" },
] as const;

export type WizardStepId = (typeof WIZARD_STEPS)[number]["id"];

/** Step 1 — clinic basics. */
export const stepBasicsSchema = ClinicCreateInput.pick({
  name: true,
  contactPhone: true,
  addressLine: true,
  city: true,
  state: true,
  pincode: true,
  gstNumber: true,
});

/** Step 2 — hours, breaks, weekly off, chairs. */
export const stepHoursSchema = ClinicCreateInput.pick({
  openingTime: true,
  closingTime: true,
  lunchStart: true,
  lunchEnd: true,
  weeklyOffDays: true,
  chairsCount: true,
});

/** Step 3 — the creating doctor's profile. */
export const stepProfileSchema = ClinicCreateInput.pick({
  doctorName: true,
  qualification: true,
  registrationNumber: true,
  specialization: true,
});

// Inferred value types without importing `zod` directly (not resolvable in the web app).
export type StepBasicsValues = (typeof stepBasicsSchema)["_output"];
export type StepHoursValues = (typeof stepHoursSchema)["_output"];
export type StepProfileValues = (typeof stepProfileSchema)["_output"];

/**
 * Step 1, asked ONE QUESTION AT A TIME — frame 08's model.
 *
 * The frame collapses clinic creation to a single conversational screen and labels its
 * CTA with the next question ("Next · City"). We keep all three steps and every field
 * (Global Constraint 1), so the frame's PACING is reproduced inside step 1 instead: each
 * entry below is one screen, and the CTA names where it goes.
 *
 * `fields` is the contract. The test asserts every key of `stepBasicsSchema` appears here
 * exactly once, so a question cannot be added, split or reordered in a way that silently
 * drops a field the API requires.
 */
export const BASICS_QUESTIONS = [
  {
    id: "name",
    fields: ["name"],
    question: "What's your clinic called?",
    hint: "Appears on prescriptions and WhatsApp messages.",
    next: "Contact",
  },
  {
    id: "contact",
    fields: ["contactPhone"],
    question: "What's the clinic's number?",
    hint: "Patients see this on prescriptions and reminders.",
    next: "Address",
  },
  {
    id: "address",
    fields: ["addressLine"],
    question: "Where is the clinic?",
    hint: "Street and area — this prints on every prescription.",
    next: "City",
  },
  {
    id: "city",
    fields: ["city", "state"],
    question: "Which city?",
    hint: "Used for your clinic address and local defaults.",
    next: "Pincode",
  },
  {
    id: "pincode",
    fields: ["pincode", "gstNumber"],
    question: "What's the pincode?",
    hint: "GST is optional — add it if you invoice businesses.",
    next: "Hours",
  },
] as const;

export type BasicsQuestion = (typeof BASICS_QUESTIONS)[number];
export type BasicsField = BasicsQuestion["fields"][number];

/** The CTA label for a question: the frame never says a bare "Continue". */
export function basicsCtaLabel(index: number): string {
  return `Next · ${BASICS_QUESTIONS[index]!.next}`;
}

const STEP_SCHEMA = {
  basics: stepBasicsSchema,
  hours: stepHoursSchema,
  profile: stepProfileSchema,
} as const;

const STEP_ROUTE: Record<WizardStepId, string> = {
  basics: "/clinic-create/step-1-basics",
  hours: "/clinic-create/step-2-hours",
  profile: "/clinic-create/step-3-profile",
};

export function stepRoute(step: WizardStepId): string {
  return STEP_ROUTE[step];
}

/** A step is complete when the fields it owns satisfy their slice of the schema. */
export function isStepComplete(step: WizardStepId, data: unknown): boolean {
  return STEP_SCHEMA[step].safeParse(data ?? {}).success;
}

/** Combine the two persisted store slices into a single candidate payload. */
export function mergeWizard(
  clinicData?: Partial<ClinicCreateInputType> | null,
  doctorProfile?: Partial<DoctorProfileInput> | null,
): Partial<ClinicCreateInputType> {
  return { ...(clinicData ?? {}), ...(doctorProfile ?? {}) };
}

/** Validate the merged payload against the full contract before POST /clinics. */
export function validateClinicSubmission(merged: unknown) {
  return ClinicCreateInput.safeParse(merged);
}
