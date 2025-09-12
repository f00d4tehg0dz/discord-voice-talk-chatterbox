import { NextResponse } from 'next/server';
import crypto from 'crypto';

export async function GET() {
  try {
    const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
    if (!ENCRYPTION_KEY) {
      return NextResponse.json({ 
        error: 'ENCRYPTION_KEY not set',
        success: false 
      });
    }

    // Create a large test string with various content types
    const testString = Array(1000).fill(0).map((_, i) => 
      `Line ${i}: This is a test string with various content types including newlines, special characters !@#$%^&*(), 
      decimal numbers 3.14, quotation marks "Hello", markdown **bold**, and multiple paragraphs.\n\n`
    ).join('');

    // Create cipher
    const keyBuffer = Buffer.from(ENCRYPTION_KEY, 'base64');
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', keyBuffer, iv);
    
    // Encrypt the test string
    let encrypted = cipher.update(testString, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    const authTag = cipher.getAuthTag();

    // Debug logging
    console.log('Test encryption debug:');
    console.log('Original length:', testString.length);
    console.log('Encrypted length:', encrypted.length);
    console.log('IV:', iv.toString('base64'));
    console.log('Auth tag:', authTag.toString('base64'));
    
    // Try to decrypt
    const decipher = crypto.createDecipheriv('aes-256-gcm', keyBuffer, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encrypted, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    
    // Compare results
    const success = decrypted === testString;
    console.log('Test decryption debug:');
    console.log('Decrypted length:', decrypted.length);
    console.log('Success:', success);
    
    return NextResponse.json({ 
      success,
      keyInfo: {
        keyLength: keyBuffer.length,
        keyFirst8Bytes: keyBuffer.slice(0, 8).toString('base64'),
        keyLast8Bytes: keyBuffer.slice(-8).toString('base64')
      },
      testData: {
        originalLength: testString.length,
        encryptedLength: encrypted.length,
        decryptedLength: decrypted.length,
        iv: iv.toString('base64'),
        authTag: authTag.toString('base64')
      }
    });
  } catch (error) {
    console.error('Error testing encryption:', error);
    return NextResponse.json(
      { 
        error: 'Failed to test encryption',
        details: error instanceof Error ? error.message : 'Unknown error',
        success: false
      },
      { status: 500 }
    );
  }
} 