import React from 'react';
import { formatTextWithUsernameColors } from '@/lib/colors';

interface SummaryDisplayProps {
  text: string;
  participants: Array<{
    username: string;
    isDM: boolean;
  }>;
  className?: string;
}

export default function SummaryDisplay({ text, participants, className = '' }: SummaryDisplayProps) {
  const formattedText = formatTextWithUsernameColors(text, participants);

  return (
    <div 
      className={`prose prose-invert max-w-none ${className}`}
      dangerouslySetInnerHTML={{ __html: formattedText }}
    />
  );
} 