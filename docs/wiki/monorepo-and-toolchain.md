---
name: monorepo-and-toolchain
description: pnpm workspaces layout, the Turborepo task pipeline and its globalEnv, TypeScript project references wiring the root build, and Biome as the single lint/format tool. Load for build/lint/typecheck questions or workspace layout.
kind: pipeline
sources:
  - package.json
  - pnpm-workspace.yaml
  - turbo.json
  - tsconfig.json
  - tsconfig.base.json
  - biome.json
verified_against: e472b4777ed2db6debbaca8044b6b76e2af11ee3
---

# Monorepo and toolchain

The repo is a pnpm workspace with two apps (`apps/server`, `apps/web`) and one shared package
(`packages/shared`), built and linted as one unit through Turborepo, TypeScript project
references, and Biome. `packageManager: pnpm@11.10.0` and `engines.node: "22"` in the root
`package.json` pin the toolchain versions; `pnpm-workspace.yaml` sets `allowBuilds: { esbuild:
true }` to let esbuild's install script run under pnpm's default script-blocking.

## How it works

`pnpm-workspace.yaml` globs `apps/*` and `packages/*` as workspace members. Root
`package.json` scripts delegate to the tools rather than reimplementing anything: `build` and
`test` run `turbo run build` / `turbo run test`, `lint` runs `biome check .`, `format` runs
`biome format --write .`, and `typecheck` runs `tsc -b` (build mode, driven by project
references, not `turbo`).

`turbo.json` defines the task graph: `build` depends on `^build` (each workspace's
dependencies build first) and declares `dist/**` as its cacheable output; `typecheck` depends
on `^typecheck` the same way; `test` depends on `^build` so integration code always runs
against fresh output; `lint` has no dependencies. `globalEnv` lists `APP_PORT`, `DATABASE_URL`,
`TEST_DATABASE_URL`, `DB_PORT` — the environment variables whose value changes must bust
Turbo's cache, since none of them appear in any task's input files.

Root `tsconfig.json` has `"files": []` and a `references` array pointing at `packages/shared`,
`apps/server`, `apps/web` — it builds nothing itself, only orchestrates `tsc -b` across the
three. Each workspace's own `tsconfig.json` extends `tsconfig.base.json` (target ES2022,
`module`/`moduleResolution`: ESNext/Bundler, `strict: true`, `composite: true`,
`declaration: true` — composite and declaration are what make project references work at
all) and adds its own `outDir`/`rootDir`/`include`. `apps/server` and `apps/web` each declare
`references: [{ "path": "../../packages/shared" }]`, matching the Dockerfile's build-order
comment that `@the-stacks/server` depends on `@the-stacks/shared` resolving through the
workspace. `apps/web`'s tsconfig additionally widens `lib` to include `DOM`/`DOM.Iterable`
and sets `jsx: "react-jsx"`.

`biome.json` is the single formatter and linter (`quoteStyle: "double"` for JS), reading
`.gitignore` (`vcs.useIgnoreFile: true`) and additionally excluding `.claude`, `.specify`,
`backlog`, `docs`, `specs` from its `files.includes` — non-source directories it never touches.

## Connections

Feeds [[container-image]] (the Dockerfile's `pnpm install`/`pnpm --filter ... build` steps run
this same workspace graph) and [[server-entrypoint-and-app]] (the compiled output `tsc -b`
produces is what `node dist/index.js` runs). See [[overview]] for where `apps/server` and
`apps/web` sit in the system.

## Operational notes

`tsc -b` is incremental by nature (composite references); a workspace whose `references` list
is wrong fails silently at the *consumer's* type-check, not at the missing package's. Turbo
task outputs (`dist/**`) are cached per-workspace; changing a `globalEnv` variable without
changing any file still invalidates every task's cache.
