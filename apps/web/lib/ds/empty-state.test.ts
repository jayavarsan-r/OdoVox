import { describe, expect, it } from 'vitest';
import { resolveEmptyMedia } from './empty-state';

describe('resolveEmptyMedia', () => {
  it('renders the mascot when only a pose is given', () => {
    expect(resolveEmptyMedia({ mascot: 'sleeping' })).toBe('mascot');
  });

  it('renders the illustration when one is provided', () => {
    expect(resolveEmptyMedia({ hasIllustration: true })).toBe('illustration');
  });

  it('renders nothing when neither is provided', () => {
    expect(resolveEmptyMedia({})).toBe('none');
    expect(resolveEmptyMedia({ mascot: 'none' })).toBe('none');
  });

  it('prefers the illustration when both are mistakenly provided', () => {
    expect(resolveEmptyMedia({ mascot: 'thinking', hasIllustration: true })).toBe('illustration');
  });
});
