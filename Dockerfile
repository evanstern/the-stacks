# syntax=docker/dockerfile:1
FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@11.10.0 --activate
WORKDIR /app

# Install the full workspace so @the-stacks/server's dependency on
# @the-stacks/shared resolves through the pnpm workspace (research D5).
FROM base AS deps
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY apps/server/package.json apps/server/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
RUN pnpm --filter "@the-stacks/server..." run build
RUN pnpm --filter "@the-stacks/web" run build

# Runtime: only the server's production deps and built output — no build
# tooling, no source, no devDependencies (research D5). The client's build
# output is static files, not tooling, so it belongs here (FR-004).
FROM base AS runtime
ENV NODE_ENV=production
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY apps/server/package.json apps/server/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN pnpm install --frozen-lockfile --prod --filter "@the-stacks/server..."
# Declared after the install RUN so a changing commit never busts that
# layer's cache (spec 010 T005). Surfaced at /health via config.ts.
ARG GIT_COMMIT=unknown
ENV GIT_COMMIT=$GIT_COMMIT
COPY --from=build /app/packages/shared/dist packages/shared/dist
COPY --from=build /app/apps/server/dist apps/server/dist
# apps/server/public is where src/static.ts resolves its default root from
# (module-relative, not cwd — plan D1), so the SPA build output lands there.
COPY --from=build /app/apps/web/dist apps/server/public
COPY healthcheck.js ./healthcheck.js
WORKDIR /app/apps/server
CMD ["node", "dist/index.js"]
