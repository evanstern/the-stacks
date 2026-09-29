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
  - apps/server/test/tsconfig.json
  - biome.json
verified_against: 77a25471a1b0235747925521d89eb1c1f4bb27e1
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
references, not `turbo`). More scripts exist only to be composed by `ci:check`
(`pnpm lint && pnpm typecheck && pnpm build && pnpm test && pnpm check:boundaries && pnpm
check:hooks && pnpm check:scripts && pnpm check:host-scripts`): `check:boundaries`,
`check:hooks`, `check:scripts` (spec 010's Docker-free unit tests for
`scripts/*lib.test.mjs`), and `check:host-scripts` — see [[ci-pipeline]] for what each gate
proves and how CI runs this same script. `env:up`/`env:down`/`env:status`/`env:prune`/
`env:main` (also spec 010) are the per-worktree stack CLI — see [[runtime-stacks]] — and are
deliberately not part of `ci:check`.

`turbo.json` defines the task graph: `build` depends on `^build` (each workspace's
dependencies build first) and declares `dist/**` as its cacheable output; `typecheck` depends
on `^typecheck` the same way; `test` depends on `^build`, has `"cache": false` (its result
depends on database reachability, which Turbo cannot hash), and runs against fresh output;
`lint` has no dependencies. `globalEnv` lists `APP_PORT`, `DATABASE_URL`,
`TEST_DATABASE_URL`, `DB_PORT`, `REQUIRE_DATABASE` — the environment variables whose value
changes must bust the cached tasks' cache, since none of them appear in any task's input files.

Root `tsconfig.json` has `"files": []` and a `references` array pointing at `packages/shared`,
`apps/server`, `apps/server/test`, `apps/web` — it builds nothing itself, only orchestrates
`tsc -b` across the four. Each workspace's own `tsconfig.json` extends `tsconfig.base.json`
(target ES2022, `module`/`moduleResolution`: ESNext/Bundler, `strict: true`,
`composite: true`, `declaration: true` — composite and declaration are what make project
references work at all) and adds its own `outDir`/`rootDir`/`include`. `apps/server` and
`apps/web` each declare `references: [{ "path": "../../packages/shared" }]`, matching the
Dockerfile's build-order comment that `@the-stacks/server` depends on `@the-stacks/shared`
resolving through the workspace. `apps/web`'s tsconfig additionally widens `lib` to include
`DOM`/`DOM.Iterable` and sets `jsx: "react-jsx"`. `apps/server/test` is its own project
reference (`apps/server/test/tsconfig.json`: `noEmit: true`, `include: ["."]`, references
`apps/server` and `packages/shared`) — see [[test-suite]] for why this exists.

`biome.json` is the single formatter and linter (`quoteStyle: "double"` for JS), reading
`.gitignore` (`vcs.useIgnoreFile: true`) and additionally excluding `.claude`, `.specify`,
`backlog`, `docs`, `specs`, `fixtures` from its `files.includes` — non-source directories it
never touches — plus one narrower carve-out, `apps/server/test/fixtures/ddb` (raw
export-shaped HTML fixtures, not app code; see [[ddb-parser]]). Five `overrides` entries add
a `noRestrictedImports` rule scoped to
`apps/web/**`, `packages/shared/**`, and the server's `library`/`codex`/`session` planes,
each forbidding imports of the others (constitution III's plane isolation) — see
[[ci-pipeline]] for the fixture-backed check that proves these rules fire.

## Connections

Feeds [[container-image]] (the Dockerfile's `pnpm install`/`pnpm --filter ... build` steps run
this same workspace graph) and [[server-entrypoint-and-app]] (the compiled output `tsc -b`
produces is what `node dist/index.js` runs). See [[overview]] for where `apps/server` and
`apps/web` sit in the system, and [[ci-pipeline]] for how `ci:check` runs this whole toolchain
in one gate.

## Operational notes

`tsc -b` is incremental by nature (composite references); a workspace whose `references` list
is wrong fails silently at the *consumer's* type-check, not at the missing package's. Turbo
task outputs (`dist/**`) are cached per-workspace; changing a `globalEnv` variable without
changing any file still invalidates the cached tasks' cache, but `test` is never cached.
