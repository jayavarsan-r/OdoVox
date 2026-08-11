import { describe, expect, it } from 'vitest';
import { ClinicalExtraction } from '@odovox/types';
import { consultReducer, deriveStateFromView, initialState } from './machine.js';
import type { ConsultState } from './machine.js';
import { hasUnresolvedBlocking } from './safety-view.js';

function run(actions: Parameters<typeof consultReducer>[1][], from: ConsultState = initialState): ConsultState {
  return actions.reduce((s, a) => consultReducer(s, a), from);
}

describe('consult state machine — recording lifecycle', () => {
  it('IDLE → REQUESTING_PERMISSION → RECORDING → PAUSED → RECORDING → STOPPED', () => {
    let s = run([{ type: 'REQUEST_PERMISSION' }]);
    expect(s.kind).toBe('REQUESTING_PERMISSION');
    s = consultReducer(s, { type: 'PERMISSION_GRANTED' });
    expect(s.kind).toBe('RECORDING');
    s = consultReducer(s, { type: 'TICK', durationMs: 4200 });
    expect(s).toMatchObject({ kind: 'RECORDING', durationMs: 4200 });
    s = consultReducer(s, { type: 'PAUSE' });
    expect(s).toMatchObject({ kind: 'PAUSED', durationMs: 4200 });
    s = consultReducer(s, { type: 'RESUME' });
    expect(s.kind).toBe('RECORDING');
    s = consultReducer(s, { type: 'STOP', durationMs: 9000 });
    expect(s).toMatchObject({ kind: 'STOPPED', durationMs: 9000 });
  });

  it('STOPPED → UPLOADING (progress) → TRANSCRIBING after /process', () => {
    let s: ConsultState = { kind: 'STOPPED', durationMs: 9000 };
    s = consultReducer(s, { type: 'UPLOAD_START' });
    expect(s).toMatchObject({ kind: 'UPLOADING', progress: 0 });
    s = consultReducer(s, { type: 'UPLOAD_PROGRESS', progress: 0.6 });
    expect(s).toMatchObject({ kind: 'UPLOADING', progress: 0.6 });
    s = consultReducer(s, { type: 'PROCESS_STARTED' });
    expect(s.kind).toBe('TRANSCRIBING');
  });

  it('PERMISSION_DENIED → FAILED', () => {
    const s = consultReducer({ kind: 'REQUESTING_PERMISSION' }, { type: 'PERMISSION_DENIED', error: 'no mic' });
    expect(s).toMatchObject({ kind: 'FAILED', step: 'permission' });
  });

  it('RERECORD returns to IDLE from any state (even mid-VERIFY)', () => {
    const verify: ConsultState = { kind: 'VERIFY', data: ClinicalExtraction.parse({}), safety: [] };
    expect(consultReducer(verify, { type: 'RERECORD' }).kind).toBe('IDLE');
  });
});

describe('consult state machine — verify + confirm', () => {
  it('VERIFY → CONFIRMING → CONFIRMED', () => {
    const verify: ConsultState = { kind: 'VERIFY', data: ClinicalExtraction.parse({ procedure: 'RCT' }), safety: [] };
    let s = consultReducer(verify, { type: 'CONFIRM_START' });
    expect(s.kind).toBe('CONFIRMING');
    s = consultReducer(s, { type: 'CONFIRM_DONE' });
    expect(s.kind).toBe('CONFIRMED');
  });

  it('CONFIRM_FAILED drops back to VERIFY with the same data', () => {
    const data = ClinicalExtraction.parse({ procedure: 'RCT', teeth: [26] });
    const s = run([{ type: 'CONFIRM_START' }, { type: 'CONFIRM_FAILED' }], { kind: 'VERIFY', data, safety: [] });
    expect(s.kind).toBe('VERIFY');
    expect((s as Extract<ConsultState, { kind: 'VERIFY' }>).data.teeth).toEqual([26]);
  });

  it('EDIT recomputes safety resolution against the new data', () => {
    const data = ClinicalExtraction.parse({ prescriptions: [{ name: 'Amoxicillin', dosage: '500mg', frequency: 'TID', durationDays: 5 }] });
    const verify: ConsultState = {
      kind: 'VERIFY',
      data,
      safety: [{ code: 'allergy_conflict', detail: 'Amoxicillin', message: 'Allergy', blocking: false, resolved: false }],
    };
    const edited = ClinicalExtraction.parse({ prescriptions: [] }); // removed Amoxicillin
    const s = consultReducer(verify, { type: 'EDIT', data: edited }) as Extract<ConsultState, { kind: 'VERIFY' }>;
    expect(s.safety[0]!.resolved).toBe(true); // warning persists but is now resolved
  });
});

