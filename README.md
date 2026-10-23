# Meow Moments

A tiny private space for two people to share photos and voice notes.

Built on Next.js 16 (App Router) and React 19.

## Feed

Moments arrive as a pile of cards in the centre of the screen. The oldest
unseen moment sits on top; swipe it left or right (or use the arrow buttons /
arrow keys) to clear it. Clearing is permanent and shared: the moment is
deleted from the server and its media file is removed, so it will never appear
again for either person. A sender can also delete their own moment with the
trash button on the card.

## Requirements

- Node.js 24 (see `.nvmrc`; the Docker image ships `node:24-alpine`).
- A browser that supports the Next.js 16 + Tailwind CSS 4 baseline:
  Chrome/Edge 111+, Firefox 128+, Safari 16.4+.

## Access model

- Two fixed accounts: `user1` and `user2`.
- Sign in with a username and password. Usernames come from
  `MEOW_USER1_USERNAME` / `MEOW_USER2_USERNAME` and fall back to the display
  name when omitted; passwords come from the `MEOW_USERx_PASSCODE` variables.
- Signing in sets a signed, `HttpOnly` session cookie (30 days).
- Every API route and page checks the session on the server.
- A moment can only be deleted by the account that created it. The sender id is
  taken from the session, never from the request body.

## Deploy with Docker Compose

```bash
cp .env.example .env
```

Edit `.env`:

| Variable | Notes |
| --- | --- |
| `SESSION_SECRET` | At least 32 chars. Generate with `openssl rand -hex 32`. Changing it logs everyone out. |
| `MEOW_USER1_NAME` / `MEOW_USER2_NAME` | Display names, shown in the app. |
| `MEOW_USER1_USERNAME` / `MEOW_USER2_USERNAME` | Optional login usernames (min 3 chars, unique). Defaults to the display name. |
| `MEOW_USER1_PASSCODE` / `MEOW_USER2_PASSCODE` | Login passwords. Minimum 6 chars. |
| `MEOW_DATA_DIR` | Optional. Where media and `moments.json` are stored. Compose sets it to `/app/data`. |

Then:

```bash
docker compose up -d --build
docker compose logs -f web
```

The app listens on `http://localhost:3000`. Put it behind a TLS-terminating
reverse proxy (Caddy, Traefik, nginx + Let's Encrypt) **before** sharing the URL:
camera and microphone access in browsers requires HTTPS.

### Data

Uploaded photos and voice notes plus `moments.json` live in the `meow-data`
Docker volume, mounted at `/app/data`. This volume is the only copy of the data:

```bash
# Back it up
docker run --rm -v meow-data:/data -v "$PWD":/backup alpine \
  tar czf /backup/meow-data-$(date +%F).tar.gz -C /data .

# Restore
docker run --rm -v meow-data:/data -v "$PWD":/backup alpine \
  sh -c "rm -rf /data/* && tar xzf /backup/meow-data-YYYY-MM-DD.tar.gz -C /data"
```

### Health

`GET /api/health` returns `{"status":"ok"}` (no auth). Compose uses it for the
container healthcheck.

## Install as an app (PWA)

The app is installable from Chrome/Edge (desktop and Android) and from
**Safari on iOS/iPadOS**. Installation requires HTTPS (or `localhost`), because
service workers and camera/microphone access are only available in secure
contexts.

- **Chrome/Edge/Android** — use the install button in the address bar, the
  `Install` button in the app, or the browser menu.
- **iOS/iPadOS** — **Safari is the only browser that can add web apps to the
  Home Screen.** Open the site in Safari (not Chrome, Firefox, Edge, or an
  in-app browser such as Instagram/WhatsApp), then:

  1. Tap the **Share** button (square with an up arrow).
  2. Scroll down and tap **Add to Home Screen**.
  3. Tap **Add**.

  This is not available in Private Browsing tabs. If you added the app before a
  fix was deployed, delete the old Home Screen icon and add it again so iOS
  re-reads the manifest and icons.

The app shows an `Install` button in the feed header (and a one-time banner)
that opens these instructions on iOS. On Chromium it triggers the native
install prompt.

Once installed it launches in standalone mode (no browser chrome) and the feed
header/FAB respect the device safe areas.

> If the site is only reachable through a private tunnel (for example a
> Tailscale tailnet), the installed app needs that tunnel to be active, just
> like Safari does.

### What works offline

The service worker (`public/sw.js`) keeps the app shell and icons available, but
**not** your moments: those come from the server and are private.

| Request | Strategy |
| --- | --- |
| `GET /api/*` | network only — never cached |
| App Router RSC payloads (`RSC: 1` / `?_rsc=`) | network only |
| Page navigations | network first, falls back to `/offline.html` |
| `/_next/static/*` (hashed assets) | cache first |
| Icons, manifest, other same-origin GETs | stale-while-revalidate |
| `POST`/`DELETE` etc. | not intercepted |

When the server is unreachable, navigation shows the branded offline page with a
retry button. Uploads and deletions require a connection.

The worker is registered only in production builds so it cannot interfere with
`next dev` hot reloading.

### Regenerating icons

Icons are drawn in code so the repo needs no rasteriser or emoji font:

```bash
npm run icons
```

This writes `public/icons/icon.svg`, `icon-192.png`, `icon-512.png`,
`icon-maskable-512.png`, `apple-touch-icon-152.png`,
`apple-touch-icon-167.png` and `apple-touch-icon.png`. Edit
`scripts/generate-icons.mjs` to change the artwork, then commit the regenerated
files (the Docker image serves them from `public/`).

The manifest is generated by `src/app/manifest.ts` and served at
`/manifest.webmanifest` as `application/manifest+json` (Next.js injects the
`<link rel="manifest">` tag automatically). `/manifest.json` is rewritten to the
same file so older clients and bookmarks keep working.

When changing the precache list or caching rules, bump `CACHE_VERSION` in
`public/sw.js` so existing installs drop their old cache on activation.

## Local development

```bash
npm install
cp .env.example .env.local   # local dev: SESSION_SECRET + passcodes
npm run dev
```

Cookies are not `Secure` outside production, so plain `http://localhost:3000`
works.

## Known gaps

- Media still lives on the local filesystem, so this runs as a single container
  on a single host. Moving to object storage + Postgres is the next step if you
  ever need multiple replicas or a managed platform.
- The feed polls every 5 seconds; there is no realtime channel.
- Voice notes are recorded as WebM where supported and as MP4/AAC on Safari/iOS;
  both are stored and served with the correct content type.
