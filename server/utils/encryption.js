const crypto = require('crypto');

if (!process.env.ENCRYPTION_KEY) {
  console.error('================================================================');
  console.error('❌ FATAL ERROR: NO ENCRYPTION_KEY FOUND! ❌');
  console.error('You MUST add ENCRYPTION_KEY (64-character hex string) to your current environment variables.');
  console.error('================================================================');
  process.exit(1);
}

const ALGORITHM = 'aes-256-gcm';
const KEY = Buffer.from(process.env.ENCRYPTION_KEY, 'hex'); // 32 bytes
const IV_LENGTH = 16;
const TAG_LENGTH = 16;

/**
 * Encrypts a string using AES-256-GCM.
 * Returns a base64-encoded string: iv:tag:ciphertext
 */
function encrypt(plaintext) {
  if (!plaintext) return null;
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString('base64');
}

/**
 * Decrypts a base64-encoded AES-256-GCM string.
 */
function decrypt(ciphertext) {
  if (!ciphertext) return null;
  try {
    const data = Buffer.from(ciphertext, 'base64');
    const iv = data.slice(0, IV_LENGTH);
    const tag = data.slice(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
    const encrypted = data.slice(IV_LENGTH + TAG_LENGTH);
    const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
  } catch (err) {
    console.error('Decryption failed:', err.message);
    return null;
  }
}

module.exports = { encrypt, decrypt };
