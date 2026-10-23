# Meow Moments

A tiny private space for two people to share photos and voice notes.

## Access model

- Two fixed accounts: `user1` and `user2`.
- Each has a passcode set through environment variables.
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
| `MEOW_USER1_NAME` / `MEOW_USER2_NAME` | Display names. |
| `MEOW_USER1_PASSCODE` / `MEOW_USER2_PASSCODE` | Minimum 6 chars. |

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
