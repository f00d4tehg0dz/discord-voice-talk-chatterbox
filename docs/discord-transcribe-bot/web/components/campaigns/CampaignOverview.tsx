'use client';

import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';

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
}

interface CampaignOverviewProps {
  campaign: Campaign;
}

export default function CampaignOverview({ campaign }: CampaignOverviewProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [description, setDescription] = useState(campaign.description);

  const handleSaveDescription = async () => {
    try {
      const response = await fetch(`/api/campaigns/${campaign._id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ description }),
      });

      if (!response.ok) {
        throw new Error('Failed to update campaign description');
      }

      setIsEditing(false);
    } catch (error) {
      console.error('Error updating campaign:', error);
    }
  };

  return (
    <div className="space-y-6">
      {/* Campaign Header */}
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-2xl font-bold text-white">{campaign.name}</h2>
          <p className="text-gray-400 text-sm">
            Created {formatDistanceToNow(new Date(campaign.createdAt))} ago
          </p>
        </div>
        <button
          onClick={() => setIsEditing(!isEditing)}
          className="text-purple-500 hover:text-purple-400"
        >
          {isEditing ? 'Cancel' : 'Edit Description'}
        </button>
      </div>

      {/* Campaign Description */}
      <div className="bg-gray-800 rounded-lg p-4">
        {isEditing ? (
          <div className="space-y-4">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full h-32 bg-gray-700 text-white rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="Enter campaign description..."
            />
            <button
              onClick={handleSaveDescription}
              className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors"
            >
              Save Description
            </button>
          </div>
        ) : (
          <p className="text-gray-300 whitespace-pre-wrap">{description || 'No description available.'}</p>
        )}
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gray-800 rounded-lg p-4">
          <h3 className="text-gray-400 text-sm">Total Sessions</h3>
          <p className="text-2xl font-bold text-white">{campaign.totalSessions}</p>
        </div>
        <div className="bg-gray-800 rounded-lg p-4">
          <h3 className="text-gray-400 text-sm">Last Session</h3>
          <p className="text-2xl font-bold text-white">
            {campaign.lastSessionDate
              ? formatDistanceToNow(new Date(campaign.lastSessionDate)) + ' ago'
              : 'Never'}
          </p>
        </div>
        <div className="bg-gray-800 rounded-lg p-4">
          <h3 className="text-gray-400 text-sm">Next Session</h3>
          <p className="text-2xl font-bold text-white">
            {campaign.nextSessionDate
              ? formatDistanceToNow(new Date(campaign.nextSessionDate)) + ' from now'
              : 'Not scheduled'}
          </p>
        </div>
      </div>
    </div>
  );
} 