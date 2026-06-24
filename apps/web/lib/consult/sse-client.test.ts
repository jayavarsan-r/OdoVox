import { describe, expect, it } from 'vitest';
import { consultReducer, initialState } from './machine.js';
import type { ConsultState } from './machine.js';
import type { ConsultEvent } from './types.js';

/** Feed a sequence of server (SSE) events through the reducer, as the live stream would. */
function stream(events: ConsultEvent[], from: ConsultState = initialState): ConsultState {
  return events.reduce((s, event) => consultReducer(s, { type: 'SERVER_EVENT', event }), from);
}

describe('SSE event → state transitions', () => {
  it('drives RECORDED → TRANSCRIBING → TRANSCRIBED → EXTRACTING → READY(VERIFY)', () => {
    const sd = {
      procedure: 'RCT',
      teeth: [26],
      prescriptions: [],
      toothStatusUpdates: [],
      clarifications: [],
      safetyWarnings: [],
      safety: { warnings: [], blockingErrors: [] },
    };
    const states: string[] = [];
    let s = initialState;
    for (const event of [
      { type: 'RECORDED' },
      { type: 'TRANSCRIBING' },
      { type: 'TRANSCRIBED', data: { transcript: 'RCT on 26 completed.' } },
      { type: 'EXTRACTING' },
      { type: 'READY', data: { structuredData: sd } },
    ] as ConsultEvent[]) {
      s = consultReducer(s, { type: 'SERVER_EVENT', event });
      states.push(s.kind);
    }
    expect(states).toEqual(['TRANSCRIBING', 'TRANSCRIBING', 'TRANSCRIBED', 'EXTRACTING', 'VERIFY']);
    expect((s as Extract<ConsultState, { kind: 'VERIFY' }>).data.procedure).toBe('RCT');
  });

  it('surfaces a safety warning from the READY payload into the VERIFY state', () => {
    const sd = {
      prescriptions: [{ name: 'Amoxicillin', dosage: '500mg', frequency: 'TID', durationDays: 5 }],
      teeth: [], toothStatusUpdates: [], clarifications: [], safetyWarnings: ['allergy_conflict:Amoxicillin'],
      safety: { warnings: [{ code: 'allergy_conflict', detail: 'Amoxicillin', message: 'Allergy conflict' }], blockingErrors: [] },
    };
    const s = stream([{ type: 'READY', data: { structuredData: sd } }]) as Extract<ConsultState, { kind: 'VERIFY' }>;
    expect(s.kind).toBe('VERIFY');
    expect(s.safety[0]!.code).toBe('allergy_conflict');
    expect(s.safety[0]!.resolved).toBe(false);
  });

  it('a FAILED event moves to the FAILED state with the step + message', () => {
    const s = stream([{ type: 'FAILED', data: { stage: 'stt', message: 'Sarvam down' } }]);
    expect(s).toMatchObject({ kind: 'FAILED', step: 'stt', error: 'Sarvam down' });
  });
});
