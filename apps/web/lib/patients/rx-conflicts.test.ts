import { describe, expect, it } from 'vitest';
import { warningLabel, warningsFor } from './rx-conflicts';

describe('warningsFor', () => {
  it('attaches a warning to the medicine the server keyed it to', () => {
    expect(warningsFor('Amoxicillin', ['allergy_conflict:Amoxicillin'])).toHaveLength(1);
    expect(warningsFor('Ibuprofen', ['allergy_conflict:Amoxicillin'])).toHaveLength(0);
  });

  it('matches case-insensitively but never partially', () => {
    // "Amox" must not pick up "Amoxicillin" — a near-match on a drug name is how the wrong
    // row gets flagged.
    expect(warningsFor('amoxicillin', ['allergy_conflict:Amoxicillin'])).toHaveLength(1);
    expect(warningsFor('Amox', ['allergy_conflict:Amoxicillin'])).toHaveLength(0);
  });

  it('ignores warnings that name no drug', () => {
    expect(warningsFor('Amoxicillin', ['sitting_overflow'])).toHaveLength(0);
  });

  it('invents nothing for an unnamed medicine', () => {
    expect(warningsFor('  ', ['allergy_conflict:Amoxicillin'])).toHaveLength(0);
  });
});

describe('warningLabel', () => {
  it('names the allergy when the record has one', () => {
    expect(warningLabel('allergy_conflict:Amoxicillin', 'Penicillin')).toBe(
      'Conflicts with penicillin allergy',
    );
  });

  it('stays truthful when the allergy is not known to this screen', () => {
    expect(warningLabel('allergy_conflict:Amoxicillin', null)).toBe(
      'Conflicts with a recorded allergy',
    );
  });

  it('shows an unfamiliar code rather than guessing a sentence', () => {
    expect(warningLabel('pediatric_dosage:Ibuprofen', null)).toBe('pediatric dosage:Ibuprofen');
  });
});
