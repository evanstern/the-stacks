---
name: container-image
description: The Dockerfile's four-stage build (base, deps, build, runtime), what the runtime stage actually copies, and why WORKDIR is set to apps/server before CMD. Load for image-build or "why is this file missing at runtime" questions.
kind: pipeline
sources:
  - Dockerfile
verified_against: 3a8cdcc4582c79a94fd18dcb5a03f09b6b3728c4
---

# Container image

The image is built in four named stages — `base`, `deps`, `build`, `runtime` — so the shipped
image carries only the server's production dependencies and compiled output, never build
tooling, source, or devDependencies.

## How it works

`base` installs pnpm via corepack (`pnpm@11.10.0`, matching `package.json`'s
`packageManager`) and sets `WORKDIR /app`. `deps` copies only the workspace manifest files
(`pnpm-workspace.yaml`, `pnpm-lock.yaml`, root `package.json`, and each workspace's
`package.json`) and runs `pnpm install --frozen-lockfile` — installing the full workspace
so `@the-stacks/server`'s dependency on `@the-stacks/shared` resolves through the pnpm
workspace, per the inline comment.

`build` copies the full source (`COPY . .`) onto `deps` and runs
`pnpm --filter "@the-stacks/server..." run build` (the `...` includes the filtered package's
dependencies, i.e. `@the-stacks/shared`) followed by `pnpm --filter "@the-stacks/web" run
build`.

`runtime` starts fresh from `base` (not from `build`), sets `NODE_ENV=production`, re-copies
just the manifests, and runs `pnpm install --frozen-lockfile --prod --filter
"@the-stacks/server..."` — production dependencies only, scoped to the server and what it
needs. Right after that install, `ARG GIT_COMMIT=unknown` / `ENV GIT_COMMIT=$GIT_COMMIT` bakes
the build's commit into the image (spec 010; surfaced at `/health` via [[configuration]] and
[[health-check]]) — declared there, after the install `RUN`, specifically so a changing
commit never busts that layer's cache. It then copies three build outputs from the `build`
stage by exact path:
`packages/shared/dist`, `apps/server/dist`, and — critically — `apps/web/dist` is copied to
`apps/server/public`, because that is where `src/static.ts` resolves its default static root
from (module-relative, not cwd; see [[static-serving]]). `healthcheck.js` is copied to the
image root as `/app/healthcheck.js`, matching what `docker-compose.yml`'s healthcheck
command runs.

The final two lines matter together: `WORKDIR /app/apps/server` is set **before** `CMD
["node", "dist/index.js"]`. This makes the command resolve to `/app/apps/server/dist/index.js`
and makes the process's cwd `/app/apps/server` — which is irrelevant to static serving
(that's resolved from `import.meta.url`, not cwd) but means any other relative path the
server code uses resolves from `apps/server/`, not the repo root.

## Connections

Consumes the build output of [[monorepo-and-toolchain]] (pnpm workspace, `tsc -b`/Turbo
build). Produces the layout [[static-serving]] depends on (`apps/server/public`) and the
`/app/healthcheck.js` path [[health-check]]'s compose healthcheck invokes. Run inside the
`app` service described in [[compose-stack]].

## Operational notes

No `.dockerignore` is read in this trace — `COPY . .` in the `build` stage copies the whole
build context as-is. Rebuilding after a dependency change requires rebuilding from `deps`
onward, not just `runtime`, since `runtime`'s own `pnpm install` uses the same frozen
lockfile as `deps` and will reinstall identically.
