import type { MetadataRoute } from 'next';

/**
 * Served by Next.js at /manifest.webmanifest with the correct
 * `application/manifest+json` content type (Safari is picky about this).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'Meow Moments',
    short_name: 'Meow',
    description:
      'Share moments with your special someone through photos and voice messages',
    lang: 'en',
    dir: 'ltr',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#FFF5F7',
    theme_color: '#FF6B9D',
    categories: ['photo', 'social', 'lifestyle'],
    icons: [
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
    shortcuts: [
      {
        name: 'Open the feed',
        short_name: 'Feed',
        description: 'See the latest moments',
        url: '/feed',
        icons: [
          {
            src: '/icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
        ],
      },
    ],
  };
}
