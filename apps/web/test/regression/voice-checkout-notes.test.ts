import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { buildCompleteBody, defaultCheckoutForm } from '../../lib/queue/checkout-form.js';

/**
 * Phase 9.5 P1.6 (Issue 4): voice checkout notes. The Take Payment sheet carries a mic on the
 * Notes field (STT-only /dictate/transcribe), and a dictated note must flow into the payment on
 * complete — that's the "patient will pay balance in 2 weeks" audit trail.
 */

describe('dictated checkout note attaches to the payment', () => {
  it('buildCompleteBody carries the note inside payment when a payment is taken', () => {
    const form = {
      ...defaultCheckoutForm(150000),
      notes: 'Patient will pay balance in 2 weeks',
    };
    const body = buildCompleteBody(form);
    expect(body.payment).toBeTruthy();
    expect(body.payment!.notes).toBe('Patient will pay balance in 2 weeks');
  });
});

describe('Take Payment sheet — notes mic wiring', () => {
  const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
  const sheet = readFileSync(join(webRoot, 'components', 'queue', 'checkout-sheet.tsx'), 'utf8');

  it('uses the shared <VoiceInput> in notes mode (Phase 9.7 migration of the 9.5 mic)', () => {
    expect(sheet).toMatch(/<VoiceInput\s/);
    expect(sheet).toMatch(/mode="notes"/);
  });

  it('appends the transcript into the notes field', () => {
    expect(sheet).toMatch(/notes: appendTranscript\(f\.notes \?\? '', t\)/);
  });
});