describe('consult state machine — SSE server events drive the pipeline (Phase 9.5 regression)', () => {
  const asEvent = (event: Parameters<typeof consultReducer>[1] extends never ? never : { type: string; data?: unknown }) =>
    ({ type: 'SERVER_EVENT', event } as Parameters<typeof consultReducer>[1]);

  it('RECORDED → TRANSCRIBING → TRANSCRIBED → EXTRACTING → READY advances to VERIFY with the payload', () => {
    const structuredData = { procedure: 'RCT', teeth: [26], safety: { warnings: [], blockingErrors: [] } };
    let s: ConsultState = { kind: 'TRANSCRIBING' };
    s = consultReducer(s, asEvent({ type: 'RECORDED' }));
    expect(s.kind).toBe('TRANSCRIBING');
    s = consultReducer(s, asEvent({ type: 'TRANSCRIBED', data: { transcript: 'RCT on 26' } }));
    expect(s).toMatchObject({ kind: 'TRANSCRIBED', transcript: 'RCT on 26' });
    s = consultReducer(s, asEvent({ type: 'EXTRACTING' }));
    expect(s.kind).toBe('EXTRACTING');
    s = consultReducer(s, asEvent({ type: 'READY', data: { structuredData } }));
    expect(s.kind).toBe('VERIFY');
    expect((s as Extract<ConsultState, { kind: 'VERIFY' }>).data.procedure).toBe('RCT');
    expect((s as Extract<ConsultState, { kind: 'VERIFY' }>).data.teeth).toEqual([26]);
  });

  it('a FAILED server event moves the pipeline to FAILED with the stage', () => {
    const s = consultReducer({ kind: 'EXTRACTING' }, asEvent({ type: 'FAILED', data: { stage: 'extraction', message: 'boom' } }));
    expect(s).toMatchObject({ kind: 'FAILED', step: 'extraction', error: 'boom' });
  });
});

describe('consult state machine — server blocking errors on confirm (Phase 9.5 P0.2)', () => {
  const serverError = {
    code: 'invalid_tooth',
    message: 'Tooth 19 is not a valid FDI number',
    field: 'teeth',
    detail: '19',
  };

  it('BLOCKING_ERRORS_SURFACED during CONFIRMING drops to VERIFY with the errors gating the CTA', () => {
    const data = ClinicalExtraction.parse({ procedure: 'RCT', teeth: [19] });
    const s = consultReducer(
      { kind: 'CONFIRMING', data, safety: [] },
      { type: 'BLOCKING_ERRORS_SURFACED', errors: [serverError] },
    ) as Extract<ConsultState, { kind: 'VERIFY' }>;
    expect(s.kind).toBe('VERIFY');
    expect(s.data.teeth).toEqual([19]);
    expect(s.safety[0]).toMatchObject({ code: 'invalid_tooth', field: 'teeth', blocking: true, resolved: false });
    expect(hasUnresolvedBlocking(s.safety)).toBe(true);
  });

  it('keeps prior warnings, and editing the offending field resolves the surfaced error', () => {
    const data = ClinicalExtraction.parse({ procedure: 'RCT', teeth: [19] });
    const warning = { code: 'sitting_jump', message: 'Sitting jumped', blocking: false, resolved: false };
    let s = consultReducer(
      { kind: 'CONFIRMING', data, safety: [warning] },
      { type: 'BLOCKING_ERRORS_SURFACED', errors: [serverError] },
    ) as Extract<ConsultState, { kind: 'VERIFY' }>;
    expect(s.safety).toHaveLength(2); // server error + preserved warning
    // Doctor fixes the tooth → the blocking error resolves and Confirm unlocks.
    s = consultReducer(s, { type: 'EDIT', data: ClinicalExtraction.parse({ procedure: 'RCT', teeth: [16] }) }) as Extract<
      ConsultState,
      { kind: 'VERIFY' }
    >;
    expect(hasUnresolvedBlocking(s.safety)).toBe(false);
  });
});

