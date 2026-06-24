import { describe, expect, it } from 'vitest';
import { buildWalkInBody, defaultDoctorId, doctorChoices } from './walk-in';
import { makeDoctor } from '../../test/queue-fixtures';

describe('walk-in flow', () => {
  it('builds the POST /visits body, trimming complaint and defaulting priority', () => {
    expect(buildWalkInBody({ patientId: 'p1', doctorId: 'd1', chiefComplaint: '  Toothache ' })).toEqual({
      patientId: 'p1',
      doctorId: 'd1',
      priority: 0,
      chiefComplaint: 'Toothache',
    });
  });

  it('omits an empty complaint and includes appointmentId when given', () => {
    const body = buildWalkInBody({ patientId: 'p1', doctorId: 'd1', chiefComplaint: '   ', appointmentId: 'a1', priority: 10 });
    expect(body).toEqual({ patientId: 'p1', doctorId: 'd1', priority: 10, appointmentId: 'a1' });
    expect(body).not.toHaveProperty('chiefComplaint');
  });

  it('doctorChoices sorts available + least-loaded first', () => {
    const doctors = [
      makeDoctor({ id: 'd1', name: 'Dr. Asha' }),
      makeDoctor({ id: 'd2', name: 'Dr. Vikram' }),
      makeDoctor({ id: 'd3', name: 'Dr. Off', available: false }),
    ];
    const counts = new Map([
      ['d1', 3],
      ['d2', 1],
    ]);
    const choices = doctorChoices(doctors, counts);
    expect(choices.map((c) => c.id)).toEqual(['d2', 'd1', 'd3']); // d2 (1 waiting) < d1 (3) < off
    expect(choices[0]).toMatchObject({ waiting: 1, available: true });
  });

  it('defaults to the only available doctor without asking', () => {
    expect(defaultDoctorId([makeDoctor({ id: 'd1' })])).toBe('d1');
    expect(defaultDoctorId([makeDoctor({ id: 'd1' }), makeDoctor({ id: 'd2' })])).toBeNull();
    expect(defaultDoctorId([makeDoctor({ id: 'd1', available: false }), makeDoctor({ id: 'd2' })])).toBe('d2');
  });
});
