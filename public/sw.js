/*
 * Meow Moments service worker.
 *
 * Bump CACHE_VERSION whenever the precache list or caching rules change.
 * Cached HTML is deliberately avoided: pages are server-rendered per session,
 * so navigations are network-first and fall back to /offline.html.
 */

const CACHE_VERSION = 'v2';
const CACHE_NAME = `meow-moments-${CACHE_VERSION}`;

const PRECACHE = [
  '/offline.html',
  '/manifest.json',
  '/icons/icon.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-512.png',
  '/icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith('meow-moments-') && key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (response.ok) await cache.put(request, response.clone());
  return response;
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);

  const network = fetch(request)
    .then(async (response) => {
      const cacheControl = response.headers.get('cache-control') || '';
      if (response.ok && !cacheControl.includes('no-store')) {
        await cache.put(request, response.clone());
      }
      return response;
    })
    .catch(
      () =>
        cached ||
        new Response('Offline', {
          status: 503,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        })
    );

  return cached || network;
}

async function networkFirstNavigation(request) {
  try {
    return await fetch(request);
  } catch {
    const cache = await caches.open(CACHE_NAME);
    const offline = await cache.match('/offline.html');
    return (
      offline ||
      new Response('You are offline.', {
        status: 503,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      })
    );
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Never intercept uploads/deletes and other mutations.
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // API responses are private and must never be cached.
  if (url.pathname.startsWith('/api/')) return;

  // React Server Component payloads for the App Router: always network-only.
  // Caching these would serve stale trees and break client navigation.
  if (request.headers.get('RSC') === '1' || url.searchParams.has('_rsc')) {
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  // Hashed, immutable build output.
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Manifest, icons, fonts and other same-origin static files.
  event.respondWith(staleWhileRevalidate(request));
});
