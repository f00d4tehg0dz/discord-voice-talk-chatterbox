import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { connectDB } from '@/lib/mongodb';
import Campaign from '@/models/Campaign';
import { SessionState } from '@/models/SessionState';
import { authOptions } from '../auth/[...nextauth]/config';
import { registerModels } from '@/lib/models';
import mongoose from 'mongoose';

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    console.log('Session in API route:', session);

    if (!session) {
      console.log('No session found');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const guildId = searchParams.get('guildId');
    const campaignId = searchParams.get('campaignId');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');

    if (!guildId) {
      return NextResponse.json({ error: 'Guild ID is required' }, { status: 400 });
    }

    // Check if user has access to this guild
    const userGuilds = session.guilds || [];
    console.log('User guilds:', userGuilds);
    console.log('Requested guild ID:', guildId);
    
    // If guilds are not available yet, try to fetch them
    if (userGuilds.length === 0 && session.accessToken) {
      try {
        const guildsResponse = await fetch('https://discord.com/api/users/@me/guilds', {
          headers: {
            Authorization: `Bearer ${session.accessToken}`,
          },
        });
        
        if (guildsResponse.ok) {
          const guilds = await guildsResponse.json();
          userGuilds.push(...guilds);
        }
      } catch (error) {
        console.error('Error fetching guilds:', error);
      }
    }
    
    const hasAccess = userGuilds.some(guild => guild.id === guildId);
    console.log('Has access:', hasAccess);
    
    if (!hasAccess) {
      return NextResponse.json({ 
        error: 'Access denied',
        details: {
          requestedGuildId: guildId,
          userGuilds: userGuilds.map(g => g.id)
        }
      }, { status: 403 });
    }

    console.log('Connecting to MongoDB...');
    await connectDB();
    await registerModels();
    console.log('Connected to MongoDB');

    // Get campaigns for the guild
    console.log('Fetching campaigns for guild:', guildId);
    const campaigns = await Campaign.find({ guildId });
    console.log('Found campaigns:', campaigns.length);

    // Get active sessions for the guild
    console.log('Fetching active sessions for guild:', guildId);
    const sessionsActive = await SessionState.find({ 
      guildId,
      status: 'active'
    });
    console.log('Found active sessions:', sessionsActive.length);

    // Build query for summaries
    const query: { guildId: string; campaignId?: mongoose.Types.ObjectId } = { guildId };
    
    // Only add campaignId to query if it's a valid ObjectId
    if (campaignId && mongoose.Types.ObjectId.isValid(campaignId)) {
      query.campaignId = new mongoose.Types.ObjectId(campaignId);
    }

    // Calculate pagination
    const skip = (page - 1) * limit;

    // Find summaries for the guild
    console.log('Fetching summaries with query:', query);
    const summaries = await mongoose.models.Summary.find(query)
      .sort({ sessionNumber: -1 })
      .skip(skip)
      .limit(limit)
      .populate('campaignId')
      .populate('sessionId');
    console.log('Found summaries:', summaries.length);

    // Decrypt and format summaries
    const formattedSummaries = summaries.map((summary) => {
      // Use the virtual getters to get decrypted content
      const decryptedSummary = summary.summary;
      const decryptedCliffNotes = summary.cliffNotes;
      
      return {
        _id: summary._id.toString(),
        campaignId: summary.campaignId ? {
          _id: summary.campaignId._id.toString(),
          name: summary.campaignId.name
        } : null,
        sessionId: summary.sessionId ? {
          _id: summary.sessionId._id.toString()
        } : null,
        sessionNumber: summary.sessionNumber,
        sessionStart: summary.sessionStart,
        participants: summary.participants,
        cliffNotes: decryptedCliffNotes || '',
        summary: decryptedSummary || ''
      };
    });

    // Get total count for pagination
    const total = await mongoose.models.Summary.countDocuments(query);
    console.log('Total summaries:', total);

    return NextResponse.json({
      summaries: formattedSummaries,
      campaigns,
      sessions: sessionsActive,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching summaries:', error);
    return NextResponse.json(
      { error: 'Failed to fetch summaries' },
      { status: 500 }
    );
  }
} 