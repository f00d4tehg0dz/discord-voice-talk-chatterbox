// Discord API guild interface
export interface DiscordAPIGuild {
  id: string;
  name: string;
  icon: string | null;
  owner: boolean;
  permissions: string;
  features: string[];
}

// Minimal guild interface for session storage
export interface DiscordGuild {
  id: string;
  name: string;
} 