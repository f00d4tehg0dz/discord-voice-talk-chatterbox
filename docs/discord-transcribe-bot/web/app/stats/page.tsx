'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import { DiscordGuild } from '../types/discord';
import { Suspense } from 'react';
import Link from 'next/link';
import RealmSelector from '@/components/RealmSelector';
import CampaignSelector from '@/components/CampaignSelector';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface Campaign {
  _id: string;
  name: string;
  guildId: string;
  dmUserId: string;
}

interface CampaignStats {
  totalSessions: number;
  averageSessionLength: number;
  totalPlayTime: number;
  participantStats: Array<{
    name: string;
    sessionsAttended: number;
    participationRate: number;
  }>;
  monthlySessionCounts: Array<{
    month: string;
    sessions: number;
  }>;
}

function StatsContent() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const [guilds, setGuilds] = useState<DiscordGuild[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [stats, setStats] = useState<CampaignStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Get search params using useSearchParams
  const guildId = searchParams.get('guildId') || '';
  const campaignId = searchParams.get('campaignId') || '';

  useEffect(() => {
    const fetchGuilds = async () => {
      try {
        const response = await fetch('/api/guilds');
        if (!response.ok) {
          throw new Error('Failed to fetch guilds');
        }
        const data = await response.json();
        setGuilds(data.guilds);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    if (session) {
      fetchGuilds();
    }
  }, [session]);

  useEffect(() => {
    const fetchCampaigns = async () => {
      if (!guildId) {
        setCampaigns([]);
        return;
      }

      try {
        const response = await fetch(`/api/campaigns?guildId=${guildId}`);
        if (!response.ok) {
          throw new Error('Failed to fetch campaigns');
        }
        const data = await response.json();
        setCampaigns(data.campaigns);
      } catch (err) {
        console.error('Error fetching campaigns:', err);
        setCampaigns([]);
      }
    };

    fetchCampaigns();
  }, [guildId]);

  useEffect(() => {
    const fetchStats = async () => {
      if (!campaignId) {
        setStats(null);
        return;
      }

      try {
        setLoading(true);
        const response = await fetch(`/api/campaigns/${campaignId}/stats`);
        if (!response.ok) {
          throw new Error('Failed to fetch campaign stats');
        }
        const data = await response.json();
        setStats(data);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
        setStats(null);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [campaignId]);

  if (!session) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-white mb-4">Welcome to Discord Transcribe DnD</h1>
          <p className="text-gray-300 mb-8">Please sign in to view campaign statistics</p>
          <Link href="/api/auth/signin" className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors">
            Sign In
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] py-8 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8 bg-[#1a1a1a] p-6 rounded-lg shadow-2xl border border-white/10 backdrop-blur-sm">
          <h1 className="text-3xl font-serif text-white mb-6">Campaign Statistics</h1>
          
          {/* Realm and Campaign Selectors */}
          <div className="mb-8 space-y-6">
            <div>
              <label className="block text-white font-serif mb-4">Select Your Realm:</label>
              <RealmSelector 
                guilds={guilds} 
                selectedGuildId={guildId} 
                currentPath="/stats"
              />
            </div>

            {guildId && (
              <div>
                <label className="block text-white font-serif mb-4">Select Your Campaign:</label>
                <CampaignSelector 
                  campaigns={campaigns} 
                  selectedCampaignId={campaignId} 
                  guildId={guildId}
                  currentPath="/stats"
                />
              </div>
            )}
          </div>

          {/* Stats Display */}
          {loading ? (
            <div className="text-white text-center py-8">Loading statistics...</div>
          ) : error ? (
            <div className="text-red-500 text-center py-8">{error}</div>
          ) : stats ? (
            <div className="space-y-8">
              {/* Overview Stats */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-gray-800 rounded-lg p-6">
                  <h3 className="text-gray-400 text-sm mb-2">Total Sessions</h3>
                  <p className="text-3xl font-bold text-white">{stats.totalSessions}</p>
                </div>
                <div className="bg-gray-800 rounded-lg p-6">
                  <h3 className="text-gray-400 text-sm mb-2">Average Session Length</h3>
                  <p className="text-3xl font-bold text-white">
                    {Math.round(stats.averageSessionLength)} min
                  </p>
                </div>
                <div className="bg-gray-800 rounded-lg p-6">
                  <h3 className="text-gray-400 text-sm mb-2">Total Play Time</h3>
                  <p className="text-3xl font-bold text-white">
                    {Math.round(stats.totalPlayTime / 60)} hrs
                  </p>
                </div>
              </div>

              {/* Participant Stats */}
              <div className="bg-gray-800 rounded-lg p-6">
                <h3 className="text-xl font-semibold text-white mb-4">Participant Stats</h3>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="text-left text-gray-400">
                        <th className="pb-3">Participant</th>
                        <th className="pb-3">Sessions Attended</th>
                        <th className="pb-3">Participation Rate</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.participantStats.map((participant) => (
                        <tr key={participant.name} className="border-t border-gray-700">
                          <td className="py-3 text-white">{participant.name}</td>
                          <td className="py-3 text-white">{participant.sessionsAttended}</td>
                          <td className="py-3 text-white">
                            {Math.round(participant.participationRate * 100)}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Monthly Sessions Chart */}
              <div className="bg-gray-800 rounded-lg p-6">
                <h3 className="text-xl font-semibold text-white mb-4">Sessions per Month</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats.monthlySessionCounts}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis dataKey="month" stroke="#9CA3AF" />
                      <YAxis stroke="#9CA3AF" />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#1F2937',
                          border: 'none',
                          borderRadius: '0.5rem',
                          color: '#fff',
                        }}
                      />
                      <Bar dataKey="sessions" fill="#8B5CF6" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-gray-400 text-center py-8">
              Select a campaign to view statistics
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function StatsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    }>
      <StatsContent />
    </Suspense>
  );
} 