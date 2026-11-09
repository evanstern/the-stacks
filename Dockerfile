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
COPY packages/srd/package.json packages/srd/package.json
COPY packages/dnd5e-engine/package.json packages/dnd5e-engine/package.json
COPY packages/session-model/package.json packages/session-model/package.json
COPY packages/space/package.json packages/space/package.json
COPY packages/intent/package.json packages/intent/package.json
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
RUN pnpm --filter "@the-stacks/server..." run build
RUN pnpm --filter "@the-stacks/srd" run build
RUN pnpm --filter "@the-stacks/web" run build

# Runtime: only production deps and built output — no build tooling, no
# source, no devDependencies (research R6). The web app's production deps
# (React, React Router, shadcn runtime packages) are installed too: the SSR
# bundle imports them from apps/web/node_modules rather than bundling them.
FROM base AS runtime
ENV NODE_ENV=production
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY apps/server/package.json apps/server/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/srd/package.json packages/srd/package.json
COPY packages/dnd5e-engine/package.json packages/dnd5e-engine/package.json
COPY packages/session-model/package.json packages/session-model/package.json
COPY packages/space/package.json packages/space/package.json
COPY packages/intent/package.json packages/intent/package.json
RUN pnpm install --frozen-lockfile --prod --filter "@the-stacks/server..." --filter "@the-stacks/web..."
# Declared after the install RUN so a changing commit never busts that
# layer's cache (spec 010 T005). Surfaced at /health via config.ts.
ARG GIT_COMMIT=unknown
ENV GIT_COMMIT=$GIT_COMMIT
COPY --from=build /app/packages/shared/dist packages/shared/dist
COPY --from=build /app/packages/dnd5e-engine/dist packages/dnd5e-engine/dist
COPY --from=build /app/packages/session-model/dist packages/session-model/dist
COPY --from=build /app/packages/space/dist packages/space/dist
COPY --from=build /app/packages/srd/dist packages/srd/dist
COPY --from=build /app/packages/srd/data packages/srd/data
COPY --from=build /app/packages/srd/ATTRIBUTION.md packages/srd/ATTRIBUTION.md
COPY --from=build /app/apps/server/dist apps/server/dist
# Scene seeds load at runtime from apps/server/seeds (module-relative, spec 031).
COPY --from=build /app/apps/server/seeds apps/server/seeds
# Shipped DM scripts load at runtime from apps/server/dm-scripts (spec 053, DM_FAKE_SCRIPT).
COPY --from=build /app/apps/server/dm-scripts apps/server/dm-scripts
# The doctrine's MIT notice ships beside the compiled doctrine module (spec 031).
COPY --from=build /app/apps/server/src/dm/doctrine/NOTICE.md apps/server/dist/dm/doctrine/NOTICE.md
# apps/web/build is where src/static.ts resolves its default client root and
# SSR handler from (module-relative, not cwd — plan D4, D5).
COPY --from=build /app/apps/web/build apps/web/build
COPY healthcheck.js ./healthcheck.js
WORKDIR /app/apps/server
CMD ["node", "dist/index.js"]
