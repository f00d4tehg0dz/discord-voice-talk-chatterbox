# DnD Session Summary Web App

A web application for viewing DnD session summaries stored by the Discord bot. The app uses Discord authentication to ensure users can only access summaries from servers they are members of.

## Features

- Discord authentication
- View summaries by server
- Beautifully formatted summaries with participant information
- Responsive design

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create a `.env.local` file with the following variables:
```
MONGODB_URI=your_mongodb_connection_string
DISCORD_CLIENT_ID=your_discord_client_id
DISCORD_CLIENT_SECRET=your_discord_client_secret
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your_nextauth_secret
```

3. Set up a Discord application:
   - Go to the [Discord Developer Portal](https://discord.com/developers/applications)
   - Create a new application
   - Go to the OAuth2 section
   - Add `http://localhost:3000/api/auth/callback/discord` to the Redirects
   - Copy the Client ID and Client Secret to your `.env.local` file

4. Generate a random string for NEXTAUTH_SECRET:
```bash
openssl rand -base64 32
```

5. Start the development server:
```bash
npm run dev
```

## Environment Variables

- `MONGODB_URI`: Your MongoDB connection string
- `DISCORD_CLIENT_ID`: Your Discord application client ID
- `DISCORD_CLIENT_SECRET`: Your Discord application client secret
- `NEXTAUTH_URL`: The URL of your application (http://localhost:3000 for development)
- `NEXTAUTH_SECRET`: A random string used to encrypt the session

## Technologies Used

- Next.js
- NextAuth.js
- MongoDB
- Tailwind CSS
- TypeScript

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
