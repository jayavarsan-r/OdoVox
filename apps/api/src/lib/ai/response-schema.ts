/**
 * Gemini `responseSchema` definitions (Google Generative Language API). Types are the uppercase
 * `Type` enum the v1beta API expects ('OBJECT' | 'ARRAY' | 'STRING' | 'INTEGER' | 'BOOLEAN') — the
 * lowercase form in the Phase 3 prompt is JSON-Schema shorthand; the real API needs these. The
 * shapes mirror the Zod schemas in @odovox/types so the parsed JSON validates cleanly.
 */

// A loose structural type — the Google SDK's Schema type isn't a dep here.
export type GeminiSchema = Record<string, unknown>;

const PRESCRIPTION_ITEM_SCHEMA: GeminiSchema = {
  type: 'OBJECT',
  properties: {
    name: { type: 'STRING' },
    dosage: { type: 'STRING', nullable: true },
    frequency: { type: 'STRING', enum: ['OD', 'BD', 'TID', 'QID', 'SOS'], nullable: true },
    durationDays: { type: 'INTEGER', nullable: true },
    instructions: { type: 'STRING', nullable: true },
  },
  required: ['name'],
};

export const CLINICAL_RESPONSE_SCHEMA: GeminiSchema = {
  type: 'OBJECT',
  properties: {
    procedure: { type: 'STRING', nullable: true },
    teeth: { type: 'ARRAY', items: { type: 'INTEGER' } },
    sittingCurrent: { type: 'INTEGER', nullable: true },
    sittingTotal: { type: 'INTEGER', nullable: true },
    continuesPlanId: { type: 'STRING', nullable: true },
    status: { type: 'STRING', enum: ['IN_PROGRESS', 'COMPLETED', 'ABORTED'], nullable: true },
    estimatedCostPaise: { type: 'INTEGER', nullable: true },
    prescriptions: { type: 'ARRAY', items: PRESCRIPTION_ITEM_SCHEMA },
    followUp: {
      type: 'OBJECT',
      nullable: true,
      properties: {
        afterDays: { type: 'INTEGER', nullable: true },
        procedureHint: { type: 'STRING', nullable: true },
      },
    },
    toothStatusUpdates: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          tooth: { type: 'INTEGER' },
          status: {
            type: 'STRING',
            enum: ['HEALTHY', 'CARIES', 'FILLED', 'EXTRACTED', 'CROWN', 'RCT', 'IMPLANT', 'MISSING', 'OTHER'],
          },
          note: { type: 'STRING', nullable: true },
        },
        required: ['tooth', 'status'],
      },
    },
    notes: { type: 'STRING', nullable: true },
    clarifications: { type: 'ARRAY', items: { type: 'STRING' } },
    safetyWarnings: { type: 'ARRAY', items: { type: 'STRING' } },
  },
  required: ['teeth', 'prescriptions', 'toothStatusUpdates', 'clarifications', 'safetyWarnings'],
};

export const PRESCRIPTION_RESPONSE_SCHEMA: GeminiSchema = {
  type: 'OBJECT',
  properties: {
    prescriptions: { type: 'ARRAY', items: PRESCRIPTION_ITEM_SCHEMA },
    applyTemplateId: { type: 'STRING', nullable: true },
    clarifications: { type: 'ARRAY', items: { type: 'STRING' } },
    safetyWarnings: { type: 'ARRAY', items: { type: 'STRING' } },
  },
  required: ['prescriptions', 'clarifications', 'safetyWarnings'],
};

export const INTAKE_RESPONSE_SCHEMA: GeminiSchema = {
  type: 'OBJECT',
  properties: {
    name: { type: 'STRING', nullable: true },
    phone: { type: 'STRING', nullable: true },
    age: { type: 'INTEGER', nullable: true },
    gender: { type: 'STRING', enum: ['MALE', 'FEMALE', 'OTHER'], nullable: true },
    chiefComplaint: { type: 'STRING', nullable: true },
    medicalFlags: { type: 'ARRAY', items: { type: 'STRING' } },
    clarifications: { type: 'ARRAY', items: { type: 'STRING' } },
  },
  required: ['medicalFlags', 'clarifications'],
};
