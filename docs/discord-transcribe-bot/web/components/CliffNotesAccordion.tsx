'use client';

import { useState } from 'react';
import CliffNotesRegeneratorWrapper from './CliffNotesRegeneratorWrapper';

interface CliffNotesAccordionProps {
  cliffNotes: string;
  summaryId: string;
}

export default function CliffNotesAccordion({ cliffNotes: initialCliffNotes, summaryId }: CliffNotesAccordionProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentCliffNotes, setCurrentCliffNotes] = useState(initialCliffNotes);

  const handleRegenerateSuccess = (newCliffNotes: string) => {
    setCurrentCliffNotes(newCliffNotes);
  };

  return (
    <div className="border border-gray-700 rounded-lg overflow-hidden">
      <button
        className="w-full px-4 py-2 text-left bg-gray-800 hover:bg-gray-700 transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex justify-between items-center">
          <span className="text-white font-medium">Cliff Notes</span>
          <span className="text-gray-400">
            {isOpen ? '▼' : '▶'}
          </span>
        </div>
      </button>
      {isOpen && (
        <div className="p-4 bg-gray-900">
          <div className="text-gray-300 whitespace-pre-wrap">
            {currentCliffNotes}
          </div>
          <div className="mt-4">
            <CliffNotesRegeneratorWrapper 
              summaryId={summaryId} 
              onRegenerateSuccess={handleRegenerateSuccess}
            />
          </div>
        </div>
      )}
    </div>
  );
} 