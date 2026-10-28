# syntax=docker/dockerfile:1

# ---- build: static bundle in /app/dist ----
FROM node:24-alpine AS build
WORKDIR /app
RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

COPY . .

# Public Auth0 SPA settings (not secrets: they end up in the JS bundle). `vite build` runs in
# production mode and does not read .env.development, so they come in as build args.
ARG VITE_AUTH0_DOMAIN
ARG VITE_AUTH0_CLIENT_ID
ARG VITE_AUTH0_AUDIENCE
ENV VITE_AUTH0_DOMAIN=$VITE_AUTH0_DOMAIN \
    VITE_AUTH0_CLIENT_ID=$VITE_AUTH0_CLIENT_ID \
    VITE_AUTH0_AUDIENCE=$VITE_AUTH0_AUDIENCE
RUN test -n "$VITE_AUTH0_DOMAIN" && test -n "$VITE_AUTH0_CLIENT_ID" && test -n "$VITE_AUTH0_AUDIENCE" \
    || { echo "VITE_AUTH0_DOMAIN, VITE_AUTH0_CLIENT_ID and VITE_AUTH0_AUDIENCE build args are required" >&2; exit 1; }
RUN pnpm build

# ---- runtime: nginx as uid 101, port 8080 ----
FROM nginxinc/nginx-unprivileged:1.30-alpine

ARG VITE_AUTH0_DOMAIN
# The image's entrypoint renders /etc/nginx/templates/*.template into /etc/nginx/conf.d at start,
# substituting only these variables (nginx's own $vars stay untouched).
ENV AUTH0_DOMAIN=$VITE_AUTH0_DOMAIN \
    API_UPSTREAM=http://hair-chat-api-stg.flycast \
    NGINX_ENVSUBST_FILTER="^(AUTH0_DOMAIN|API_UPSTREAM)$"

RUN rm /etc/nginx/conf.d/default.conf
COPY nginx/default.conf.template nginx/security-headers.inc.template nginx/api-proxy.inc.template \
    /etc/nginx/templates/
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 8080
