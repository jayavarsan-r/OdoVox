import type { LabButtonPayload, LabTemplateKey } from './types.js';

/**
 * Phase 9.7 §2.7 — outbound lab templates (T1–T5 + consent), rendered per language. Every message
 * carries the case code (the threading key). Buttons are structured JSON payloads, never text.
 * Meta-approval bookkeeping lives on WhatsAppTemplate rows; these are the canonical bodies.
 */

export interface LabTemplateVars {
  clinicName: string;
  caseCode: string;
  caseType: string;
  teeth: string;
  shade: string;
  patientInitials: string;
  patientName?: string;
  expectedDate: string;
  instructions: string;
  hasPhotos: boolean;
}

type Lang = 'en' | 'ta' | 'hi';
const pick = (language: string): Lang => (language === 'ta' || language === 'hi' ? language : 'en');

const statusButton = (caseId: string, to: string, label: string): LabButtonPayload => ({ action: 'status', caseId, to, label });

export function renderLabTemplate(
  key: LabTemplateKey,
  language: string,
  v: LabTemplateVars,
  caseId: string,
): { body: string; buttons: LabButtonPayload[] } {
  const lang = pick(language);
  switch (key) {
    case 'lab_t1_new_case': {
      const bodies: Record<Lang, string> = {
        en: `🦷 New lab case from ${v.clinicName}\nCase: ${v.caseCode} · ${v.caseType} · Tooth ${v.teeth} · Shade ${v.shade}\nPatient: ${v.patientInitials} · Needed by: ${v.expectedDate}\nNotes: ${v.instructions}${v.hasPhotos ? '\n[📸 photos attached]' : ''}`,
        ta: `🦷 ${v.clinicName} — புதிய லேப் கேஸ்\nகேஸ்: ${v.caseCode} · ${v.caseType} · பல் ${v.teeth} · ஷேட் ${v.shade}\nநோயாளர்: ${v.patientInitials} · தேவை: ${v.expectedDate}`,
        hi: `🦷 ${v.clinicName} से नया लैब केस\nकेस: ${v.caseCode} · ${v.caseType} · दांत ${v.teeth} · शेड ${v.shade}\nमरीज़: ${v.patientInitials} · ज़रूरत: ${v.expectedDate}`,
      };
      const ack: Record<Lang, string> = { en: '✅ Received', ta: '✅ கிடைத்தது', hi: '✅ मिल गया' };
      const problem: Record<Lang, string> = { en: '⚠️ Problem', ta: '⚠️ பிரச்சனை', hi: '⚠️ समस्या' };
      return {
        body: bodies[lang],
        buttons: [statusButton(caseId, 'ACKNOWLEDGED', ack[lang]), statusButton(caseId, 'ISSUE_RAISED', problem[lang])],
      };
    }
    case 'lab_t2_nudge':
      return {
        body: `Case ${v.caseCode} (${v.caseType}, tooth ${v.teeth}) — status update please?`,
        buttons: [
          statusButton(caseId, 'IN_PROGRESS', '🔨 In progress'),
          statusButton(caseId, 'READY', '🦷 Ready'),
          statusButton(caseId, 'ISSUE_RAISED', '⚠️ Problem'),
        ],
      };
    case 'lab_t3_dispatch':
      return {
        body: `Case ${v.caseCode} marked ready — when will it reach the clinic?`,
        buttons: [statusButton(caseId, 'DISPATCHED', '🚚 Sent today'), statusButton(caseId, 'DISPATCHED', '📅 Tomorrow')],
      };
    case 'lab_t4_receipt':
      return { body: `Case ${v.caseCode} received at ${v.clinicName}. Thank you! 🙏`, buttons: [] };
    case 'lab_t5_patient_fitting':
      return {
        body: `Hi ${v.patientName ?? v.patientInitials}, your ${v.caseType} for tooth ${v.teeth} is ready at ${v.clinicName}. Please book your fitting appointment.`,
        buttons: [
          { action: 'consent', value: 'book', label: '📅 Book slot' },
          { action: 'consent', value: 'call', label: '📞 Call clinic' },
        ],
      };
    case 'lab_t_consent':
      return {
        body: `Hi, ${v.clinicName} now sends lab cases via Odovox on this number. Reply YES to confirm and get automatic updates.`,
        buttons: [
          { action: 'consent', value: 'yes', label: '✅ Yes, confirmed' },
          { action: 'consent', value: 'no', label: '❌ No, don’t send here' },
        ],
      };
  }
}
