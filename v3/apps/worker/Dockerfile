# v3 worker image — TS job runner via tsx; no HTTP surface, no EXPOSE.
# Health is a heartbeat file freshness check (see docker-compose.yml).
# Build context: v3/ (the pnpm workspace root)
# Context must be the workspace root because the worker depends on workspace
# packages/ and on tsconfig.base.json, which every package's tsconfig extends.
FROM node:22-slim

RUN corepack enable && corepack prepare pnpm@10 --activate
WORKDIR /app

# tsconfig.base.json is copied EXPLICITLY: every tsconfig extends it, and its
# absence inside the image broke the web build during this feature. Keep it.
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml tsconfig.base.json ./
COPY packages ./packages
COPY apps ./apps

RUN pnpm install --frozen-lockfile

WORKDIR /app/apps/worker
CMD ["pnpm", "start"]
