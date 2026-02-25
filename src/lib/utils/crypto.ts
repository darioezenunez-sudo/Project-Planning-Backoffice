import * as crypto from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const KEY_LENGTH = 32;
const SEP = ':';

function getResolvedKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY ?? '';
  const buf = Buffer.from(raw, 'utf8');
  if (buf.length === KEY_LENGTH) return buf;
  if (buf.length === 0) {
    throw new Error('ENCRYPTION_KEY is required for encrypt/decrypt');
  }
  const derived = crypto.hkdfSync(
    'sha256',
    buf,
    Buffer.alloc(0),
    Buffer.from('context-bundle-crypto', 'utf8'),
    KEY_LENGTH,
  ) as Buffer | ArrayBuffer;
  return Buffer.isBuffer(derived) ? derived : Buffer.from(derived);
}

/**
 * Encrypt plaintext with AES-256-GCM. Returns format base64(iv):base64(authTag):base64(ciphertext).
 */
export function encrypt(plaintext: string): string {
  const key = getResolvedKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString('base64'), authTag.toString('base64'), encrypted.toString('base64')].join(
    SEP,
  );
}

/**
 * Decrypt cipher string (format base64(iv):base64(authTag):base64(ciphertext)). Throws on invalid/tampered data.
 */
export function decrypt(cipherString: string): string {
  const key = getResolvedKey();
  const parts = cipherString.split(SEP);
  if (parts.length !== 3) {
    throw new Error('Invalid cipher format: expected iv:authTag:ciphertext');
  }
  const ivB64 = parts[0];
  const authTagB64 = parts[1];
  const cipherB64 = parts[2];
  if (ivB64 == null || authTagB64 == null || cipherB64 == null)
    throw new Error('Invalid cipher format: missing iv, authTag or ciphertext');
  const iv = Buffer.from(ivB64, 'base64');
  const authTag = Buffer.from(authTagB64, 'base64');
  const encrypted = Buffer.from(cipherB64, 'base64');
  if (iv.length !== IV_LENGTH || authTag.length !== AUTH_TAG_LENGTH) {
    throw new Error('Invalid iv or authTag length');
  }
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}
