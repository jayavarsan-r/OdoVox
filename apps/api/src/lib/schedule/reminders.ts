/** Reminder drafts for an appointment: one 24h before, one 1h before. PENDING; Phase 9 sends them. */
const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

export interface ReminderDraft {
  clinicId: string;
  appointmentId: string;
  patientId: string;
  scheduledFor: Date;
  channel: string;
  template: string;
  status: 'PENDING';
}

export function reminderDrafts(input: {
  clinicId: string;
  appointmentId: string;
  patientId: string;
  startsAt: Date;
}): ReminderDraft[] {
  const base = {
    clinicId: input.clinicId,
    appointmentId: input.appointmentId,
    patientId: input.patientId,
    channel: 'whatsapp',
    status: 'PENDING' as const,
  };
  return [
    { ...base, scheduledFor: new Date(input.startsAt.getTime() - DAY_MS), template: 'appointment_reminder_24h' },
    { ...base, scheduledFor: new Date(input.startsAt.getTime() - HOUR_MS), template: 'appointment_reminder_1h' },
  ];
}
