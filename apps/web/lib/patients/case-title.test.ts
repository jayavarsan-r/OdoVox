import { describe, expect, it } from 'vitest';
import { caseTitle } from './case-title';

describe('caseTitle', () => {
  it('adds the tooth when the plan name lacks it', () => {
    expect(caseTitle('Root canal', 'RCT', [36])).toBe('Root canal · Tooth 36');
  });

  it('does not repeat a tooth the name already carries', () => {
    // "RCT · Tooth 36 · Tooth 36" shipped on the Overview card before this guard.
    expect(caseTitle('RCT · Tooth 36', 'RCT', [36])).toBe('RCT · Tooth 36');
  });

  it('lists several teeth once', () => {
    expect(caseTitle('Crown prep', 'Crown', [11, 21])).toBe('Crown prep · Tooth 11, 21');
  });

  it('falls back to the procedure, then to a generic word', () => {
    expect(caseTitle('   ', 'Scaling', [])).toBe('Scaling');
    expect(caseTitle('', undefined, [])).toBe('Case');
  });

  it('never renders a dangling separator for a plan with no teeth', () => {
    expect(caseTitle('Scaling', 'Scaling', [])).toBe('Scaling');
  });
});
