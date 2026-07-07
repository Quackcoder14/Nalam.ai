require('dotenv').config({ path: '.env.local' });
const crypto = require('crypto');

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'nalam-dev-key-32-bytes-CHANGE-ME';

function decrypt(text) {
  if (!text) return text;
  const textParts = text.split(':');
  if (textParts.length !== 3) return text; // Not encrypted or malformed
  const iv = Buffer.from(textParts[0], 'hex');
  const encryptedText = Buffer.from(textParts[1], 'hex');
  const authTag = Buffer.from(textParts[2], 'hex');
  const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(ENCRYPTION_KEY), iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(encryptedText);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString();
}

console.log('Symptoms:', decrypt('c3779be18778c6c4b7f89c2d:b04855153f53eab50d2a49361cfe7a00:f11f799ac4cd3b34cb08b888c85c34'));
