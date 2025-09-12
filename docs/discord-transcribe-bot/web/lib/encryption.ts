import crypto from 'crypto';

interface EncryptedData {
  iv: string;
  encryptedData: string;
  authTag: string;
}

// Validate encryption key
function validateKey(key: string): Buffer {
  if (!key) {
    throw new Error('ENCRYPTION_KEY environment variable is not set');
  }
  const keyBuffer = Buffer.from(key, 'base64');
  if (keyBuffer.length !== 32) {
    throw new Error('ENCRYPTION_KEY must be 32 bytes (44 base64 characters)');
  }
  return keyBuffer;
}

// Encrypt text using AES-256-GCM
export function encryptSummary(text: string): EncryptedData {
  try {
    const keyBuffer = validateKey(process.env.ENCRYPTION_KEY || '');
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', keyBuffer, iv);
    
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
export function decryptSummary(encrypted: EncryptedData): string {
  try {
    const keyBuffer = validateKey(process.env.ENCRYPTION_KEY || '');
    const iv = Buffer.from(encrypted.iv, 'base64');
    const authTag = Buffer.from(encrypted.authTag, 'base64');
    
    const decipher = crypto.createDecipheriv('aes-256-gcm', keyBuffer, iv);
    decipher.setAuthTag(authTag);
    
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
export function testEncryptionKey(): boolean {
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

// Format summary text for display
export function formatSummaryText(text: string, participants: Array<{username: string, isDM: boolean}> = []): string {
  let formattedText = text;
  
  // Create a map of username to color
  const usernameColors = participants.reduce((acc, participant) => {
    acc[participant.username] = getUsernameColor(participant.username, participant.isDM);
    return acc;
  }, {} as Record<string, string>);

  // First, replace DM usernames with colored spans
  formattedText = formattedText.replace(
    /\*\*(.*?) \(DM\)\*\*/g,
    (match, username) => {
      const color = usernameColors[username] || 'hsl(240, 90%, 70%)'; // Default purple for DM
      return `<span style="color: ${color}; font-weight: bold;">${username} (DM)</span>`;
    }
  );

  // Then replace regular usernames with colored spans
  formattedText = formattedText.replace(
    /\*\*(.*?)\*\*/g,
    (match, username) => {
      const color = usernameColors[username] || 'hsl(200, 90%, 70%)'; // Default blue for regular users
      return `<span style="color: ${color}; font-weight: bold;">${username}</span>`;
    }
  );

  // Handle italics
  formattedText = formattedText.replace(/\*(.*?)\*/g, '<em>$1</em>');

  // Handle newlines
  formattedText = formattedText.replace(/\n\n/g, '<br><br>');
  formattedText = formattedText.replace(/\n/g, '<br>');

  return formattedText;
}

// Function to generate a consistent color for a username
function getUsernameColor(username: string, isDM: boolean = false): string {
  if (isDM) {
    // Return a distinct purple color for DMs
    return 'hsl(240, 90%, 70%)';
  }

  // Create a simple hash of the username
  let hash = 0;
  for (let i = 0; i < username.length; i++) {
    hash = username.charCodeAt(i) + ((hash << 5) - hash);
  }

  // Convert hash to a color
  const hue = hash % 360; // Use the full color spectrum
  const saturation = 80 + (hash % 20); // 80-100% saturation
  const lightness = 60 + (hash % 10); // 60-70% lightness

  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
} 