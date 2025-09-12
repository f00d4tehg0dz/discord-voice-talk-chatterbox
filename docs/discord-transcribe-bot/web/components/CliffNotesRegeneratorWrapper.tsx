'use client';

import { useState } from 'react';

interface CliffNotesRegeneratorWrapperProps {
  summaryId: string;
  onRegenerateSuccess?: (newCliffNotes: string) => void;
}

export default function CliffNotesRegeneratorWrapper({ summaryId, onRegenerateSuccess }: CliffNotesRegeneratorWrapperProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rules, setRules] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/summaries/regenerate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          summaryId,
          rules,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to regenerate cliff notes');
      }

      const data = await response.json();
      if (data.success && data.cliffNotes) {
        // Call the success callback with new cliff notes
        onRegenerateSuccess?.(data.cliffNotes);
        // Clear the rules input
        setRules('');
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      console.error('Error regenerating cliff notes:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="rules" className="block text-sm font-medium text-gray-300 mb-2">
          Additional Rules (Optional)
        </label>
        <textarea
          id="rules"
          value={rules}
          onChange={(e) => setRules(e.target.value)}
          className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
          rows={3}
          placeholder="Enter any additional rules for generating cliff notes..."
        />
      </div>
      {error && (
        <div className="text-red-500 text-sm">
          {error}
        </div>
      )}
      <button
        type="submit"
        disabled={loading}
        className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? 'Regenerating...' : 'Regenerate Cliff Notes'}
      </button>
    </form>
  );
} 