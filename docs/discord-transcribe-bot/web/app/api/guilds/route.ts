import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/config';

// Simple in-memory rate limiting
const rateLimit = new Map<string, { count: number; timestamp: number }>();
const WINDOW_MS = 60000; // 1 minute
const MAX_REQUESTS = 30; // 30 requests per minute

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Rate limiting
    const ip = '127.0.0.1'; // In production, get the actual IP
    const now = Date.now();
    const windowStart = now - WINDOW_MS;

    // Clean up old entries
    for (const [key, value] of rateLimit.entries()) {
      if (value.timestamp < windowStart) {
        rateLimit.delete(key);
      }
    }

    // Check rate limit
    const userRateLimit = rateLimit.get(ip) || { count: 0, timestamp: now };
    if (userRateLimit.timestamp < windowStart) {
      userRateLimit.count = 0;
      userRateLimit.timestamp = now;
    }

    if (userRateLimit.count >= MAX_REQUESTS) {
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429, headers: { 'Retry-After': '60' } }
      );
    }

    // Update rate limit
    userRateLimit.count++;
    rateLimit.set(ip, userRateLimit);

    // Return guilds from session
    return NextResponse.json({ guilds: session.guilds || [] });
  } catch (error) {
    console.error('Error in guilds API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 