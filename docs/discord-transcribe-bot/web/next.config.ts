import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    async headers() {
      return [
        {
          source: '/:path*',
          headers: [
            {
              key: 'X-Frame-Options',
              value: 'DENY',
            },
          ],
        },
      ];
    },
    // Increase the header size limit
    experimental: {
      largePageDataBytes: 128 * 100000, // 128KB
    },
};

export default nextConfig;
