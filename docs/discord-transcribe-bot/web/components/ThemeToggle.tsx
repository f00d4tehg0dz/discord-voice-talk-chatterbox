'use client';

import { useTheme } from '../app/providers';

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  
  return (
    <button
      onClick={toggleTheme}
      className="fixed bottom-4 right-4 p-2 rounded-full bg-[var(--secondary)] text-[var(--secondary-foreground)] hover:bg-[var(--accent)] transition-colors"
      aria-label="Toggle theme"
    >
      {theme === 'dark' ? '🌞' : '🌙'}
    </button>
  );
} 