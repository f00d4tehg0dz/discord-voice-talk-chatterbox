import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import Summary from '@/models/Summary';
import { generateCliffNotes } from '@/lib/summary';

export async function POST(request: Request) {
  try {
    const { summaryId, rules } = await request.json();

    if (!summaryId) {
      return NextResponse.json(
        { error: 'Summary ID is required' },
        { status: 400 }
      );
    }

    await connectDB();

    // Find the summary by ID
    const summary = await Summary.findById(summaryId);
    
    if (!summary) {
      return NextResponse.json(
        { error: 'Summary not found' },
        { status: 404 }
      );
    }

    // Decrypt the summary text
    const decryptedSummary = summary.decryptSummary();
    if (!decryptedSummary) {
      return NextResponse.json(
        { error: 'Failed to decrypt summary' },
        { status: 500 }
      );
    }

    // Get OpenAI API key from environment
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      );
    }

    // Generate new cliff notes with additional rules
    const newCliffNotes = await generateCliffNotes(decryptedSummary, apiKey, rules);

    // Encrypt and save the new cliff notes
    summary.encryptCliffNotes(newCliffNotes);
    await summary.save();

    return NextResponse.json({
      success: true,
      cliffNotes: newCliffNotes
    });
  } catch (error) {
    console.error('Error regenerating cliff notes:', error);
    return NextResponse.json(
      { error: 'Failed to regenerate cliff notes' },
      { status: 500 }
    );
  }
} 