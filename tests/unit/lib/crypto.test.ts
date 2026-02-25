import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { decrypt, encrypt } from '@/lib/utils/crypto';

const KEY_32 = 'a'.repeat(32);
const KEY_32_OTHER = 'b'.repeat(32);

describe('crypto', () => {
  beforeEach(() => {
    process.env.ENCRYPTION_KEY = KEY_32;
  });

  afterEach(() => {
    delete process.env.ENCRYPTION_KEY;
  });

  describe('encrypt / decrypt roundtrip', () => {
    it('decrypt(encrypt(x)) === x for arbitrary string', () => {
      const plain = 'hello world';
      expect(decrypt(encrypt(plain))).toBe(plain);
    });

    it('roundtrip for empty string', () => {
      expect(decrypt(encrypt(''))).toBe('');
    });

    it('roundtrip for unicode and long content', () => {
      const plain = 'Ñoño 日本語 🔐 ' + 'x'.repeat(5000);
      expect(decrypt(encrypt(plain))).toBe(plain);
    });

    it('produces different ciphertext each time (random IV)', () => {
      const a = encrypt('same');
      const b = encrypt('same');
      expect(a).not.toBe(b);
      expect(decrypt(a)).toBe('same');
      expect(decrypt(b)).toBe('same');
    });
  });

  describe('decrypt with wrong key', () => {
    it('throws when decrypting with different key', () => {
      process.env.ENCRYPTION_KEY = KEY_32;
      const cipher = encrypt('secret');
      process.env.ENCRYPTION_KEY = KEY_32_OTHER;
      expect(() => decrypt(cipher)).toThrow();
    });
  });

  describe('decrypt with altered ciphertext', () => {
    it('throws when ciphertext part is tampered', () => {
      const cipher = encrypt('secret');
      const parts = cipher.split(':');
      const ct = parts[2];
      const tampered = `${String(parts[0])}:${String(parts[1])}:${ct ? Buffer.from(ct, 'base64').toString('base64').slice(0, -1) + 'X' : 'X'}`;
      expect(() => decrypt(tampered)).toThrow();
    });

    it('throws when authTag is altered', () => {
      const cipher = encrypt('secret');
      const [iv, , ct] = cipher.split(':');
      const tampered = `${String(iv)}:YWFhYWFhYWFhYWFhYWFhYQ==:${String(ct)}`;
      expect(() => decrypt(tampered)).toThrow();
    });

    it('throws when format is invalid (not 3 parts)', () => {
      expect(() => decrypt('only-one-part')).toThrow('Invalid cipher format');
      expect(() => decrypt('a:b')).toThrow('Invalid cipher format');
    });
  });

  describe('encrypt without ENCRYPTION_KEY', () => {
    it('throws when key is missing', () => {
      delete process.env.ENCRYPTION_KEY;
      expect(() => encrypt('x')).toThrow('ENCRYPTION_KEY');
    });
  });

  describe('key derivation', () => {
    it('derives 32-byte key via HKDF when raw key is not 32 bytes', () => {
      process.env.ENCRYPTION_KEY = 'my-secret-key-longer-than-32-chars-here!!';
      const plain = 'test';
      expect(decrypt(encrypt(plain))).toBe(plain);
    });
  });
});