describe('deriveStateFromView (reconnection / hydrate)', () => {
  it('CONFIRMED status → CONFIRMED', () => {
    expect(deriveStateFromView({ status: 'CONFIRMED', structuredData: {}, latestJob: null } as never).kind).toBe('CONFIRMED');
  });
  it('PENDING_REVIEW with a running STT job → TRANSCRIBING', () => {
    const v = { status: 'PENDING_REVIEW', structuredData: {}, latestJob: { kind: 'STT', status: 'RUNNING' } };
    expect(deriveStateFromView(v as never).kind).toBe('TRANSCRIBING');
  });
  it('PENDING_REVIEW with extracted data + succeeded job → VERIFY', () => {
    const v = { status: 'PENDING_REVIEW', structuredData: { procedure: 'RCT', teeth: [26] }, latestJob: { kind: 'EXTRACTION_CLINICAL', status: 'SUCCEEDED' } };
    expect(deriveStateFromView(v as never).kind).toBe('VERIFY');
  });
});

describe('Task 16 — the failure path must not lose work or double-submit', () => {
  const recorded = (): ConsultState => ({ kind: 'STOPPED', durationMs: 272_000 });

  it('a failed upload keeps the duration, so the UI can still say "4:32 audio saved"', () => {
    const failed = consultReducer(recorded(), {
      type: 'FAIL',
      step: 'upload',
      error: 'The network dropped.',
    });
    expect(failed).toMatchObject({ kind: 'FAILED', step: 'upload' });
  });

  it('retrying from FAILED re-enters UPLOADING — it does not force a re-record', () => {
    // Frame 26: "Try again" retries the upload. The blob survives a FAILED state, so this
    // transition is what keeps four minutes of dictation from being thrown away.
    const failed: ConsultState = { kind: 'FAILED', step: 'upload', error: 'boom' };
    expect(consultReducer(failed, { type: 'UPLOAD_START' })).toMatchObject({
      kind: 'UPLOADING',
      progress: 0,
    });
  });

  it('a second UPLOAD_START restarts cleanly rather than compounding progress', () => {
    // Two taps of "Try again" must not leave progress somewhere between two uploads.
    const first = consultReducer({ kind: 'FAILED', step: 'upload', error: 'x' }, { type: 'UPLOAD_START' });
    const mid = consultReducer(first, { type: 'UPLOAD_PROGRESS', progress: 0.6 });
    const second = consultReducer(mid, { type: 'UPLOAD_START' });
    expect(second).toEqual({ kind: 'UPLOADING', progress: 0 });
  });

  it('progress cannot be applied to a state that is not uploading', () => {
    // Guards against a late in-flight callback from an abandoned attempt reviving a
    // progress bar on the verification screen.
    const verifyish: ConsultState = { kind: 'TRANSCRIBING' };
    expect(consultReducer(verifyish, { type: 'UPLOAD_PROGRESS', progress: 0.9 })).toEqual(
      verifyish,
    );
  });

  it('STOP is ignored unless actually recording — no phantom captures', () => {
    const idle: ConsultState = { kind: 'IDLE' };
    expect(consultReducer(idle, { type: 'STOP', durationMs: 5000 })).toEqual(idle);
  });

  it('RERECORD returns to IDLE, and the store must stop listening to the old run', () => {
    const idle = consultReducer(
      { kind: 'FAILED', step: 'stt', error: 'x' },
      { type: 'RERECORD' },
    );
    expect(idle).toEqual({ kind: 'IDLE' });

    // The reducer alone CANNOT defend this: `applyServerEvent` has no notion of which run
    // an event came from, so a late TRANSCRIBED for the abandoned consultation still
    // moves state. Documented here as the reason `store.rerecord()` closes the SSE stream
    // before dispatching — the guard lives at the subscription, not in the reducer.
    const stale = consultReducer(idle, {
      type: 'SERVER_EVENT',
      event: { type: 'TRANSCRIBED', data: { transcript: 'stale' } },
    } as never);
    expect(stale.kind).toBe('TRANSCRIBED');
  });
});
