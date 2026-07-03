# Odovox Lab WhatsApp Order Tracker (Phase 9.7)

> Last updated: 2026-07-03 (Phase 9.7)
>
> Design principle: **"WhatsApp is the transport, the database is the truth."** The tracker is
> fully useful with 100% manual status buttons — parsing degrades gracefully, never breaks.

## Architecture

```
Clinic action (Send / status button / voice)
  → transitionLabCase()            lib/lab/transition-service.ts — THE one enforcement point
      matrix · forward-only · llm gate ≥0.85 · timeout_job never transitions
      same-tx LabCaseEvent history · idempotent per waMessageId
  → side effects (post-commit): T1 on SENT · T3 on READY · T4 on RECEIVED · patient T5

Lab WhatsApp reply
  → POST /webhooks/whatsapp/incoming (HMAC-verified, shared with patient traffic)
  → router: sender ∈ LabVendor.whatsappPhoneNumbers → lab flow, else patient, else review row
  → processLabInbound()            lib/lab-transport/inbound-service.ts — the 4-tier parser
      Tier 1  button JSON payload      → transition (lab_button), deterministic
      Tier 2  case code + one keyword  → transition (lab_text), en/ta/hi tables
      Tier 3  LLM over OPEN cases only → transition (llm_parse) iff BOTH confidences ≥ 0.85
              AND exactly one plausible case; below-gate → inbox suggestion
      Tier 4  reception inbox /messages/lab — link / quick status / reply / handled;
              every resolution logged to LabParseTrainingExample
```

## Key invariants

- **No consent → no send, ever.** `LabVendor.consentLoggedAt` gates every outbound except the
  T-consent opt-in itself. Manual Send without consent → blocking modal (or "sent without WhatsApp").
- **automationPaused** kills automated sends per lab; manual tracking keeps working.
- **Timeouts never change status.** The 15-min sweep (`queues/lab-timeout-sweep.ts`) only sends T2
  nudges — capped at ONE automated nudge per case per 24h. Stuck-READY / stale-ISSUE alerts are
  computed on read in `/home/needs-you`.
- **Case codes** (`DK-0042`) ride EVERY message — the threading key, because one lab serves many
  clinics. Atomic per-clinic sequence on `Clinic.labCaseSeq`.
- **One-tap undo** on AI-parsed transitions (24h window) from the case timeline.
- **Media** auto-attaches when the case is unambiguous (code in caption, or single open case);
  otherwise waits on the LabMessage for reception.

## Transport

`ILabTransportAdapter` (lib/lab-transport/): `WhatsAppLabAdapter` rides the Phase 9 provider
(AiSensy or its mock via `WHATSAPP_PROVIDER`); `MockLabAdapter` is fully deterministic for tests.
A future `DentNodeLabAdapter` implements the same interface — swapping transport is config, not a
rewrite.

## Templates (submit 2–3 wording variants to Meta upfront)

T1 new case (en/ta/hi) · T2 status nudge · T3 dispatch confirm (auto on READY) · T4 receipt
thanks (auto on RECEIVED) · T5 patient fitting (via Phase 9 cross-wire) · T-consent opt-in.
Bodies live in `lib/lab-transport/templates.ts`; buttons are structured JSON payloads, never text.

## Cost

Every outbound LabMessage carries `costPaise`. Per-lab analytics (`GET /lab/vendors/:id/analytics`)
reports monthly spend and ₹/case — flag anything above ₹2/case (indicates nudge spam).
