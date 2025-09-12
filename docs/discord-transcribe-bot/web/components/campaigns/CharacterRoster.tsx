interface CharacterRosterProps {
  campaign: {
    _id: string;
    characters: Array<{
      name: string;
      player: string;
      class: string;
      race: string;
      level: number;
      isActive: boolean;
    }>;
  };
}

export default function CharacterRoster({ campaign }: CharacterRosterProps) {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-white">Character Roster</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {campaign.characters?.map((character, index) => (
          <div
            key={`${character.name}-${index}`}
            className={`p-4 rounded-lg ${
              character.isActive ? 'bg-gray-800' : 'bg-gray-900 opacity-60'
            }`}
          >
            <h3 className="text-lg font-medium text-white">{character.name}</h3>
            <p className="text-gray-400">Player: {character.player}</p>
            <p className="text-gray-400">
              {character.race} {character.class} (Level {character.level})
            </p>
            <span
              className={`inline-block px-2 py-1 mt-2 text-xs rounded ${
                character.isActive
                  ? 'bg-green-900 text-green-200'
                  : 'bg-red-900 text-red-200'
              }`}
            >
              {character.isActive ? 'Active' : 'Inactive'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
} 