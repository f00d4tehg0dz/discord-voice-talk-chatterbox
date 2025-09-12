'use client';

// import { useEffect, useState } from 'react';
// import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface CampaignStats {
  totalSessions: number;
  averageSessionLength: number;
  totalPlayTime: number;
  participantStats: {
    name: string;
    sessionsAttended: number;
    participationRate: number;
  }[];
  monthlySessionCounts: {
    month: string;
    sessions: number;
  }[];
}

interface CampaignStatsProps {
  campaign: {
    _id: string;
    name: string;
    totalSessions: number;
    lastSessionDate: string;
    characters?: Array<{
      name: string;
      player: string;
      class: string;
      level: number;
    }>;
  };
}

export default function CampaignStats({ campaign }: CampaignStatsProps) {
  // Calculate average party level
  const averageLevel = campaign.characters?.reduce((sum, char) => sum + char.level, 0) || 0;
  const partyLevel = campaign.characters?.length ? Math.floor(averageLevel / campaign.characters.length) : 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Total Sessions */}
      <div className="bg-gray-800 p-4 rounded-lg">
        <h3 className="text-sm font-medium text-gray-400">Total Sessions</h3>
        <p className="text-2xl font-bold text-white mt-1">{campaign.totalSessions}</p>
      </div>

      {/* Last Session */}
      <div className="bg-gray-800 p-4 rounded-lg">
        <h3 className="text-sm font-medium text-gray-400">Last Session</h3>
        <p className="text-2xl font-bold text-white mt-1">
          {campaign.lastSessionDate
            ? new Date(campaign.lastSessionDate).toLocaleDateString()
            : 'N/A'}
        </p>
      </div>

      {/* Party Size */}
      <div className="bg-gray-800 p-4 rounded-lg">
        <h3 className="text-sm font-medium text-gray-400">Party Size</h3>
        <p className="text-2xl font-bold text-white mt-1">
          {campaign.characters?.length || 0}
        </p>
      </div>

      {/* Average Party Level */}
      <div className="bg-gray-800 p-4 rounded-lg">
        <h3 className="text-sm font-medium text-gray-400">Average Level</h3>
        <p className="text-2xl font-bold text-white mt-1">{partyLevel}</p>
      </div>
    </div>
  );
} 