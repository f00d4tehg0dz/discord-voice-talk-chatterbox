import { NextAuthOptions } from 'next-auth';
import DiscordProvider from 'next-auth/providers/discord';
import { connectDB } from "@/lib/mongodb";
import User from "@/models/User";
import { DiscordAPIGuild, DiscordGuild } from '@/types/discord';

declare module "next-auth" {
  interface Session {
    accessToken?: string;
    guilds?: DiscordGuild[];
  }
  interface JWT {
    accessToken?: string;
    guilds?: DiscordGuild[];
  }
}

if (!process.env.DISCORD_CLIENT_ID) {
  throw new Error('DISCORD_CLIENT_ID is not set');
}

if (!process.env.DISCORD_CLIENT_SECRET) {
  throw new Error('DISCORD_CLIENT_SECRET is not set');
}

if (!process.env.NEXTAUTH_SECRET) {
  throw new Error('NEXTAUTH_SECRET is not set');
}

export const authOptions: NextAuthOptions = {
  providers: [
    DiscordProvider({
      clientId: process.env.DISCORD_CLIENT_ID!,
      clientSecret: process.env.DISCORD_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: 'identify email guilds',
        },
      },
    }),
  ],
  callbacks: {
    async jwt({ token, account }) {
      if (account) {
        token.accessToken = account.access_token;
        
        // Fetch user's guilds using the access token
        try {
          const guildsResponse = await fetch('https://discord.com/api/users/@me/guilds', {
            headers: {
              Authorization: `Bearer ${account.access_token}`,
            },
          });
          
          if (guildsResponse.ok) {
            const guilds: DiscordAPIGuild[] = await guildsResponse.json();
            // Only store minimal guild data to reduce session size
            token.guilds = guilds.map(guild => ({
              id: guild.id,
              name: guild.name,
              owner: guild.owner,
              permissions: guild.permissions
            }));
          }
        } catch (error) {
          console.error('Error fetching guilds:', error);
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.accessToken = token.accessToken as string;
        session.guilds = token.guilds;
      }
      return session;
    },
    async signIn({ user, account }) {
      try {
        await connectDB();
        const existingUser = await User.findOne({ discordId: user.id });
        
        if (!existingUser) {
          await User.create({
            discordId: user.id,
            username: user.name,
            accessToken: account?.access_token,
            refreshToken: account?.refresh_token,
            tokenExpiresAt: account?.expires_at
          });
        } else {
          existingUser.accessToken = account?.access_token;
          existingUser.refreshToken = account?.refresh_token;
          existingUser.tokenExpiresAt = account?.expires_at;
          await existingUser.save();
        }
        
        return true;
      } catch (error) {
        console.error('Error in signIn callback:', error);
        return false;
      }
    }
  },
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  },
  debug: process.env.NODE_ENV === 'development',
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  secret: process.env.NEXTAUTH_SECRET,
}; 