import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import Summary from '@/models/Summary';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../auth/[...nextauth]/config';

interface Participant {
  username: string;
  sessionsAttended: number;
  isDM: boolean;
}

interface MonthlySession {
  month: string;
  sessions: number;
}

export async function GET(
  request: NextRequest,
  context: unknown
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get the campaignId from params and ensure it is awaited
    const params = context as { params: Promise<{ campaignId: string }> };
    const { campaignId } = await params.params;

    // Validate campaignId
    if (!campaignId) {
      return NextResponse.json(
        { error: 'Campaign ID is required' },
        { status: 400 }
      );
    }

    await connectDB();

    // Get all summaries for this campaign
    const summaries = await Summary.find({ campaignId }).sort({ sessionStart: 1 });

    if (!summaries.length) {
      return NextResponse.json(
        { error: 'No summaries found for this campaign' },
        { status: 404 }
      );
    }

    // Calculate total sessions
    const totalSessions = summaries.length;

    // Calculate average session length and total play time
    let totalMinutes = 0;
    summaries.forEach(summary => {
      const start = new Date(summary.sessionStart);
      const end = new Date(summary.sessionEnd);
      const sessionLength = (end.getTime() - start.getTime()) / (1000 * 60); // Convert to minutes
      totalMinutes += sessionLength;
    });
    const averageSessionLength = totalMinutes / totalSessions;
    const totalPlayTime = totalMinutes;

    // Calculate participant stats
    const participantMap = new Map<string, Participant>();
    summaries.forEach(summary => {
      summary.participants.forEach((participant: { userId: string; username: string; isDM: boolean }) => {
        if (!participantMap.has(participant.username)) {
          participantMap.set(participant.username, {
            username: participant.username,
            sessionsAttended: 0,
            isDM: participant.isDM
          });
        }
        const stats = participantMap.get(participant.username);
        if (stats) {
          stats.sessionsAttended++;
        }
      });
    });

    const participantStats = Array.from(participantMap.values()).map(participant => ({
      name: participant.username,
      sessionsAttended: participant.sessionsAttended,
      participationRate: participant.sessionsAttended / totalSessions
    }));

    // Calculate monthly session counts
    const monthlySessionCounts = summaries.reduce((acc: MonthlySession[], summary) => {
      const date = new Date(summary.sessionStart);
      const monthYear = date.toLocaleString('default', { month: 'short', year: 'numeric' });
      
      const existingMonth = acc.find((m: MonthlySession) => m.month === monthYear);
      if (existingMonth) {
        existingMonth.sessions++;
      } else {
        acc.push({ month: monthYear, sessions: 1 });
      }
      return acc;
    }, []);

    // Sort monthly sessions chronologically
    monthlySessionCounts.sort((a: MonthlySession, b: MonthlySession) => {
      const [monthA, yearA] = a.month.split(' ');
      const [monthB, yearB] = b.month.split(' ');
      const dateA = new Date(`${monthA} 1, ${yearA}`);
      const dateB = new Date(`${monthB} 1, ${yearB}`);
      return dateA.getTime() - dateB.getTime();
    });

    return NextResponse.json({
      totalSessions,
      averageSessionLength,
      totalPlayTime,
      participantStats,
      monthlySessionCounts
    });
  } catch (error) {
    console.error('Error fetching campaign stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch campaign statistics' },
      { status: 500 }
    );
  }
} 