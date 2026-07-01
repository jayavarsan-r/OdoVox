import type { WhatsAppMessage } from '@odovox/db';

/**
 * Render a Meta template body by substituting {{1}}, {{2}}, … with the ordered variable map
 * (keyed '1','2',…). Unmatched placeholders are left intact so a mis-send is visible in the audit
 * log rather than silently blanked.
 */
export function renderTemplateBody(body: string, variables: Record<string, string>): string {
  return body.replace(/\{\{(\d+)\}\}/g, (whole, n: string) => variables[n] ?? whole);
}

/**
 * Normalise an Indian patient phone to E.164 (+91XXXXXXXXXX), or return null when it isn't a valid
 * 10-digit Indian mobile. Accepts a bare 10-digit number, a +91-prefixed one, or 0-prefixed.
 */
export function normalizeIndianPhone(raw: string): string | null {
  const digits = raw.replace(/[\s\-()]/g, '');
  let ten = digits;
  if (ten.startsWith('+91')) ten = ten.slice(3);
  else if (ten.startsWith('91') && ten.length === 12) ten = ten.slice(2);
  else if (ten.startsWith('0') && ten.length === 11) ten = ten.slice(1);
  if (!/^[6-9]\d{9}$/.test(ten)) return null;
  return `+91${ten}`;
}

export interface MessageAttachmentShape {
  type: 'pdf' | 'image';
  url: string;
  name: string;
}

/** Serialise a WhatsAppMessage row to the wire shape (MessageResponse). */
export function serializeMessage(m: WhatsAppMessage) {
  return {
    id: m.id,
    direction: m.direction,
    body: m.body,
    status: m.status,
    templateId: m.templateId ?? null,
    attachments: (m.attachments as MessageAttachmentShape[] | null) ?? null,
    inboundType: m.inboundType ?? null,
    inboundButtonId: m.inboundButtonId ?? null,
    costPaise: m.costPaise,
    sentAt: m.sentAt ?? null,
    deliveredAt: m.deliveredAt ?? null,
    readAt: m.readAt ?? null,
    failedAt: m.failedAt ?? null,
    failureReason: m.failureReason ?? null,
    createdAt: m.createdAt,
  };
}

/** Start of the current month (UTC) — the budget/cost window boundary. */
export function startOfMonth(d = new Date()): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}
