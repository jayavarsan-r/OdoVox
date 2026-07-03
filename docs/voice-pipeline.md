# Odovox Voice + AI Pipeline

> Last updated: 2026-07-03 (Phase 9.7 — voice-everywhere extractors live in `apps/api/src/lib/ai/extractors/`,
> all running through the shared `extractFromTranscript` runner; UI mics are the one `<VoiceInput>` component).

> Started in the Phase 3 prologue with the provider-mocking policy below. Phase 3 expands
> this file with the full pipeline: the STT/AI provider abstractions (`ISttProvider`,
> `IClinicalExtractor`), the BullMQ queues, the SSE state machine, the safety layer, prompt
> versioning, and the cost budget. Until then, this is the source of truth for **why we mock**.

## Pipeline architecture (Phase 3)

```
Doctor taps Record  (web: <Recorder> + consult store)
  → MediaRecorder captures audio/webm;opus (16kHz mono)
  → POST /consultations/audio/presign → PUT direct to S3 (API never proxies bytes)
  → POST /consultations/:id/process  → Job(QUEUED) + BullMQ stt-queue
  → [stt-worker]  Sarvam STT (or mock) → encrypt transcript → Consultation.rawTranscriptEnc
                  → enqueue extraction-queue
  → [extraction-worker]  build patient context → Gemini extract (or mock)
                  → runSafetyChecks() → store structuredData + safetyWarnings → PENDING_REVIEW
  → SSE /consultations/:id/stream pushes RECORDED→TRANSCRIBING→TRANSCRIBED→EXTRACTING→READY
  → web state machine → VERIFY (verification card)
  → doctor edits / confirms
  → POST /consultations/:id/confirm  → commitConsultation() single $transaction:
       Consultation + TreatmentPlan + Procedure + Sitting + Prescription + Appointment
       + ToothRecord(s) + Visit→CHECKOUT + audit  (all-or-nothing)
```

### Layers
- **Providers** (`lib/stt`, `lib/ai`) — `ISttProvider` / `IClinicalExtractor` behind env-selected
  factories. Mock + real are interchangeable; business logic above the interface is identical.
- **Queues** (`queues/`) — BullMQ `stt-queue` (concurrency 4, Sarvam-bound) + `extraction-queue`
  (concurrency 8, Gemini-bound). In-process workers today; `startWorkers()` has a clean boundary so
  Phase 10 can run them standalone (processors take injected deps, no Fastify request context).
- **Safety** (`lib/ai/safety.ts`) — pure `runSafetyChecks()`: allergy cross-check, drug interactions,
  tooth-FDI validity (blocking), sitting overflow/jump, antibiotic duration, pediatric dose,
  pregnancy. **Warnings flag, never block; only blocking errors (invalid tooth) gate Confirm.**
- **SSE** (`/consultations/:id/stream`) — hand-rolled over `reply.raw`: `Cache-Control: no-cache`,
  `X-Accel-Buffering: no`, `: ping` heartbeat every 15s, `req.raw.on('close')` cleanup. Events are
  logged to a Redis list (`?since=<id>` resume) + published live. Truth lives in Postgres, so a
  dropped stream just refetches `GET /consultations/:id` and re-derives state.
- **Confirm transaction** (`lib/consultation/commit.ts`) — the single gate. No STT/Gemini inside (sub-
  100ms target). PDFs stay lazy-on-GET, so the confirm never blocks/fails on PDF and there's no
  orphan-job risk.
- **Web state machine** (`web/lib/consult/machine.ts`) — one `ConsultState` type owns the truth, one
  `consultReducer` transitions it; SSE events + refetches both flow through it. Components only read.

### Short-clip dictation (search mic / intake / prescription)
Unlike the consultation pipeline these run **inline** (audio ≤30s, user waiting in a sheet) — no
queue, no SSE: download → STT → extract → respond. The audio is transient (deleted from S3 right
after transcription; never persisted to the DB). Same providers + safety layer, no new abstractions.

### Prompt versioning
Each prompt carries a version constant (`CLINICAL_PROMPT_VERSION` etc., `lib/ai/prompts/clinical.ts`).
Bump it on any wording change so extraction quality can be correlated with prompt revisions; the
active provider tag (`sarvam+gemini`) is stored on every `Consultation`.

