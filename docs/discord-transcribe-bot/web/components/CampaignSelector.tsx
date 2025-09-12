'use client';

import { useRouter } from 'next/navigation';

interface Campaign {
  _id: string;
  name: string;
}

interface CampaignSelectorProps {
  campaigns: Campaign[];
  selectedCampaignId?: string;
  guildId: string;
  currentPath?: string;
}

export default function CampaignSelector({ campaigns, selectedCampaignId, guildId, currentPath = '/' }: CampaignSelectorProps) {
  const router = useRouter();

  const handleCampaignChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newCampaignId = e.target.value;
    const url = newCampaignId 
      ? `${currentPath}?guildId=${guildId}&campaignId=${newCampaignId}`
      : `${currentPath}?guildId=${guildId}`;
    router.push(url);
  };

  return (
    <select
      className="w-full p-2 rounded-lg border border-white/20 bg-[#2a2a2a] font-serif text-white focus:ring-2 focus:ring-[#8b5cf6]/50 focus:border-transparent transition-all duration-200 hover:border-[#8b5cf6]/30"
      value={selectedCampaignId || ''}
      onChange={handleCampaignChange}
    >
      <option value="">All Campaigns</option>
      {campaigns?.map((campaign) => (
        <option key={campaign._id} value={campaign._id}>
          {campaign.name}
        </option>
      ))}
    </select>
  );
} 