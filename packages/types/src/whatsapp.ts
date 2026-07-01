import { z } from 'zod';
import { PaiseAmount } from './common.js';

/**
 * Phase 9 — WhatsApp + Notifications. Zod is the source of truth; the Prisma enums mirror these
 * string unions by hand (kept aligned by tests). Patient-facing only.
 */

// ---------------------------------------------------------------------------
// Enums (mirror the Prisma enums)
// ---------------------------------------------------------------------------

export const ConsentStatus = z.enum(['NOT_ASKED', 'PENDING', 'OPTED_IN', 'OPTED_OUT', 'EXPIRED']);
export type ConsentStatus = z.infer<typeof ConsentStatus>;

export const ConsentMethod = z.enum(['verbal', 'written', 'signup_form', 'patient_initiated']);
export type ConsentMethod = z.infer<typeof ConsentMethod>;

export const TemplateCategory = z.enum(['UTILITY', 'MARKETING', 'AUTHENTICATION', 'SERVICE']);
export type TemplateCategory = z.infer<typeof TemplateCategory>;

export const TemplateApprovalStatus = z.enum(['PENDING', 'APPROVED', 'REJECTED', 'PAUSED', 'DELETED']);
export type TemplateApprovalStatus = z.infer<typeof TemplateApprovalStatus>;

export const MessageDirection = z.enum(['OUTBOUND', 'INBOUND']);
export type MessageDirection = z.infer<typeof MessageDirection>;

export const MessageStatus = z.enum([
  'PENDING',
  'SENT',
  'DELIVERED',
  'READ',
  'FAILED',
  'RECEIVED',
  'BLOCKED_NO_CONSENT',
  'BLOCKED_BUDGET',
]);
export type MessageStatus = z.infer<typeof MessageStatus>;

export const ConversationStatus = z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED']);
export type ConversationStatus = z.infer<typeof ConversationStatus>;

export const ConversationCategory = z.enum([
  'RESCHEDULE_REQUEST',
  'COMPLAINT',
  'GENERAL_QUERY',
  'PRESCRIPTION_QUESTION',
  'PAYMENT_QUERY',
  'OTHER',
]);
export type ConversationCategory = z.infer<typeof ConversationCategory>;

// ---------------------------------------------------------------------------
// Consent
// ---------------------------------------------------------------------------

export const ConsentOptInInput = z.object({
  method: z.enum(['verbal', 'written', 'signup_form']),
  notes: z.string().max(500).optional(),
});
export type ConsentOptInInput = z.infer<typeof ConsentOptInInput>;

export const ConsentOptOutInput = z.object({
  reason: z.string().max(500).optional(),
});
export type ConsentOptOutInput = z.infer<typeof ConsentOptOutInput>;

export const ConsentReconfirmInput = z.object({
  method: z.enum(['verbal', 'written', 'signup_form']),
});
export type ConsentReconfirmInput = z.infer<typeof ConsentReconfirmInput>;

export const ConsentResponse = z.object({
  id: z.string().nullable(),
  patientId: z.string(),
  status: ConsentStatus,
  optedInAt: z.coerce.date().nullable(),
  optedInMethod: z.string().nullable(),
  optedOutAt: z.coerce.date().nullable(),
  optedOutReason: z.string().nullable(),
  lastReconfirmedAt: z.coerce.date().nullable(),
  notes: z.string().nullable(),
  canSend: z.boolean(),
});
export type ConsentResponse = z.infer<typeof ConsentResponse>;

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

export const WhatsAppTemplateResponse = z.object({
  id: z.string(),
  templateKey: z.string(),
  templateName: z.string(),
  language: z.string(),
  category: TemplateCategory,
  approvalStatus: TemplateApprovalStatus,
  body: z.string(),
  variables: z.array(z.string()),
  isEnabled: z.boolean(),
  estimatedCostPaise: PaiseAmount,
  sentThisMonth: z.number().int().optional(),
  lastSentAt: z.coerce.date().nullable().optional(),
});
export type WhatsAppTemplateResponse = z.infer<typeof WhatsAppTemplateResponse>;

export const TemplateToggleInput = z.object({
  isEnabled: z.boolean(),
});
export type TemplateToggleInput = z.infer<typeof TemplateToggleInput>;

