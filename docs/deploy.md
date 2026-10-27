# Deploy notes

## Staging on Fly.io (`hair-chat-web-stg`)

https://hair-chat-web-stg.fly.dev — one `shared-cpu-1x`/256 MB machine in `fra` that suspends
when idle and wakes on the next request.

```text
browser ──https──> Fly proxy ──> nginx :8080 (hair-chat-web-stg)
                                   ├─ /assets/*, /index.html, SPA routes  (dist/)
                                   ├─ /healthz                            (Fly health check)
                                   └─ /api/* ──http, /api stripped──> hair-chat-api-stg.flycast:80
```

The API has no public IP (see `hair-chat-api/docs/deploy.md`): nginx reaches it over Flycast,
on the org's private network, so the browser only ever talks to one origin (no CORS, same as
the Vite dev proxy). A request to `/api` also wakes a suspended API machine.

### Files

- `Dockerfile`: stage 1 `node:24-alpine` + pnpm (corepack) runs `pnpm build`; stage 2
  `nginxinc/nginx-unprivileged` (uid 101, port 8080) serves `dist/`.
- `nginx/default.conf.template`, `nginx/security-headers.inc.template`: rendered at container
  start by the image entrypoint (envsubst of `AUTH0_DOMAIN` and `API_UPSTREAM` only).
- `fly.toml`: app, region, health check, VM size and the build args.

### Build args (public, not secrets)

`vite build` runs in production mode and does not read `.env.development`, so the Auth0 SPA
settings come in as build args: `VITE_AUTH0_DOMAIN`, `VITE_AUTH0_CLIENT_ID`,
`VITE_AUTH0_AUDIENCE`. They end up in the JS bundle anyway. `fly deploy` takes them from
`[build.args]` in `fly.toml`; keep them equal to `.env.development` (staging uses the dev
tenant). `VITE_AUTH0_DOMAIN` also feeds the CSP (`AUTH0_DOMAIN` in the runtime image).

### nginx behaviour

| Path               | Behaviour                                                              |
| ------------------ | ---------------------------------------------------------------------- |
| `/healthz`         | `200 ok`, not logged                                                   |
| `/assets/*`        | `Cache-Control: public, max-age=31536000, immutable`; missing file 404 |
| `/index.html`, SPA | any other path falls back to `index.html`, `Cache-Control: no-cache`   |
| `/api/*`           | proxied to `$API_UPSTREAM` without `/api`, query string kept           |

- `/api`: `proxy_pass` uses a variable and Fly's DNS (`resolver [fdaa::3]:53 ipv4=off`), so the
  Flycast name is resolved at request time and again every 30 s, not once at start (nginx would
  not even start if the name did not resolve).
- SSE (`POST /conversations/{id}/messages`): `proxy_buffering off`, `proxy_cache off`, HTTP/1.1
  with an empty `Connection` header, `proxy_read_timeout 300s`. gzip covers static types only;
  `text/event-stream` is not in `gzip_types` and proxied responses are never compressed.
- Security headers on every page and asset: `X-Content-Type-Options`, `Referrer-Policy`,
  `Permissions-Policy`, `Content-Security-Policy`:

  ```text
  default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:;
  font-src 'self'; connect-src 'self' https://<auth0 domain>; frame-src https://<auth0 domain>;
  worker-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self';
  frame-ancestors 'none'
  ```

  Why the exceptions:
  - `connect-src` Auth0: `/oauth/token` (code exchange, refresh tokens) is a fetch.
  - `frame-src` Auth0: silent auth (`prompt=none` iframe) restores the session after a reload.
  - `worker-src blob:`: auth0-spa-js (`useRefreshTokens` + memory cache) runs token requests in
    a Worker created from a blob URL. Without it the SDK cannot start.
  - `style-src 'unsafe-inline'`: sonner (toasts) and Radix scroll lock (dialogs, Sheet) insert
    `<style>` elements at runtime. Scripts stay `'self'` only.

  Redirects to Auth0 / Google sign-in are navigations and are not limited by the CSP. A new
  third-party origin (fonts, images, analytics) needs a CSP change here first.

### Build and check locally

```sh
docker build -t hair-chat-web:local \
  --build-arg VITE_AUTH0_DOMAIN=hair-chat-dev.eu.auth0.com \
  --build-arg VITE_AUTH0_CLIENT_ID=z0UtBRhcSduAlAFY6s1mbXRnqck5o5yr \
  --build-arg VITE_AUTH0_AUDIENCE=https://api.hair-chat.dev .

# Config test (the entrypoint renders the templates first)
docker run --rm hair-chat-web:local sh -c '/docker-entrypoint.sh nginx -t'

# Run on :5173 (an origin already registered in Auth0 for dev; stop `pnpm dev` first).
# API_UPSTREAM as an IP literal needs no DNS: 172.17.0.1 is the host from the default bridge,
# where a local backend listens on 0.0.0.0:8000.
docker run --rm -p 5173:8080 -e API_UPSTREAM=http://172.17.0.1:8000 hair-chat-web:local
curl -i localhost:5173/healthz
curl -i localhost:5173/api/health
```

In Codespaces open the forwarded 5173 port and sign in with DevTools open: the console must show
no `Content-Security-Policy` errors.

### Create the app (once)

```sh
fly apps create hair-chat-web-stg --org personal
```

The first `fly deploy` allocates a shared public IPv4 and a dedicated IPv6. This app is meant to
be public, unlike the API. Both apps must be in the same org for Flycast.

### Auth0 (the SPA application in the `hair-chat-dev` tenant)

Add `https://hair-chat-web-stg.fly.dev` to:

- **Allowed Callback URLs**: `https://hair-chat-web-stg.fly.dev` (`redirect_uri` is the origin)
- **Allowed Logout URLs**: `https://hair-chat-web-stg.fly.dev`,
  `https://hair-chat-web-stg.fly.dev/login`, `https://hair-chat-web-stg.fly.dev/login?deleted=1`
  (`returnTo` after logout / account deletion)
- **Allowed Web Origins**: `https://hair-chat-web-stg.fly.dev` (silent auth, refresh tokens)
- **Allowed Origins (CORS)**: `https://hair-chat-web-stg.fly.dev` (`/oauth/token` fetch)

### Deploy

```sh
fly deploy -a hair-chat-web-stg --ha=false
```

The image is built remotely with the `[build.args]` from `fly.toml`. The new machine must pass
the `/healthz` check, otherwise the deploy fails and the old release keeps serving. Then:

```sh
curl -i https://hair-chat-web-stg.fly.dev/healthz
curl -sI https://hair-chat-web-stg.fly.dev/ | grep -i content-security-policy
curl -i https://hair-chat-web-stg.fly.dev/api/health    # through Flycast to the API
```

### Rollback

```sh
fly releases -a hair-chat-web-stg --image      # versions with their image references
fly deploy -a hair-chat-web-stg --image registry.fly.io/hair-chat-web-stg:<tag> --ha=false
```

The frontend has no state, so any older image can come back. After a rollback, browsers that
still have the newer `index.html` may request asset files the older image does not have (404);
a reload fixes it because `index.html` is `no-cache`.

### Logs

```sh
fly logs -a hair-chat-web-stg                  # live; --no-tail for recent lines only
fly status -a hair-chat-web-stg                # machines, health checks, release
```

nginx access logs carry paths (conversation ids), never request bodies or message text.
