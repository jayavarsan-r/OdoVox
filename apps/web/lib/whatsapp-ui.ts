import type { ConversationCategory, ConversationStatus, MessageStatus } from '@odovox/types';

/** Open WhatsApp (app or web) with a pre-filled message via the wa.me deep link (lab vendors, Phase 7). */
export function shareViaWhatsApp(text: string): void {
  const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
  if (typeof window !== 'undefined') {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}

// ---------------------------------------------------------------------------
// Conversation category — pill styling + label. Per §12.1, message content bubbles use sage/paper,
// never lime (lime is reserved for the primary CTA).
// ---------------------------------------------------------------------------

const CATEGORY_META: Record<ConversationCategory, { label: string; dot: string }> = {
  RESCHEDULE_REQUEST: { label: 'Reschedule', dot: 'bg-peach-deep' },
  COMPLAINT: { label: 'Complaint', dot: 'bg-danger' },
  GENERAL_QUERY: { label: 'General', dot: 'bg-sky' },
  PRESCRIPTION_QUESTION: { label: 'Prescription', dot: 'bg-lavender' },
  PAYMENT_QUERY: { label: 'Payment', dot: 'bg-sage' },
  OTHER: { label: 'Other', dot: 'bg-border-strong' },
};

export function categoryMeta(category: ConversationCategory | null): { label: string; dot: string } {
  return category ? CATEGORY_META[category] : { label: 'General', dot: 'bg-border-strong' };
}

const STATUS_LABEL: Record<ConversationStatus, string> = {
  OPEN: 'Open',
  IN_PROGRESS: 'In progress',
  RESOLVED: 'Resolved',
};

export function conversationStatusLabel(status: ConversationStatus): string {
  return STATUS_LABEL[status];
}

// ---------------------------------------------------------------------------
// Message delivery status — receipt-style label (WhatsApp ticks).
// ---------------------------------------------------------------------------

export function messageStatusLabel(status: MessageStatus): string {
  switch (status) {
    case 'PENDING':
      return 'Sending…';
    case 'SENT':
      return 'Sent ✓';
    case 'DELIVERED':
      return 'Delivered ✓✓';
    case 'READ':
      return 'Read ✓✓';
    case 'FAILED':
      return 'Failed';
    case 'RECEIVED':
      return 'Received';
    case 'BLOCKED_NO_CONSENT':
      return 'Blocked — no consent';
    case 'BLOCKED_BUDGET':
      return 'Blocked — budget';
    default:
      return status;
  }
}

/** Read receipts render in sage; a failure/block in danger; everything else muted. */
export function messageStatusTone(status: MessageStatus): 'read' | 'failed' | 'muted' {
  if (status === 'READ') return 'read';
  if (status === 'FAILED' || status === 'BLOCKED_NO_CONSENT' || status === 'BLOCKED_BUDGET') return 'failed';
  return 'muted';
}

// ---------------------------------------------------------------------------
// 24-hour customer-service window.
// ---------------------------------------------------------------------------

/** Is the free-text reply window still open? */
export function windowOpen(windowExpiresAt: string | Date | null, now: Date = new Date()): boolean {
  if (!windowExpiresAt) return false;
  return new Date(windowExpiresAt).getTime() > now.getTime();
}

/** Human countdown to the window's expiry, e.g. "23h 12m" — or "Closed" once it lapses. */
export function windowCountdown(windowExpiresAt: string | Date | null, now: Date = new Date()): string {
  if (!windowExpiresAt) return 'Closed';
  const ms = new Date(windowExpiresAt).getTime() - now.getTime();
  if (ms <= 0) return 'Closed';
  const totalMinutes = Math.floor(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

// ---------------------------------------------------------------------------
// Template preview — substitute {{1}}, {{2}}, … with variable values (or a placeholder).
// ---------------------------------------------------------------------------

export function renderTemplatePreview(body: string, variables: Record<string, string>): string {
  return body.replace(/\{\{(\d+)\}\}/g, (whole, n: string) => {
    const v = variables[n];
    return v && v.length > 0 ? v : whole;
  });
}

/** Ordered variable slots ({{1}}..{{n}}) a template declares, deduped and sorted. */
export function templateSlots(body: string): string[] {
  const found = new Set<string>();
  for (const m of body.matchAll(/\{\{(\d+)\}\}/g)) found.add(m[1]!);
  return [...found].sort((a, b) => Number(a) - Number(b));
}

/** All declared slots filled with a non-empty value? (compose "Send" gate) */
export function allSlotsFilled(body: string, variables: Record<string, string>): boolean {
  return templateSlots(body).every((slot) => (variables[slot] ?? '').trim().length > 0);
}

// ---------------------------------------------------------------------------
// Budget bar.
// ---------------------------------------------------------------------------

export function budgetPercent(spentPaise: number, budgetPaise: number | null): number | null {
  if (budgetPaise == null || budgetPaise <= 0) return null;
  return Math.min(100, Math.round((spentPaise / budgetPaise) * 100));
}

export function rupees(paise: number): string {
  return `₹${(paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}
