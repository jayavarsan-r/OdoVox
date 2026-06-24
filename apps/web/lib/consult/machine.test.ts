import { describe, expect, it } from 'vitest';
import { ClinicalExtraction } from '@odovox/types';
import { consultReducer, deriveStateFromView, initialState } from './machine.js';
import type { ConsultState } from './machine.js';

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
