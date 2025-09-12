// Function to generate a consistent color for a username
export function getUsernameColor(username: string, isDM: boolean = false): string {
  if (isDM) {
    // Return a distinct purple color for DMs
    return '#8b5cf6'; // Using a fixed purple color for DMs
  }

  // Create a simple hash of the username
  let hash = 0;
  for (let i = 0; i < username.length; i++) {
    hash = username.charCodeAt(i) + ((hash << 5) - hash);
  }

  // Convert hash to a color using a predefined palette of visible colors
  const colors = [
    '#3b82f6', // blue
    '#10b981', // green
    '#f59e0b', // amber
    '#ef4444', // red
    '#ec4899', // pink
    '#14b8a6', // teal
    '#f97316', // orange
    '#06b6d4', // cyan
    '#a855f7', // violet
  ];

  return colors[Math.abs(hash) % colors.length];
}

// Function to format text with username colors
export function formatTextWithUsernameColors(text: string | undefined | null, participants: Array<{username: string, isDM: boolean}>): string {
  // Return empty string if text is undefined or null
  if (!text) {
    return '';
  }
  
  let formattedText = text;
  
  // First handle DMs with their specific color
  const dmParticipants = participants.filter(p => p.isDM);
  dmParticipants.forEach(participant => {
    const color = getUsernameColor(participant.username, true);
    const regex = new RegExp(`\\*\\*${participant.username.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} \\(DM\\)\\*\\*`, 'g');
    formattedText = formattedText.replace(
      regex,
      `<span style="color: ${color}; font-weight: bold;">${participant.username} (DM)</span>`
    );
  });

  // Then handle regular users
  const regularParticipants = participants.filter(p => !p.isDM);
  regularParticipants.forEach(participant => {
    const color = getUsernameColor(participant.username, false);
    const regex = new RegExp(`\\*\\*${participant.username.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\*\\*`, 'g');
    formattedText = formattedText.replace(
      regex,
      `<span style="color: ${color}; font-weight: bold;">${participant.username}</span>`
    );
  });

  // Then handle any remaining bold text that isn't a username
  formattedText = formattedText.replace(
    /\*\*(.*?)\*\*/g,
    '<strong>$1</strong>'
  );

  // Handle newlines
  formattedText = formattedText.replace(/\n/g, '<br>');

  return formattedText;
} 