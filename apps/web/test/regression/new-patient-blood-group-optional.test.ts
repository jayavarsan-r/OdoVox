import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { CreatePatientInput } from '@odovox/types';

/**
 * Phase 9.6 Issue 3: an untouched Blood group <select> submits the empty string, which fails the
 * BloodGroup enum and silently disabled the Create button — blood group was optional on paper but
 * mandatory in practice. The form must coerce '' → undefined before Zod sees it.
 */

describe('CreatePatientInput — only 4 fields are required', () => {
  const minimal = { name: 'Priya S', phone: '9876501234', age: 29, gender: 'FEMALE' as const };

  it('parses with just name/phone/age/gender', () => {
    expect(() => CreatePatientInput.parse(minimal)).not.toThrow();
  });

  it("rejects the raw empty-string select value — the reason the form must coerce it", () => {
    expect(CreatePatientInput.safeParse({ ...minimal, bloodGroup: '' }).success).toBe(false);
  });

  it('accepts undefined and null blood group', () => {
    expect(CreatePatientInput.safeParse({ ...minimal, bloodGroup: undefined }).success).toBe(true);
    expect(CreatePatientInput.safeParse({ ...minimal, bloodGroup: null }).success).toBe(true);
  });
});

describe('new-patient form — blood group select coerces "" to undefined', () => {
  const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
  const page = readFileSync(join(webRoot, 'app', '(app)', 'patients', 'new', 'page.tsx'), 'utf8');

  it('registers bloodGroup with a setValueAs that drops the empty string', () => {
    expect(page).toMatch(/register\('bloodGroup',\s*\{\s*setValueAs:/);
  });
});
