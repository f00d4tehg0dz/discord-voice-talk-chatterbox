'use client';

import { useState } from 'react';

interface CliffNotesRegeneratorProps {
  onRegenerate: (rules: string, campaignId: string, sessionNumber: number) => Promise<void>;
  isLoading: boolean;
  error: string | null;
  campaigns: Array<{
    _id: string;
    name: string;
  }>;
  selectedCampaignId?: string;
  selectedSessionNumber?: number;
}

export default function CliffNotesRegenerator({ 
  onRegenerate, 
  isLoading, 
  error,
  campaigns,
  selectedCampaignId,
  selectedSessionNumber
}: CliffNotesRegeneratorProps) {
  const [rules, setRules] = useState('');
  const [campaignId, setCampaignId] = useState(selectedCampaignId || '');
  const [sessionNumber, setSessionNumber] = useState(selectedSessionNumber || 1);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!campaignId) {
      alert('Please select a campaign');
      return;
    }
    await onRegenerate(rules, campaignId, sessionNumber);
  };

  return (
    <div className="mt-6 bg-[#1a1a1a] p-6 rounded-lg shadow-2xl border border-white/10 backdrop-blur-sm">
      <h2 className="text-2xl font-serif text-white mb-4">Regenerate Cliff Notes</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="campaign" className="block text-white font-serif mb-2">
            Select Campaign
          </label>
          <select
            id="campaign"
            value={campaignId}
            onChange={(e) => setCampaignId(e.target.value)}
            className="w-full bg-[#2a2a2a] text-white border border-white/10 rounded-lg p-4 focus:outline-none focus:ring-2 focus:ring-[#8b5cf6]"
          >
            <option value="">Select a campaign</option>
            {campaigns.map((campaign) => (
              <option key={campaign._id} value={campaign._id}>
                {campaign.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="sessionNumber" className="block text-white font-serif mb-2">
            Session Number
          </label>
          <input
            type="number"
            id="sessionNumber"
            value={sessionNumber}
            onChange={(e) => setSessionNumber(parseInt(e.target.value))}
            min="1"
            className="w-full bg-[#2a2a2a] text-white border border-white/10 rounded-lg p-4 focus:outline-none focus:ring-2 focus:ring-[#8b5cf6]"
          />
        </div>

        <div>
          <label htmlFor="rules" className="block text-white font-serif mb-2">
            Additional Rules for Cliff Notes Generation
          </label>
          <textarea
            id="rules"
            value={rules}
            onChange={(e) => setRules(e.target.value)}
            placeholder="Enter any additional rules or instructions for generating cliff notes..."
            className="w-full h-32 bg-[#2a2a2a] text-white border border-white/10 rounded-lg p-4 focus:outline-none focus:ring-2 focus:ring-[#8b5cf6]"
          />
        </div>

        {error && (
          <div className="text-red-500 text-sm">
            {error}
          </div>
        )}

        <div className="flex items-center justify-between">
          <button
            type="submit"
            disabled={isLoading}
            className={`bg-[#8b5cf6] hover:bg-[#7c3aed] text-white px-6 py-3 rounded-lg font-serif text-lg transition-all duration-200 hover:scale-105 ${
              isLoading ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            {isLoading ? 'Regenerating...' : 'Regenerate Cliff Notes'}
          </button>
        </div>
      </form>
    </div>
  );
} 