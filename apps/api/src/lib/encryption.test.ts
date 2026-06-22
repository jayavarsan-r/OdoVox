import { beforeAll, describe, expect, it } from 'vitest';
import crypto from 'node:crypto';
import { ciphertextKeyVersion, decryptField, encryptField } from './encryption.js';

beforeAll(() => {
  process.env.PHI_ENCRYPTION_KEY = crypto.randomBytes(32).toString('base64');
  process.env.PHI_KEY_VERSION = '1';
});

describe('PHI encryption (AES-256-GCM)', () => {
  it('round-trips plaintext', () => {
    const plain = 'Penicillin allergy; hypertension since 2019.';
    const enc = encryptField(plain);
    expect(enc).not.toContain(plain);
    expect(decryptField(enc)).toBe(plain);
  });

  it('produces a different ciphertext each time (random IV)', () => {
    const a = encryptField('same input');
    const b = encryptField('same input');
    expect(a).not.toBe(b);
    expect(decryptField(a)).toBe('same input');
    expect(decryptField(b)).toBe('same input');
  });

  it('embeds the key version for rotation tooling', () => {
    process.env.PHI_KEY_VERSION = '2';
    const enc = encryptField('versioned');
    expect(ciphertextKeyVersion(enc)).toBe(2);
    process.env.PHI_KEY_VERSION = '1';
  });

  it('throws when a single byte is tampered with', () => {
    const enc = encryptField('tamper me');
    const buf = Buffer.from(enc, 'base64');
    // Flip a bit in the ciphertext/tag region.
    buf[buf.length - 1] = buf[buf.length - 1]! ^ 0x01;
    const tampered = buf.toString('base64');
    expect(() => decryptField(tampered)).toThrow();
  });

  it('throws on malformed / too-short input', () => {
    expect(() => decryptField('AAAA')).toThrow();
  });

  it('throws when the key is the wrong length', () => {
    const good = process.env.PHI_ENCRYPTION_KEY;
    process.env.PHI_ENCRYPTION_KEY = Buffer.from('short').toString('base64');
    expect(() => encryptField('x')).toThrow(/32 bytes/);
    process.env.PHI_ENCRYPTION_KEY = good;
  });
});
