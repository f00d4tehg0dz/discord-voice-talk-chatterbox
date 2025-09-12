'use client';

import { useRouter } from 'next/navigation';

interface RealmSelectorProps {
  guilds: Array<{
    id: string;
    name: string;
  }>;
  selectedGuildId?: string;
  currentPath?: string;
}

export default function RealmSelector({ guilds, selectedGuildId, currentPath = '/' }: RealmSelectorProps) {
  const router = useRouter();

  return (
    <select
      className="w-full p-2 rounded-lg border border-white/20 bg-[#2a2a2a] font-serif text-white focus:ring-2 focus:ring-[#8b5cf6]/50 focus:border-transparent transition-all duration-200 hover:border-[#8b5cf6]/30"
      onChange={(e) => {
        const selectedGuildId = e.target.value;
        if (selectedGuildId) {
          router.push(`${currentPath}?guildId=${selectedGuildId}`);
        } else {
          router.push(currentPath);
        }
      }}
      value={selectedGuildId || ''}
    >
      <option value="">Choose a realm...</option>
      {guilds.map((guild) => (
        <option key={guild.id} value={guild.id}>
          {guild.name}
        </option>
      ))}
    </select>
  );
} 