'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Navigation() {
  const pathname = usePathname();

  return (
    <nav className="bg-[#1a1a1a] border-b border-white/10">
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex justify-between h-16">
          <div className="flex">
            <div className="flex space-x-8">
              <Link
                href="/"
                className={`inline-flex items-center px-1 pt-1 text-sm font-medium ${
                  pathname === '/'
                    ? 'text-white border-b-2 border-purple-500'
                    : 'text-gray-300 hover:text-white hover:border-b-2 hover:border-purple-300'
                }`}
              >
                Summaries
              </Link>
              <Link
                href="/stats"
                className={`inline-flex items-center px-1 pt-1 text-sm font-medium ${
                  pathname === '/stats'
                    ? 'text-white border-b-2 border-purple-500'
                    : 'text-gray-300 hover:text-white hover:border-b-2 hover:border-purple-300'
                }`}
              >
                Statistics
              </Link>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
} 