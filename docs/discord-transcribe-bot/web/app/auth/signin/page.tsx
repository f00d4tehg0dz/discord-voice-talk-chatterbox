'use client';

import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, Suspense } from 'react';

function SignInContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/';

  useEffect(() => {
    signIn('discord', { callbackUrl });
  }, [callbackUrl, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a]">
      <div className="text-center p-8 bg-[#1a1a1a] rounded-lg shadow-2xl border border-white/10 backdrop-blur-sm">
        <h1 className="text-3xl font-serif text-white mb-6">Signing in with Discord...</h1>
        <p className="text-white/80">Please wait while we redirect you to Discord for authentication.</p>
      </div>
    </div>
  );
}

export default function SignIn() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a]">
        <div className="text-center p-8 bg-[#1a1a1a] rounded-lg shadow-2xl border border-white/10 backdrop-blur-sm">
          <h1 className="text-3xl font-serif text-white mb-6">Loading...</h1>
        </div>
      </div>
    }>
      <SignInContent />
    </Suspense>
  );
} 