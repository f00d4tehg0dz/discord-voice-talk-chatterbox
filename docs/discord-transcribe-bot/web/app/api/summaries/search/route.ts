import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import Summary from '@/models/Summary';
import Campaign from '@/models/Campaign';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/config';
import { FilterQuery } from 'mongoose';

interface SummaryDocument {
  guildId: string;
  campaignId?: string;
  sessionStart?: {
    $gte?: Date;
    $lte?: Date;
  };
  'participants.userId'?: {
    $in: string[];
  };
  tags?: {
    $all: string[];
  };
  $text?: {
    $search: string;
  };
}

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const guildId = searchParams.get('guildId');
    const campaignId = searchParams.get('campaignId');
    const search = searchParams.get('search');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const participants = searchParams.get('participants')?.split(',').filter(Boolean);
    const tags = searchParams.get('tags')?.split(',').filter(Boolean);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');

    if (!guildId) {
      return NextResponse.json({ error: 'Guild ID is required' }, { status: 400 });
    }

    // Connect to DB and ensure models are registered
    await connectDB();

    // Build the query
    const query: FilterQuery<SummaryDocument> = { guildId };

    // Add campaign filter if specified
    if (campaignId) {
      query.campaignId = campaignId;
    }

    // Add date range filter with proper date handling
    if (startDate || endDate) {
      query.sessionStart = {};
      if (startDate) {
        const start = new Date(startDate);
        if (!isNaN(start.getTime())) {
          query.sessionStart.$gte = start;
        }
      }
      if (endDate) {
        const end = new Date(endDate);
        if (!isNaN(end.getTime())) {
          query.sessionStart.$lte = end;
        }
      }
    }

    // Add participant filter
    if (participants?.length) {
      query['participants.userId'] = { $in: participants };
    }

    // Add tags filter
    if (tags?.length) {
      query.tags = { $all: tags };
    }

    // Add text search if search query is provided
    if (search) {
      query.$text = { $search: search };
    }

    console.log('Query:', JSON.stringify(query, null, 2));

    // Execute the query with pagination
    const skip = (page - 1) * limit;
    const [summaries, total] = await Promise.all([
      Summary.find(query)
        .sort({ sessionStart: -1 })
        .skip(skip)
        .limit(limit)
        .populate('campaignId')
        .lean(),
      Summary.countDocuments(query)
    ]);

    // Get all unique campaign IDs from summaries
    const campaignIds = [...new Set(summaries.map(s => s.campaignId?._id).filter(Boolean))];
    
    // Fetch all relevant campaigns
    const campaigns = await Campaign.find({ _id: { $in: campaignIds } }).lean();

    // Process summaries to include decrypted text
    const processedSummaries = summaries.map(summary => {
      const summaryDoc = new Summary(summary);
      return {
        ...summary,
        summary: summaryDoc.decryptSummary(),
        cliffNotes: summaryDoc.decryptCliffNotes()
      };
    });

    return NextResponse.json({
      summaries: processedSummaries,
      campaigns,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error in search API:', error);
    return NextResponse.json(
      { error: 'Failed to search summaries' },
      { status: 500 }
    );
  }
} 