// ---------------------------------------------------------------------------
// Messages + attachments
// ---------------------------------------------------------------------------

export const MessageAttachment = z.object({
  type: z.enum(['pdf', 'image']),
  url: z.string(),
  name: z.string(),
});
export type MessageAttachment = z.infer<typeof MessageAttachment>;

export const MessageResponse = z.object({
  id: z.string(),
  direction: MessageDirection,
  body: z.string(),
  status: MessageStatus,
  templateId: z.string().nullable(),
  attachments: z.array(MessageAttachment).nullable(),
  inboundType: z.string().nullable(),
  inboundButtonId: z.string().nullable(),
  costPaise: PaiseAmount,
  sentAt: z.coerce.date().nullable(),
  deliveredAt: z.coerce.date().nullable(),
  readAt: z.coerce.date().nullable(),
  failedAt: z.coerce.date().nullable(),
  failureReason: z.string().nullable(),
  createdAt: z.coerce.date(),
});
export type MessageResponse = z.infer<typeof MessageResponse>;

// ---------------------------------------------------------------------------
// Manual send + reply
// ---------------------------------------------------------------------------

export const SendMessageInput = z.object({
  patientId: z.string().min(1),
  templateKey: z.string().min(1),
  variables: z.record(z.string(), z.string()),
  attachments: z.array(MessageAttachment).optional(),
});
export type SendMessageInput = z.infer<typeof SendMessageInput>;

export const ReplyInput = z.object({
  text: z.string().min(1).max(4096),
});
export type ReplyInput = z.infer<typeof ReplyInput>;

export const BulkReminderInput = z.object({
  templateKey: z.string().min(1),
  filter: z
    .object({
      minBalancePaise: PaiseAmount.optional(),
      minDaysOverdue: z.number().int().min(0).optional(),
    })
    .default({}),
});
export type BulkReminderInput = z.infer<typeof BulkReminderInput>;

// ---------------------------------------------------------------------------
// Conversations (inbox)
// ---------------------------------------------------------------------------

export const ConversationListItem = z.object({
  id: z.string(),
  patientId: z.string(),
  patientName: z.string(),
  status: ConversationStatus,
  category: ConversationCategory.nullable(),
  lastMessageAt: z.coerce.date().nullable(),
  lastMessagePreview: z.string().nullable(),
  unreadCount: z.number().int(),
  windowExpiresAt: z.coerce.date().nullable(),
});
export type ConversationListItem = z.infer<typeof ConversationListItem>;

export const ConversationDetail = ConversationListItem.extend({
  assignedToUserId: z.string().nullable(),
  windowOpen: z.boolean(),
  messages: z.array(MessageResponse),
});
export type ConversationDetail = z.infer<typeof ConversationDetail>;

export const ConversationListFilter = z.object({
  status: z.enum(['ALL', 'OPEN', 'IN_PROGRESS', 'RESOLVED']).default('ALL'),
  category: ConversationCategory.optional(),
});
export type ConversationListFilter = z.infer<typeof ConversationListFilter>;

// ---------------------------------------------------------------------------
// Settings + cost
// ---------------------------------------------------------------------------

export const WhatsAppBudgetInput = z.object({
  budgetPaise: PaiseAmount.nullable(),
  warningThreshold: z.number().min(0).max(1).optional(),
});
export type WhatsAppBudgetInput = z.infer<typeof WhatsAppBudgetInput>;

export const CostMonth = z.object({
  year: z.number().int(),
  month: z.number().int(),
  conversationsCount: z.number().int(),
  totalCostPaise: PaiseAmount,
});
export type CostMonth = z.infer<typeof CostMonth>;

export const WhatsAppSettingsResponse = z.object({
  accountStatus: z.string().nullable(),
  accountPhoneNumber: z.string().nullable(),
  provider: z.string(),
  budgetPaise: PaiseAmount.nullable(),
  warningThreshold: z.number(),
  spentThisMonthPaise: PaiseAmount,
  templates: z.array(WhatsAppTemplateResponse),
  costHistory: z.array(CostMonth),
});
export type WhatsAppSettingsResponse = z.infer<typeof WhatsAppSettingsResponse>;
