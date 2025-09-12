'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import SummaryDisplay from '@/components/SummaryDisplay';
import Link from 'next/link';

interface Summary {
  _id: string;
  campaignId: {
    _id: string;
    name: string;
  };
  sessionNumber: number;
  sessionStart: string;
  sessionEnd: string;
  decryptedText: string;
  participants: Array<{
    userId: string;
    username: string;
    isDM: boolean;
  }>;
}

interface Campaign {
  _id: string;
  name: string;
}

interface Pagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export default function SummariesPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [summaries, setSummaries] = useState<Summary[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<string>('');
  const [pagination, setPagination] = useState<Pagination>({
    total: 0,
    page: 1,
    limit: 10,
    totalPages: 1
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSummaries = useCallback(async () => {
    try {
      setLoading(true);
      const guildId = session?.guilds?.[0]?.id;
      if (!guildId) {
        setError('No guild selected');
        return;
      }

      console.log('Fetching summaries for guild:', guildId);
      const response = await fetch(
        `/api/summaries?guildId=${guildId}&campaignId=${selectedCampaign}&page=${pagination.page}`,
        {
          headers: {
            'Content-Type': 'application/json',
          },
          cache: 'no-store',
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch summaries');
      }

      const data = await response.json();
      if (!data.summaries || !data.campaigns || !data.pagination) {
        throw new Error('Invalid response format from API');
      }

      setSummaries(data.summaries);
      setCampaigns(data.campaigns);
      setPagination(data.pagination);
      setError(null);
    } catch (err) {
      console.error('Error fetching summaries:', err);
      setError(err instanceof Error ? err.message : 'Failed to load summaries. Please try again later.');
    } finally {
      setLoading(false);
    }
  }, [session, selectedCampaign, pagination.page]);

  useEffect(() => {
    if (session?.guilds?.[0]?.id) {
      fetchSummaries();
    }
  }, [session, selectedCampaign, pagination.page, fetchSummaries]);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/');
    }
  }, [status, router]);

  const handleCampaignChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedCampaign(e.target.value);
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const handlePageChange = (page: number) => {
    setPagination(prev => ({ ...prev, page }));
  };

  if (status === 'loading' || loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">D&D Session Summaries</h1>
          <Link 
            href="/api/auth/signout"
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg"
          >
            Logout
          </Link>
        </div>
        <div className="text-center py-8">
          <p className="text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">D&D Session Summaries</h1>
          <Link 
            href="/api/auth/signout"
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg"
          >
            Logout
          </Link>
        </div>
        <div className="text-center py-8">
          <p className="text-red-500">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">D&D Session Summaries</h1>
        <Link 
          href="/api/auth/signout"
          className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg"
        >
          Logout
        </Link>
      </div>

      {/* Campaign Selector */}
      <div className="mb-6">
        <label htmlFor="campaign-select" className="block text-sm font-medium mb-2">
          Select Campaign
        </label>
        <select
          id="campaign-select"
          value={selectedCampaign}
          onChange={handleCampaignChange}
          className="w-full md:w-64 bg-gray-800 text-white border border-gray-700 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Campaigns</option>
          {campaigns.map((campaign) => (
            <option key={campaign._id} value={campaign._id}>
              {campaign.name}
            </option>
          ))}
        </select>
      </div>
      
      {summaries.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-gray-400">No summaries found for this guild.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {summaries.map((summary) => (
            <div key={summary._id} className="bg-gray-800 rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-2">
                {summary.campaignId?.name || 'Unnamed Campaign'} - Session {summary.sessionNumber}
              </h2>
              <p className="text-gray-400 mb-4">
                {new Date(summary.sessionStart).toLocaleDateString()} - 
                {new Date(summary.sessionEnd).toLocaleDateString()}
              </p>
              <SummaryDisplay 
                text={summary.decryptedText || ''} 
                participants={summary.participants.map(p => ({
                  username: p.username,
                  isDM: p.isDM
                }))}
              />
              <div className="mt-4">
                <h3 className="text-sm font-semibold mb-2">Participants:</h3>
                <div className="flex flex-wrap gap-2">
                  {summary.participants.map((participant) => (
                    <span 
                      key={participant.userId}
                      className={`px-2 py-1 rounded-full text-sm ${
                        participant.isDM ? 'bg-purple-600' : 'bg-gray-700'
                      }`}
                    >
                      {participant.username}
                      {participant.isDM && ' (DM)'}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {pagination.totalPages > 1 && (
        <div className="mt-8 flex justify-center">
          <div className="join">
            {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map((page) => (
              <button
                key={page}
                className={`join-item btn ${page === pagination.page ? 'btn-active' : ''}`}
                onClick={() => handlePageChange(page)}
              >
                {page}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
} 