import crypto from 'crypto';

// Validate encryption key
function validateKey(key) {
  if (!key) {
    throw new Error('ENCRYPTION_KEY environment variable is not set');
  }
  const keyBuffer = Buffer.from(key, 'base64');
//   if (keyBuffer.length !== 32) {
//     throw new Error('ENCRYPTION_KEY must be 32 bytes (64 hex characters)');
//   }
  return keyBuffer;
}

// Encrypt text using AES-256-GCM
export function encryptSummary(text) {
  try {
    const keyBuffer = validateKey(process.env.ENCRYPTION_KEY);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', keyBuffer, iv);
    
    // Encrypt in a single step
    let encrypted = cipher.update(text, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    const authTag = cipher.getAuthTag();

    return {
      iv: iv.toString('base64'),
      encryptedData: encrypted,
      authTag: authTag.toString('base64')
    };
  } catch (error) {
    console.error('Encryption error:', error);
    throw new Error('Failed to encrypt summary: ' + (error instanceof Error ? error.message : 'Unknown error'));
  }
}

// Decrypt text using AES-256-GCM
export function decryptSummary(encrypted) {
  try {
    const keyBuffer = validateKey(process.env.ENCRYPTION_KEY);
    const iv = Buffer.from(encrypted.iv, 'base64');
    const authTag = Buffer.from(encrypted.authTag, 'base64');

    // Create decipher with the same IV used for encryption
    const decipher = crypto.createDecipheriv('aes-256-gcm', keyBuffer, iv);
    
    // Set the auth tag before decrypting
    decipher.setAuthTag(authTag);

    // Decrypt in a single step
    let decrypted = decipher.update(encrypted.encryptedData, 'base64', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    console.error('Decryption error:', error);
    console.error('Encrypted data:', JSON.stringify(encrypted, null, 2));
    throw error;
  }
}

// Test encryption/decryption cycle
export function testEncryptionKey() {
  try {
    const testString = 'This is a test string for encryption verification';
    const encrypted = encryptSummary(testString);
    const decrypted = decryptSummary(encrypted);
    return decrypted === testString;
  } catch (error) {
    console.error('Error testing encryption key:', error);
    return false;
  }
} 