import { describe, expect, it } from 'vitest';
import { adjacentStep, stepIndex, stepperStates } from './stepper';

const STEPS = [
  { id: 'basics', label: 'Clinic' },
  { id: 'hours', label: 'Hours' },
  { id: 'profile', label: 'Profile' },
];

describe('stepperStates', () => {
  it('marks earlier steps complete, the current one current, later ones upcoming', () => {
    const states = stepperStates(STEPS, 'hours');
    expect(states.map((s) => s.status)).toEqual(['complete', 'current', 'upcoming']);
  });

  it('marks only the first step current at the start', () => {
    expect(stepperStates(STEPS, 'basics').map((s) => s.status)).toEqual([
      'current',
      'upcoming',
      'upcoming',
    ]);
  });

  it('marks all-but-last complete on the final step', () => {
    expect(stepperStates(STEPS, 'profile').map((s) => s.status)).toEqual([
      'complete',
      'complete',
      'current',
    ]);
  });

  it('treats an unknown current id as all-upcoming', () => {
    expect(stepperStates(STEPS, 'nope').every((s) => s.status === 'upcoming')).toBe(true);
  });

  it('carries the original index on each state', () => {
    expect(stepperStates(STEPS, 'hours').map((s) => s.index)).toEqual([0, 1, 2]);
  });
});

describe('navigation helpers', () => {
  it('finds the index of a step', () => {
    expect(stepIndex(STEPS, 'profile')).toBe(2);
    expect(stepIndex(STEPS, 'missing')).toBe(-1);
  });

  it('returns adjacent steps and undefined at the boundaries', () => {
    expect(adjacentStep(STEPS, 'hours', -1)?.id).toBe('basics');
    expect(adjacentStep(STEPS, 'hours', 1)?.id).toBe('profile');
    expect(adjacentStep(STEPS, 'basics', -1)).toBeUndefined();
    expect(adjacentStep(STEPS, 'profile', 1)).toBeUndefined();
  });
});
