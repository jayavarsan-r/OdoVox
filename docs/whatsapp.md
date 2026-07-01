# WhatsApp + Notifications (Phase 9)

Patient-facing WhatsApp Business API messaging via **AiSensy**. Closes the clinic → patient loop:
appointment reminders, prescription/lab/receipt delivery, balance nudges, and two-way conversations.

> **Scope:** clinic → patient only. Lab vendors stay on `wa.me` deep links (Phase 7) — those are
> tap-to-chat with the doctor's own WhatsApp, not billable API messaging.

## Provider abstraction

Same env-switch pattern as STT / AI / Payments. `getWhatsAppProvider()` returns the provider named
by `WHATSAPP_PROVIDER` (`mock` | `aisensy`), memoised per process.

| Env | Default | Notes |
|-----|---------|-------|
| `WHATSAPP_PROVIDER` | `mock` | `aisensy` flips to the real API |
| `AISENSY_API_KEY` | — | required when `aisensy` |
| `AISENSY_WEBHOOK_SECRET` | — | HMAC-SHA256 webhook verification; required when `aisensy` |
| `AISENSY_BASE_URL` | `https://backend.aisensy.com` | |
| `MOCK_WHATSAPP_FAILURE_RATE` | `0` | deterministic chaos knob for the mock (0..1) |

`IWhatsAppProvider`: `sendTemplate`, `sendSession`, `uploadMedia`, `verifyWebhookSignature`,
`parseInboundWebhook`, `parseStatusWebhook`, `getBusinessProfile`. Mock is deterministic (same input →
same `mock-…` id), costs 35 paise/send. Boot banner prints `WHATSAPP: mock | aisensy · key=…`.

## Consent (DPDP)

**No message is sent without `PatientWhatsAppConsent.status = OPTED_IN`.** `checkConsent()` is the single
gate: blocks `NOT_ASKED` / `PENDING` / `OPTED_OUT`, and `EXPIRED` once the opt-in (or last reconfirm) is
older than 12 months. A blocked send is still logged (`WhatsAppMessage.status = BLOCKED_NO_CONSENT`) and
audited (`WHATSAPP_CONSENT_VIOLATION_BLOCKED`) — never silently dropped.

Routes: `GET/POST /patients/:id/whatsapp-consent[/opt-in|/opt-out|/reconfirm]`, admin audit at
`GET /whatsapp-consent/audit`.

## Send pipeline (`lib/whatsapp/send.ts`)

`sendWhatsAppMessage()` runs sequential gates **before** inserting a row:

1. **Idempotency** — `(clinicId, idempotencyKey)` unique; same key → existing message, no double-send.
2. **Consent** — else `BLOCKED_NO_CONSENT`.
3. **Template** — must be `APPROVED` + `isEnabled`.
4. **Budget** — if `Clinic.whatsappBudgetPaise` set and month spend + est. cost exceeds it → `BLOCKED_BUDGET`.
5. **Phone** — patient phone normalised to E.164 `+91XXXXXXXXXX`, else `INVALID_PHONE`.
6. Render body → insert `PENDING` → enqueue `odovox-whatsapp-send` (BullMQ, 3× retry).

`runWhatsAppSendJob()` (worker) calls the provider, marks `SENT`/`FAILED` + `costPaise`, broadcasts
`whatsapp.message.sent`. Failures throw so BullMQ retries with backoff.

Manual: `POST /whatsapp/send`, `POST /whatsapp/bulk-reminder` (admin).

## Reminders + cross-wires

- **`runReminderSweep`** (5-min cron): fires due `AppointmentReminder` (Phase 6) + `OUTSTANDING`
  `BillReminder` (Phase 8) rows through the pipeline; queued → `SENT`, consent/template block →
  `CANCELLED`.
- **Lab (Phase 7):** case → `READY` sends `lab_case_ready` (`notifyLabCaseReady`).
- **Payment (Phase 8):** manual payment success sends `payment_receipt` (`notifyPaymentReceipt`,
  idempotent per payment). *Deviation: no PDF attachment yet (no receipt-PDF generator); the
  Razorpay-webhook path is not yet wired — the manual-payment path is.*

## Inbound + status webhooks

`POST /webhooks/whatsapp/incoming` + `/status`. HMAC-verified, deduped via `WebhookEvent`
`(source, eventId)`, always 200. Inbound resolves clinic (business number) + patient (phone), logs the
message, folds it into the patient's `PatientConversation` (auto-category, 24h window, unread bump),
and handles quick replies: button **1** confirms the next appointment, **2** flags a reschedule.
Status webhooks advance `sent → delivered → read` / `failed`.

## Inbox (web)

`/messages` (list, filter pills, unread), `/messages/[id]` (24h countdown, sage/paper bubbles — never
lime per §12.1, read receipts, window-gated free-text reply, resolve). Compose sheet: patient +
template + variables + live preview. Patient detail has a consent + activity + send card. Settings at
`/clinic/whatsapp` (admin): template toggles, budget, cost history. Not a bottom tab — the 5-tab bar is
design-locked (§12.1); entry points live on `/today` and `/clinic`.

## Cost

`runCostAggregation` (daily cron) rolls up outbound `SENT/DELIVERED/READ` messages per clinic per month
into `WhatsAppCostLog`, split by template category. Surfaced in settings.
