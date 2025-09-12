import 'next-auth';

declare module 'next-auth' {
  interface Session {
    accessToken?: string;
    guilds?: Array<{
      id: string;
      name: string;
      owner: boolean;
      permissions: string;
    }>;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    accessToken?: string;
    guilds?: Array<{
      id: string;
      name: string;
      owner: boolean;
      permissions: string;
    }>;
  }
}

declare module 'next-auth/providers/discord' {
  interface Profile {
    guilds?: Array<{
      id: string;
      name: string;
      owner: boolean;
      permissions: string;
    }>;
  }
} 