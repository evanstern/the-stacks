# v3 API image — TS service run via tsx (no compile step; `pnpm start` uses tsx).
# Build context: v3/ (the pnpm workspace root)
# Context must be the workspace root because the api depends on workspace
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

WORKDIR /app/apps/api
EXPOSE 4401
# `pnpm start` runs migrations before binding 4401 — compose's /ready
# healthcheck therefore gates downstream services on schema success.
CMD ["pnpm", "start"]
