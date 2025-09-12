'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import CampaignOverview from '@/components/campaigns/CampaignOverview';
import CampaignTimeline from '@/components/campaigns/CampaignTimeline';
import CharacterRoster from '@/components/campaigns/CharacterRoster';
import CampaignNotes from '@/components/campaigns/CampaignNotes';
import SessionScheduler from '@/components/campaigns/SessionScheduler';
import CampaignStats from '@/components/campaigns/CampaignStats';

interface Campaign {
  _id: string;
  name: string;
  description: string;
  dmId: string;
  createdAt: string;
  updatedAt: string;
  totalSessions: number;
  lastSessionDate: string;
  nextSessionDate?: string;
  characters: Array<{
    name: string;
    player: string;
    class: string;
    race: string;
    level: number;
    isActive: boolean;
  }>;
  notes: Array<{
    _id: string;
    title: string;
    content: string;
    category: string;
    createdAt: string;
    updatedAt: string;
  }>;
  sessions: Array<{
    _id: string;
    date: string;
    title: string;
    summary: string;
    participants: Array<{
      userId: string;
      username: string;
      isDM: boolean;
    }>;
  }>;
}

function CampaignsContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/');
      return;
    }

    const fetchCampaigns = async () => {
      try {
        const guildId = searchParams.get('guildId');
        if (!guildId) {
          setError('No guild selected');
          return;
        }

        const response = await fetch(`/api/campaigns?guildId=${guildId}`);
        if (!response.ok) {
          throw new Error('Failed to fetch campaigns');
        }

        const data = await response.json();
        setCampaigns(data.campaigns);

        // Set selected campaign if ID is in URL
        const campaignId = searchParams.get('campaignId');
        if (campaignId) {
          const campaign = data.campaigns.find((c: Campaign) => c._id === campaignId);
          setSelectedCampaign(campaign || null);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchCampaigns();
  }, [session, router, status, searchParams]);

  const handleCampaignSelect = (campaign: Campaign) => {
    setSelectedCampaign(campaign);
    const params = new URLSearchParams(searchParams.toString());
    params.set('campaignId', campaign._id);
    router.push(`?${params.toString()}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] p-8">
        <div className="text-white text-center">Loading campaigns...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] p-8">
        <div className="text-red-500 text-center">{error}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-white">Campaign Management</h1>
          <button
            onClick={() => router.push('/campaigns/new')}
            className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors"
          >
            Create New Campaign
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Campaign List Sidebar */}
          <div className="lg:col-span-1 bg-[#1a1a1a] p-6 rounded-lg border border-white/10">
            <h2 className="text-xl font-semibold text-white mb-4">Your Campaigns</h2>
            <div className="space-y-2">
              {campaigns.map((campaign) => (
                <button
                  key={campaign._id}
                  onClick={() => handleCampaignSelect(campaign)}
                  className={`w-full text-left px-4 py-2 rounded-lg transition-colors ${
                    selectedCampaign?._id === campaign._id
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                  }`}
                >
                  {campaign.name}
                </button>
              ))}
            </div>
          </div>

          {/* Main Content Area */}
          <div className="lg:col-span-3">
            {selectedCampaign ? (
              <div className="bg-[#1a1a1a] rounded-lg border border-white/10">
                {/* Navigation Tabs */}
                <div className="border-b border-white/10">
                  <nav className="flex">
                    {['overview', 'timeline', 'characters', 'notes', 'schedule'].map((tab) => (
                      <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`px-6 py-3 text-sm font-medium ${
                          activeTab === tab
                            ? 'text-purple-500 border-b-2 border-purple-500'
                            : 'text-gray-400 hover:text-gray-300'
                        }`}
                      >
                        {tab.charAt(0).toUpperCase() + tab.slice(1)}
                      </button>
                    ))}
                  </nav>
                </div>

                {/* Tab Content */}
                <div className="p-6">
                  {activeTab === 'overview' && (
                    <div className="space-y-6">
                      <CampaignOverview campaign={selectedCampaign} />
                      <CampaignStats campaign={selectedCampaign} />
                    </div>
                  )}
                  {activeTab === 'timeline' && (
                    <CampaignTimeline campaign={selectedCampaign} />
                  )}
                  {activeTab === 'characters' && (
                    <CharacterRoster campaign={selectedCampaign} />
                  )}
                  {activeTab === 'notes' && (
                    <CampaignNotes campaign={selectedCampaign} />
                  )}
                  {activeTab === 'schedule' && (
                    <SessionScheduler campaign={selectedCampaign} />
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-[#1a1a1a] p-6 rounded-lg border border-white/10 text-center text-gray-400">
                Select a campaign or create a new one to get started
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CampaignsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0a0a0a] p-8">
        <div className="text-white text-center">Loading campaigns...</div>
      </div>
    }>
      <CampaignsContent />
    </Suspense>
  );
} 