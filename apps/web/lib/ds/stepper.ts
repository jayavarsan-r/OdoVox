/**
 * Multi-step wizard indicator state machine — drives <StepperHeader>.
 * Pure logic, unit-tested under node. See docs/design-system.md §6.
 */

export type StepStatus = 'complete' | 'current' | 'upcoming';

export interface StepDef {
  id: string;
  label: string;
}

export interface StepState extends StepDef {
  index: number;
  status: StepStatus;
}

/** Resolve each step's display status relative to the current step. */
export function stepperStates(steps: readonly StepDef[], currentId: string): StepState[] {
  const currentIndex = steps.findIndex((s) => s.id === currentId);
  return steps.map((step, index) => {
    let status: StepStatus;
    if (currentIndex === -1) {
      // Unknown current step → treat everything as upcoming (defensive).
      status = 'upcoming';
    } else if (index < currentIndex) {
      status = 'complete';
    } else if (index === currentIndex) {
      status = 'current';
    } else {
      status = 'upcoming';
    }
    return { ...step, index, status };
  });
}

export function stepIndex(steps: readonly StepDef[], id: string): number {
  return steps.findIndex((s) => s.id === id);
}

/** Adjacent step (dir -1 = back, +1 = forward), or undefined at the boundary. */
export function adjacentStep(
  steps: readonly StepDef[],
  id: string,
  dir: -1 | 1,
): StepDef | undefined {
  const i = stepIndex(steps, id);
  if (i === -1) return undefined;
  return steps[i + dir];
}
