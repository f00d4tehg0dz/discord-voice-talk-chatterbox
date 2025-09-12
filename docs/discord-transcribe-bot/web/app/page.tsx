'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import { DiscordGuild } from './types/discord';
import { Suspense } from 'react';
import Link from 'next/link';
import { formatTextWithUsernameColors } from '@/lib/colors';
import RealmSelector from '@/components/RealmSelector';
import CampaignSelector from '@/components/CampaignSelector';
import CliffNotesAccordion from '@/components/CliffNotesAccordion';
import SearchFilters from '@/components/SearchFilters';

interface Participant {
  userId: string;
  username: string;
  isDM: boolean;
}

interface SummaryData {
  summaries: Array<{
    _id: string;
    campaignId?: {
      _id: string;
      name: string;
    } | null;
    sessionId?: {
      _id: string;
    } | null;
    sessionNumber: number;
    sessionStart: string;
    participants: Participant[];
    cliffNotes: string;
    summary: string;
    tags?: string[];
  }>;
  page: number;
  totalPages: number;
}

interface Campaign {
  _id: string;
  name: string;
  guildId: string;
  dmUserId: string;
  sessionNumber: number;
  createdAt: string;
  updatedAt: string;
}

interface FilterState {
  search: string;
  startDate: string;
  endDate: string;
  selectedParticipants: string[];
  selectedTags: string[];
}

interface PaginationState {
  page: number;
  limit: number;
}

function MainContent() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const [guilds, setGuilds] = useState<DiscordGuild[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summariesData, setSummariesData] = useState<SummaryData | undefined>(undefined);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [filters, setFilters] = useState<FilterState>({
    search: '',
    startDate: '',
    endDate: '',
    selectedParticipants: [],
    selectedTags: []
  });
  const [pagination, setPagination] = useState<PaginationState>({
    page: parseInt(searchParams.get('page') || '1'),
    limit: parseInt(searchParams.get('limit') || '10')
  });

  // Get search params using useSearchParams
  const guildId = searchParams.get('guildId') || '';
  const campaignId = searchParams.get('campaignId') || '';
  const { page, limit } = pagination;

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
    const fetchData = async () => {
      if (!guildId) return;

      try {
        // Build the search URL with all filters
        const searchParams = new URLSearchParams();
        searchParams.append('guildId', guildId);
        if (campaignId) searchParams.append('campaignId', campaignId);
        if (filters.search) searchParams.append('search', filters.search);
        
        // Format dates to ISO string for consistent handling
        if (filters.startDate) {
          const startDate = new Date(filters.startDate);
          startDate.setHours(0, 0, 0, 0);
          searchParams.append('startDate', startDate.toISOString());
        }
        if (filters.endDate) {
          const endDate = new Date(filters.endDate);
          endDate.setHours(23, 59, 59, 999);
          searchParams.append('endDate', endDate.toISOString());
        }
        
        if (filters.selectedParticipants.length) {
          searchParams.append('participants', filters.selectedParticipants.join(','));
        }
        if (filters.selectedTags.length) {
          searchParams.append('tags', filters.selectedTags.join(','));
        }
        searchParams.append('page', page.toString());
        searchParams.append('limit', limit.toString());

        // Fetch summaries with filters
        const summariesResponse = await fetch(`/api/summaries/search?${searchParams.toString()}`);

        if (!summariesResponse.ok) {
          throw new Error('Failed to fetch data');
        }

        const summariesData = await summariesResponse.json();

        setSummariesData(summariesData);
        setCampaigns(summariesData.campaigns || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      }
    };

    fetchData();
  }, [guildId, campaignId, page, filters]);

  const handleFiltersChange = (newFilters: FilterState) => {
    setFilters(newFilters);
    // Reset to first page when filters change
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  if (!session) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-white mb-4">Welcome to Discord Transcribe DnD</h1>
          <p className="text-gray-300 mb-8">Please sign in to access your DnD session summaries</p>
          <Link href="/api/auth/signin" className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors">
            Sign In
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] py-8 px-4">
      
      {loading ? (
        <div className="text-white text-center">Loading...</div>
      ) : error ? (
        <div className="text-red-500 text-center">{error}</div>
      ) : (
        <div className="max-w-6xl mx-auto">
           <div className="mb-8 bg-[#1a1a1a] p-6 rounded-lg shadow-2xl border border-white/10 backdrop-blur-sm">
          <h1 className="text-3xl font-serif text-white mb-6">Dungeons & Dragons Session Summaries</h1>
          <div className="mb-8 bg-[#1a1a1a] p-6 rounded-lg shadow-2xl border border-white/10 backdrop-blur-sm">
            <label className="block text-white font-serif mb-4">Select Your Realm:</label>
            <RealmSelector 
              guilds={guilds} 
              selectedGuildId={guildId} 
              currentPath="/"
            />
          

          {guildId && (
            <div>
              <label className="block text-white font-serif mb-4">Select Your Campaign:</label>
              <CampaignSelector 
                campaigns={campaigns} 
                selectedCampaignId={campaignId} 
                guildId={guildId} 
              />

 </div>
  )}    </div>          {guildId && summariesData && (
                <div className="mt-8">
                  <SearchFilters
                    participants={Array.from(
                      new Set(
                        summariesData.summaries.flatMap(s => s.participants)
                      )
                    )}
                    onFiltersChange={handleFiltersChange}
                  />
                </div>
              )}
          {summariesData && (
                <div className="mt-8">
                  <h2 className="text-2xl font-bold text-white mb-4">Session Summaries</h2>
                  <div className="space-y-4">
                    {summariesData.summaries.map((summary) => (
                      <div key={summary._id} className="bg-[#1a1a1a] p-6 rounded-lg shadow-2xl border border-white/10 backdrop-blur-sm hover:border-[#8b5cf6]/30 transition-all duration-200">
                        <h3 className="text-xl font-semibold text-white">Session {summary.sessionNumber}</h3>
                        <div className="mt-4">
                          <CliffNotesAccordion 
                            cliffNotes={summary.cliffNotes}
                            summaryId={summary._id}
                          />
                        </div>
                        <div className="mt-4">
                          <div 
                            className="text-gray-300"
                            dangerouslySetInnerHTML={{
                              __html: formatTextWithUsernameColors(summary.summary, summary.participants)
                            }}
                          />
                        </div>
                        {summary.tags && summary.tags.length > 0 && (
                          <div className="mt-4 flex flex-wrap gap-2">
                            {summary.tags.map((tag) => (
                              <span
                                key={tag}
                                className="px-2 py-1 bg-green-600 text-white text-sm rounded-full"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
             
          )}
        </div>
        </div>  )}
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    }>
      <MainContent />
    </Suspense>
  );
}
