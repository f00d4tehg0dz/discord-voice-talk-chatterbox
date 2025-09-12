'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

interface Participant {
  userId: string;
  username: string;
  isDM: boolean;
}

interface SearchFiltersProps {
  participants: Participant[];
  onFiltersChange: (filters: FilterState) => void;
}

interface FilterState {
  search: string;
  startDate: string;
  endDate: string;
  selectedParticipants: string[];
  selectedTags: string[];
}

export default function SearchFilters({ participants, onFiltersChange }: SearchFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [filters, setFilters] = useState<FilterState>({
    search: searchParams.get('search') || '',
    startDate: searchParams.get('startDate') || '',
    endDate: searchParams.get('endDate') || '',
    selectedParticipants: searchParams.get('participants')?.split(',').filter(Boolean) || [],
    selectedTags: searchParams.get('tags')?.split(',').filter(Boolean) || []
  });

  // Common tags for D&D sessions
//   const commonTags = [
//     'Combat', 'Roleplay', 'Exploration', 'Story', 'Boss Fight',
//     'Quest Start', 'Quest End', 'Level Up', 'Shopping', 'Travel'
//   ];

  const handleInputChange = (field: keyof FilterState, value: string | string[]) => {
    const newFilters = { ...filters, [field]: value };
    setFilters(newFilters);
    onFiltersChange(newFilters);
    
    // Update URL params
    const params = new URLSearchParams(searchParams.toString());
    if (Array.isArray(value)) {
      if (value.length > 0) {
        params.set(field, value.join(','));
      } else {
        params.delete(field);
      }
    } else {
      if (value) {
        params.set(field, value);
      } else {
        params.delete(field);
      }
    }
    router.push(`?${params.toString()}`);
  };

  const toggleParticipant = (userId: string) => {
    const newParticipants = filters.selectedParticipants.includes(userId)
      ? filters.selectedParticipants.filter(id => id !== userId)
      : [...filters.selectedParticipants, userId];
    handleInputChange('selectedParticipants', newParticipants);
  };

//   const toggleTag = (tag: string) => {
//     const newTags = filters.selectedTags.includes(tag)
//       ? filters.selectedTags.filter(t => t !== tag)
//       : [...filters.selectedTags, tag];
//     handleInputChange('selectedTags', newTags);
//   };

  return (
    <div className="space-y-4 bg-[#1a1a1a] p-6 rounded-lg shadow-xl border border-white/10">
      {/* Search Input */}
      <div>
        <label htmlFor="search" className="block text-sm font-medium text-gray-300 mb-2">
          Search Summaries
        </label>
        <input
          type="text"
          id="search"
          placeholder="Search by content..."
          value={filters.search}
          onChange={(e) => handleInputChange('search', e.target.value)}
          className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Date Range */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="startDate" className="block text-sm font-medium text-gray-300 mb-2">
            Start Date
          </label>
          <input
            type="date"
            id="startDate"
            value={filters.startDate}
            onChange={(e) => handleInputChange('startDate', e.target.value)}
            className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label htmlFor="endDate" className="block text-sm font-medium text-gray-300 mb-2">
            End Date
          </label>
          <input
            type="date"
            id="endDate"
            value={filters.endDate}
            onChange={(e) => handleInputChange('endDate', e.target.value)}
            className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Participants Filter */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Filter by Participants
        </label>
        <div className="flex flex-wrap gap-2">
          {participants.map((participant) => (
            <button
              key={participant.userId}
              onClick={() => toggleParticipant(participant.userId)}
              className={`px-3 py-1 rounded-full text-sm transition-colors ${
                filters.selectedParticipants.includes(participant.userId)
                  ? participant.isDM
                    ? 'bg-purple-600 text-white'
                    : 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {participant.username}
              {participant.isDM && ' (DM)'}
            </button>
          ))}
        </div>
      </div>

      {/* Tags */}
      {/* <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Filter by Tags
        </label>
        <div className="flex flex-wrap gap-2">
          {commonTags.map((tag) => (
            <button
              key={tag}
              onClick={() => toggleTag(tag)}
              className={`px-3 py-1 rounded-full text-sm transition-colors ${
                filters.selectedTags.includes(tag)
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>*/}
    </div>
  );
} 