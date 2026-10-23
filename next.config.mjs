/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  headers: async () => [
    {
      source: '/(.*)',
      headers: [
        {
          key: 'X-Content-Type-Options',
          value: 'nosniff',
        },
      ],
    },
    {
      // Let deployed service worker updates bypass HTTP caches.
      source: '/sw.js',
      headers: [
        {
          key: 'Cache-Control',
          value: 'no-cache, max-age=0, must-revalidate',
        },
      ],
    },
    {
      source: '/manifest.webmanifest',
      headers: [
        {
          key: 'Cache-Control',
          value: 'public, max-age=3600',
        },
      ],
    },
  ],
  async rewrites() {
    return [
      // Keep old manifest URLs (and already-installed clients) working.
      { source: '/manifest.json', destination: '/manifest.webmanifest' },
    ];
  },
};

export default nextConfig;
