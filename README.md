# hair-chat-web

Frontend for a multilingual hair-care chatbot: React, TypeScript, Vite, Auth0, SSE streaming

## Run together with the backend (GitHub Codespaces)

The codespace of `hair-chat-api` clones this repo into `/workspaces/hair-chat-web` and forwards
ports 8000 (API) and 5173 (web).

Terminal 1 — backend (see hair-chat-api/README.md for DB and `.env`):

```bash
cd /workspaces/hair-chat-api
uv run uvicorn app.main:app --reload       # http://localhost:8000/health
```

Terminal 2 — frontend:

```bash
cd /workspaces/hair-chat-web
corepack enable                            # pnpm version comes from package.json
pnpm install
pnpm dev                                   # http://localhost:5173
```

Open the forwarded port 5173 (Ports tab → globe icon): `https://<codespace>-5173.app.github.dev`.
The browser only talks to that origin; Vite proxies `/api/*` to `http://localhost:8000` inside the
codespace (`/api/me` → `/me`), so the backend needs no CORS and port 8000 can stay private.
Check: `curl localhost:5173/api/health`.

### Auth0 (one-time, dev tenant `hair-chat-dev`)

Application "SPA" settings must list the URL you open (codespace URL and/or http://localhost:5173):

- Allowed Callback URLs, Allowed Logout URLs, Allowed Web Origins
- Refresh Token Rotation: on; Google social connection (`google-oauth2`) enabled for the app
- API `https://api.hair-chat.dev` is the audience the backend validates

Public SPA settings live in `.env.development`; override locally in `.env.local` (see `.env.example`).

## Everyday commands

```bash
pnpm lint        # eslint + prettier --check + tsc
pnpm test        # Vitest + Testing Library + MSW, no network
pnpm build
pnpm gen:api     # backend running on :8000 → src/shared/api/schema.d.ts
```

Conventions for contributors and the coding agent: [CLAUDE.md](CLAUDE.md).