### Cost budget
Gemini extraction caps input at ~4000 chars (~1000 tokens) and output at 500 tokens. Audio ≤60s
typical. CI runs entirely on mocks — zero external spend, no flakiness.

## Audio storage — bucket policy (prod runbook)

Consultation audio lives in the same private S3-compatible bucket as other media, under
`clinics/<clinicId>/audio/<consultationId>.webm`. It is uploaded **directly** browser→S3 via a
presigned PUT (the API never proxies the bytes) and downloaded by the STT worker via a signed GET.

The bucket MUST be configured (set on the **bucket**, not per-object) with:

- **Server-side encryption** — SSE-S3 (AES-256) or SSE-KMS. Every object encrypted at rest.
- **No public access** — block all public ACLs/policies. Audio is reachable only via short-lived
  signed URLs (TTL ≤ 5 min; see `storage.getSignedUrl` / `presignUpload` defaults of 300s).
- **Lifecycle rule** — expire/delete `clinics/*/audio/*` after **90 days**. Once a consultation is
  confirmed, Sarvam has transcribed it and the structured data is the record of value; the raw audio
  is no longer needed. (The transcript is separately encrypted in `Consultation.rawTranscriptEnc`.)

**MinIO (local dev):** SSE + lifecycle rules don't apply to the single dev volume — this is the prod
runbook only. Locally, audio just lands in the `odovox-media` bucket and is cleaned by hand.

---

## Provider mocking — why we keep it

Mocks aren't training wheels. They're permanent test infrastructure used by every serious production system. The rules:

### What mocks are
Behind a clean interface (e.g. `ISttProvider`), we ship two implementations:
- `MockSttProvider` — deterministic, free, fast (used in tests + dev when iterating UI)
- `SarvamSttProvider` — real API (used in dev when testing extraction quality, and in prod)

**The business logic above the interface is identical for both.** Switching providers is one env var. No code branches, no separate flows.

### When mock is the right default
- **CI tests** — running 40 voice tests against real Sarvam costs money + adds 10 minutes per CI run + breaks when Sarvam has an outage. Mocks make `pnpm verify` fast, free, and reliable.
- **UI iteration** — when changing the verification card layout, you don't need real STT; mock gives you a predictable transcript instantly.
- **Failure path testing** — to test "what happens when Sarvam returns 500", you need to control the response. Only mocks let you do that reliably.
- **New developers / new machines** — anyone can clone the repo and run the full app without provisioning API keys.

### When to flip to real
- **Manual end-to-end testing** with actual voice — flip locally via `STT_PROVIDER=sarvam` for the session.
- **Acceptance testing each phase** — run 10 real voice notes through Sarvam+Gemini before declaring the phase done.
- **Production** — always real.

### Env matrix

| Environment | STT_PROVIDER | AI_PROVIDER |
|---|---|---|
| CI / tests | `mock` | `mock` |
| Local dev (default) | `mock` | `gemini` *or* `mock` |
| Local manual testing | `sarvam` | `gemini` |
| Staging | `sarvam` | `gemini` |
| Production | `sarvam` | `gemini` |

### Boot-time visibility

The API logs the active providers at boot in large visible format:

```
┌─────────────────────────────────────┐
│ Odovox API · listening on :4000     │
│                                     │
│   STT:    sarvam · saarika:v2.5     │
│   AI:     gemini · 2.0-flash        │
│   OTP:    msg91                     │
│   ENV:    production                │
└─────────────────────────────────────┘
```

You will never wonder which provider is active. The boot banner tells you.

### Mock isn't lying

A mock that always returns the same transcript regardless of audio is a **bug**, not a feature. Our mocks:
- Pattern-match keywords ("RCT", "tooth 26", "Amoxicillin") so they produce realistic structured output for the input
- Respect the same response schema as the real provider
- Simulate latency (configurable, default 800ms for STT, 1200ms for Gemini)
- Can be configured to fail (`MOCK_STT_FAIL_RATE=0.1` for chaos testing)

If a feature works with mock but breaks with real, that's a mock-vs-real contract drift — fix the mock to match real behavior, don't remove the mock.
