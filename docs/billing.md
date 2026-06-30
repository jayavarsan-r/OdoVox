# Odovox Billing (Phase 8)

Every clinical interaction becomes a tracked, paid invoice. This doc is the source of truth for the
money model; the API enforces all of it server-side.

## Money

- **All currency is paise (`Int`).** Never `Decimal`, never floating `Number` for money. The
  front-end converts to `₹X.XX` at the display boundary only (`lib/billing/format.ts#rupees`).
- Totals are **always computed server-side** (`lib/billing/totals.ts`) — the client never sends them.
  Order: line subtotal = `(unit × qty) − line discount` (floored at 0); bill subtotal = Σ lines;
  taxable = subtotal − bill discount; GST = taxable × gstPercent (if applicable); total = taxable + GST.
- A bill's `balancePaise = total − paid + refunded`. Refunds add back to the balance.

## Bill lifecycle

`DRAFT → FINALIZED → PARTIAL → PAID` (with `REFUNDED` / `CANCELLED` as terminal branches).

- **DRAFT** — items are editable. Created during checkout, optionally auto-populated from a visit
  (procedures via sittings, lab charges, materials if `Clinic.chargeForMaterials`).
- **FINALIZED** — item edits locked (reopen is admin-only and only when no payments exist). Patient
  name/phone snapshotted. A `BillReminder` (Phase 9 hook) is queued.
- **PARTIAL / PAID** — driven by payments. `paidInFullAt` set when the balance reaches 0.
- **CANCELLED** — only when no net money is held (refund first).

## Payments

One endpoint per method, all idempotent on `(clinicId, idempotencyKey)` — a retry with the same key
returns the existing payment instead of double-charging. The client generates a fresh key per attempt.

- `CASH`, `UPI_MANUAL`, `CARD_MANUAL`, `BANK_TRANSFER` — recorded by the receptionist (the system
  does not verify with the payer bank), settle `SUCCEEDED` immediately.
- `RAZORPAY` — a hosted payment **link** (not the checkout SDK, so it works for remote/WhatsApp
  payment and avoids Capacitor WebView issues). The payment is `PENDING` until the webhook confirms.
- `ADJUSTMENT` — an admin-only non-money correction (write-off / credit), positive or negative.

### Razorpay

- Provider abstraction (`lib/payments/`) mirrors STT/AI: `MockPaymentGateway` (default, deterministic,
  no network) and `RazorpayGateway` (real, test/live via env). `PAYMENT_PROVIDER` selects.
- Webhook `POST /webhooks/razorpay`: HMAC-SHA256 verified against `RAZORPAY_WEBHOOK_SECRET` (401 on
  mismatch), deduped on `WebhookEvent (source, eventId)`, and only credits a still-`PENDING` payment —
  so replays and out-of-order events never double-credit.
- Non-prod `POST /webhooks/razorpay/mock-trigger/:paymentId` simulates a successful payment locally.

## Refunds (admin only)

Validate the refundable remainder (`amount − refundedAmount`). Cash/manual refunds settle
`SUCCEEDED`; Razorpay refunds call the gateway and start `PENDING` (confirmed by the refund webhook).
The payment moves to `PARTIAL_REFUND` / `REFUNDED`; the amount is added back to the bill balance.

## GST

Most small Indian dental clinics are below the ₹20 lakh GST threshold, so Odovox is **GST-exempt by
default** (`Clinic.gstApplicable = false`). Opt in by setting `gstApplicable = true` and
`gstPercent` (18 for dental services).

- Dental services GST is **18% intra-state = 9% CGST + 9% SGST** (inter-state IGST is not relevant for
  a single-location clinic). The invoice PDF shows the CGST/SGST breakup; `splitGst()` gives CGST the
  odd paise so the halves sum exactly. Exempt clinics print "GST not applicable".
- `gstApplicable` / `gstPercent` are copied onto each Bill at creation, so changing the clinic setting
  never rewrites historical invoices.

## RBAC (see the Phase 8 matrix)

"Admin" is the `ClinicMember.isAdmin` flag (typically the founding DOCTOR), not the `ADMIN` role —
guard with `requireAdmin()` / `requireReceptionistOrAdmin()`. Doctors cannot record payments; refunds
and bill-reopen are admin-only; receptionists + admins handle payments, cancels, and reports.

## Realtime

After commit, routes broadcast `billing.bill.created/finalized/paid`, `billing.payment.succeeded/
pending`, `billing.refund.created` to the clinic room so `/today` tiles, the checkout sheet, and the
patient billing tab update live.
