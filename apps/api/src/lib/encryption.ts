import crypto from 'node:crypto';

/**
 * Application-layer PHI encryption (AES-256-GCM).
 *
 * Wire format (base64-encoded): [1 byte key version][12 byte IV][ciphertext][16 byte auth tag]
 * - Embedding the key version makes rotation possible later without re-deriving format.
 * - GCM auth tag means any tampering (even a single flipped byte) makes decryption throw.
 *
 * Key source: PHI_ENCRYPTION_KEY (base64, must decode to exactly 32 bytes).
 */

const ALGO = 'aes-256-gcm';
const IV_LEN = 12;
const TAG_LEN = 16;

function getKey(): Buffer {
  const b64 = process.env.PHI_ENCRYPTION_KEY;
  if (!b64) {
    throw new Error('PHI_ENCRYPTION_KEY is not set');
  }
  const key = Buffer.from(b64, 'base64');
  if (key.length !== 32) {
    throw new Error('PHI_ENCRYPTION_KEY must decode to exactly 32 bytes');
  }
  return key;
}

function getKeyVersion(): number {
  return (Number(process.env.PHI_KEY_VERSION ?? '1') || 1) & 0xff;
}

export function encryptField(plaintext: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([Buffer.from([getKeyVersion()]), iv, ciphertext, tag]).toString('base64');
}

export function decryptField(payload: string): string {
  const key = getKey();
  const buf = Buffer.from(payload, 'base64');
  if (buf.length < 1 + IV_LEN + TAG_LEN) {
    throw new Error('Ciphertext is too short or malformed');
  }
  // buf[0] is the key version — reserved for rotation; single-key for now.
  const iv = buf.subarray(1, 1 + IV_LEN);
  const tag = buf.subarray(buf.length - TAG_LEN);
  const ciphertext = buf.subarray(1 + IV_LEN, buf.length - TAG_LEN);

  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  // .final() throws if the auth tag does not verify (tamper detection).
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}

/** Returns the embedded key version of a ciphertext (for rotation tooling). */
export function ciphertextKeyVersion(payload: string): number {
  const buf = Buffer.from(payload, 'base64');
  if (buf.length === 0) throw new Error('Empty ciphertext');
  return buf[0]!;
}
