# Build context: v3/ (the pnpm workspace root)
FROM node:22-slim

RUN corepack enable && corepack prepare pnpm@10 --activate
WORKDIR /app

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml tsconfig.base.json ./
COPY packages ./packages
COPY apps ./apps

RUN pnpm install --frozen-lockfile

WORKDIR /app/apps/worker
CMD ["pnpm", "start"]
