---
name: container-image
description: The Dockerfile's four-stage build (base, deps, build, runtime), what the runtime stage actually copies — since TASK-0040, apps/web/build rather than apps/web/dist->apps/server/public, and the web app's own production deps installed alongside the server's — the shipped DM scripts directory, and why WORKDIR is set to apps/server before CMD. Load for image-build or "why is this file missing at runtime" questions.
kind: pipeline
sources:
  - Dockerfile
verified_against: bfb65a157559c88bf988a6c0f55b7c03824ff412
---

# Container image

The image is built in four named stages — `base`, `deps`, `build`, `runtime` — so the shipped
image carries only production dependencies and compiled/built output, never build tooling,
source, or devDependencies.

## How it works

`base` installs pnpm via corepack (`pnpm@11.10.0`, matching `package.json`'s
`packageManager`) and sets `WORKDIR /app`. `deps` copies only the workspace manifest files
(`pnpm-workspace.yaml`, `pnpm-lock.yaml`, root `package.json`, and each workspace's
`package.json`) and runs `pnpm install --frozen-lockfile` — installing the full workspace
so `@the-stacks/server`'s dependency on `@the-stacks/shared` resolves through the pnpm
workspace, per the inline comment.

`build` copies the full source (`COPY . .`) onto `deps` and runs
`pnpm --filter "@the-stacks/server..." run build` (the `...` includes the filtered package's
dependencies, i.e. `@the-stacks/shared`), then `pnpm --filter "@the-stacks/srd" run build`
(TASK-0043: the web About route imports `@the-stacks/srd/attribution`; see [[srd-data]]), followed by `pnpm --filter "@the-stacks/web" run
build` — the latter is `react-router build` ([[react-router-app]]), producing
`apps/web/build/client` and `apps/web/build/server/index.js`.

`runtime` starts fresh from `base` (not from `build`), sets `NODE_ENV=production`, re-copies
just the manifests, and runs `pnpm install --frozen-lockfile --prod --filter
"@the-stacks/server..." --filter "@the-stacks/web..."` — production dependencies for **both**
packages now (TASK-0040 changed this from server-only): the SSR bundle `server.ts` builds
imports React, React Router, and the shadcn runtime packages from `apps/web/node_modules`
rather than bundling them, per the Dockerfile's inline comment, so those have to be installed
in the runtime image too. Right after that install, `ARG GIT_COMMIT=unknown` / `ENV
GIT_COMMIT=$GIT_COMMIT` bakes the build's commit into the image (spec 010; surfaced at
`/health` via [[configuration]] and [[health-check]]) — declared there, after the install
`RUN`, specifically so a changing commit never busts that layer's cache. It then copies
build outputs from the `build` stage by exact path: `packages/shared/dist`,
`packages/dnd5e-engine/dist`, `packages/intent/dist` and `packages/planner/dist` (spec 102; `deps` and `runtime` also copy `packages/planner/package.json`), `packages/session-model/dist` (TASK-0044; the server now depends on both, and their `package.json` files are copied in `deps` and `runtime` too), `packages/space/dist` (TASK-0303; the `deps` and `runtime` manifest copies also include `packages/space/package.json` and `packages/intent/package.json`), `packages/srd/dist`, `packages/srd/data`, `packages/srd/ATTRIBUTION.md` (TASK-0043; the `deps` and
`runtime` manifest copies also include `packages/srd/package.json`), `apps/server/dist`, `apps/server/seeds` (TASK-0046: scene seeds load at runtime, module-relative, for the DM runtime — [[dm-runtime]]), `apps/server/dm-scripts` (TASK-0158, specs/053: the shipped DM scripts `DM_FAKE_SCRIPT` names, loaded module-relative — [[ai-gateway]]), and `apps/web/build` (copied as-is to `apps/web/build`, no rename) —
**this replaced the pre-migration copy of `apps/web/dist` into `apps/server/public`**, since
`src/static.ts` now resolves its default roots as `apps/web/build/client` and
`apps/web/build/server/index.js`, both module-relative to `apps/server/dist/static.js`, not
under `apps/server/` at all (see [[static-serving]]). `healthcheck.js` is copied to the image
root as `/app/healthcheck.js`, matching what `docker-compose.yml`'s healthcheck command runs.

The final two lines matter together: `WORKDIR /app/apps/server` is set **before** `CMD
["node", "dist/index.js"]`. This makes the command resolve to `/app/apps/server/dist/index.js`
and makes the process's cwd `/app/apps/server` — which is irrelevant to static/SSR serving
(that's resolved from `import.meta.url`, not cwd) but means any other relative path the
server code uses resolves from `apps/server/`, not the repo root.

## Connections

Consumes the build output of [[monorepo-and-toolchain]] (pnpm workspace, `tsc -b`/Turbo
build) and [[react-router-app]] (`react-router build`). Produces the layout
[[static-serving]] depends on (`apps/web/build/client`, `apps/web/build/server/index.js`) and
the `/app/healthcheck.js` path [[health-check]]'s compose healthcheck invokes. Run inside the
`app` service described in [[compose-stack]]. The copied `apps/server/dist` also carries
`dist/cli/create-operator.js` (TASK-0036) — no Dockerfile change was needed, since any file
under `src/` that `tsc -b` compiles lands in `dist` and rides the same `COPY`; see
[[operator-provisioning]]. The one non-compiled file in `src/` that must ship is the DM doctrine's MIT
`NOTICE.md`: the Dockerfile copies `apps/server/src/dm/doctrine/NOTICE.md` from the `build` stage to
`apps/server/dist/dm/doctrine/NOTICE.md`, beside the compiled doctrine module (Brad Bush, tabletop-dm).

## Operational notes

No `.dockerignore` is read in this trace — `COPY . .` in the `build` stage copies the whole
build context as-is. Rebuilding after a dependency change requires rebuilding from `deps`
onward, not just `runtime`, since `runtime`'s own `pnpm install` uses the same frozen
lockfile as `deps` and will reinstall identically. The runtime image carries no `vite`,
`react-router` CLI, or `tailwindcss` binary and no `apps/web/app` source directory — only
`apps/web/build`, `node_modules`, and `package.json` — proven per-PR by TASK-0040's standalone
image check ([[m0-demo]] §5).
