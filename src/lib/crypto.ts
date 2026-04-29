// src/lib/crypto.ts
// AES-256-GCM authenticated encryption for PHI/PII fields
// Each encrypted value is stored as: iv_hex:authTag_hex:ciphertext_hex
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY_HEX = process.env.ENCRYPTION_KEY;

function getKey(): Buffer {
  if (!KEY_HEX || KEY_HEX.length < 64) {
    throw new Error(
      'ENCRYPTION_KEY env var is missing or too short. ' +
      'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    );
  }
  return Buffer.from(KEY_HEX.slice(0, 64), 'hex'); // 32 bytes → 256-bit key
}

/**
 * Encrypt a plaintext string with AES-256-GCM.
 * Returns a compact string: iv:authTag:ciphertext  (all hex-encoded)
 */
export function encrypt(plaintext: string | null | undefined): string {
  if (plaintext == null || plaintext === '') return '';
  const key = getKey();
  const iv  = randomBytes(12); // 96-bit IV recommended for GCM
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  const authTag   = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

/**
 * Decrypt an AES-256-GCM encrypted string produced by encrypt().
 * Returns the original plaintext, or '' if the input is empty.
 */
export function decrypt(cipherValue: string | null | undefined): string {
  if (!cipherValue || cipherValue === '') return '';
  const parts = cipherValue.split(':');
  if (parts.length !== 3) return cipherValue; // not encrypted — return as-is (migration safety)
  const [ivHex, authTagHex, ciphertextHex] = parts;
  try {
    const key       = getKey();
    const decipher  = createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(ciphertextHex, 'hex')),
      decipher.final(),
    ]);
    return decrypted.toString('utf8');
  } catch {
    return '[Decryption Error]';
  }
}

/** Convenience: encrypt an object's values by key list */
export function encryptFields<T extends Record<string, any>>(
  obj: T,
  fields: (keyof T)[]
): T {
  const result = { ...obj };
  for (const field of fields) {
    result[field] = encrypt(result[field]) as any;
  }
  return result;
}

/** Convenience: decrypt an object's values by key list */
export function decryptFields<T extends Record<string, any>>(
  obj: T,
  fields: (keyof T)[]
): T {
  const result = { ...obj };
  for (const field of fields) {
    result[field] = decrypt(result[field]) as any;
  }
  return result;
}
