# v3 web image — the one Node app with a real build step: React Router 7
# compiles at image build time (`pnpm build`), then `pnpm start` serves it.
# Build context: v3/ (the pnpm workspace root)
# Context must be the workspace root because web depends on workspace
# packages/ and on tsconfig.base.json, which every package's tsconfig extends.
FROM node:22-slim

RUN corepack enable && corepack prepare pnpm@10 --activate
WORKDIR /app

# tsconfig.base.json is copied EXPLICITLY: every tsconfig extends it, and its
# absence inside the image broke THIS build during the feature — the RR7
# typegen/build resolves the extends chain at build time. Keep it.
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml tsconfig.base.json ./
COPY packages ./packages
COPY apps ./apps

RUN pnpm install --frozen-lockfile

WORKDIR /app/apps/web
# Build now so container start is just serving — the compose healthcheck's
# start_period doesn't need to absorb a compile.
RUN pnpm build

EXPOSE 4400
CMD ["pnpm", "start"]
