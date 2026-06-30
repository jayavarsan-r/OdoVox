import type { LabCaseStatus, LabCaseType } from '@odovox/types';

export interface LabStatusStyle {
  /** Left-edge bar color (4px). */
  bar: string;
  /** Status pill bg + text. */
  pill: string;
  label: string;
  /** CANCELLED renders struck-through + muted. */
  strikethrough?: boolean;
}

/** Status colour map (§4.1). DRAFT gray · SENT sky · IN_PROGRESS lavender · READY lime ·
 *  DELIVERED sage · REWORK peach · COMPLETED/CANCELLED muted. */
export function labStatusStyle(status: LabCaseStatus): LabStatusStyle {
  switch (status) {
    case 'DRAFT':
      return { bar: 'bg-border-strong', pill: 'bg-paper-warm text-text-subtle', label: 'Draft' };
    case 'SENT':
      return { bar: 'bg-sky', pill: 'bg-sky-soft text-ink', label: 'Sent' };
    case 'IN_PROGRESS':
      return { bar: 'bg-lavender', pill: 'bg-lavender-soft text-ink', label: 'In progress' };
    case 'READY':
      return { bar: 'bg-lime', pill: 'bg-lime-soft text-ink', label: 'Ready' };
    case 'DELIVERED':
      return { bar: 'bg-sage', pill: 'bg-sage-soft text-ink', label: 'Delivered' };
    case 'RETURNED_FOR_REWORK':
      return { bar: 'bg-peach', pill: 'bg-peach-soft text-ink', label: 'Rework' };
    case 'COMPLETED':
      return { bar: 'bg-muted', pill: 'bg-muted text-muted-foreground', label: 'Completed' };
    case 'CANCELLED':
      return { bar: 'bg-muted', pill: 'bg-muted text-muted-foreground', label: 'Cancelled', strikethrough: true };
  }
}

export function labCaseTypeLabel(type: LabCaseType): string {
  const map: Record<LabCaseType, string> = {
    CROWN: 'Crown',
    BRIDGE: 'Bridge',
    DENTURE_FULL: 'Full denture',
    DENTURE_PARTIAL: 'Partial denture',
    ALIGNER: 'Aligner',
    NIGHT_GUARD: 'Night guard',
    OCCLUSAL_SPLINT: 'Occlusal splint',
    VENEER: 'Veneer',
    INLAY_ONLAY: 'Inlay/Onlay',
    RPD: 'RPD',
    OTHER: 'Other',
  };
  return map[type];
}

export type DueTone = 'normal' | 'warning' | 'overdue';

export interface DueInfo {
  label: string;
  tone: DueTone;
}

const DAY_MS = 86_400_000;

/**
 * Render the expected-return countdown. Amber under 2 days; red once overdue (§4.1).
 * `now` is injectable for tests.
 */
export function expectedReturnInfo(expectedReturnAt: Date | string | null, now: Date = new Date()): DueInfo | null {
  if (!expectedReturnAt) return null;
  const due = new Date(expectedReturnAt).getTime();
  const diffDays = Math.floor((due - now.getTime()) / DAY_MS);
  if (diffDays < 0) {
    const overdueBy = Math.abs(diffDays);
    return { label: overdueBy === 0 ? 'Overdue today' : `Overdue ${overdueBy}d`, tone: 'overdue' };
  }
  if (diffDays === 0) return { label: 'Due today', tone: 'warning' };
  return { label: `${diffDays} day${diffDays === 1 ? '' : 's'} left`, tone: diffDays < 2 ? 'warning' : 'normal' };
}

/** Which action buttons a case detail shows for its current status (§4.3). */
export function labCaseActions(status: LabCaseStatus): string[] {
  switch (status) {
    case 'DRAFT':
      return ['edit', 'send', 'cancel'];
    case 'SENT':
      return ['confirm-received', 'receive', 'cancel'];
    case 'IN_PROGRESS':
      return ['receive', 'cancel'];
    case 'READY':
      return ['deliver', 'rework', 'cancel'];
    case 'DELIVERED':
      return ['complete', 'rework'];
    case 'RETURNED_FOR_REWORK':
      return ['send', 'cancel'];
    case 'COMPLETED':
    case 'CANCELLED':
      return [];
  }
}

export interface NewCaseForm {
  patientId?: string;
  vendorId?: string;
  type?: LabCaseType;
  teeth?: number[];
}

/** Required fields for a new lab case: patient, vendor, type, and at least one tooth (§4.5). */
export function validateNewCase(form: NewCaseForm): { valid: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  if (!form.patientId) errors.patientId = 'Select a patient';
  if (!form.vendorId) errors.vendorId = 'Select a vendor';
  if (!form.type) errors.type = 'Pick a case type';
  if (!form.teeth || form.teeth.length === 0) errors.teeth = 'Select at least one tooth';
  return { valid: Object.keys(errors).length === 0, errors };
}

/** Phone mask for vendor cards: keep the country/last digits, dot out the middle. */
export function maskPhone(phone: string): string {
  if (phone.length < 4) return '••';
  return `${phone.slice(0, 2)}••••••${phone.slice(-2)}`;
}
