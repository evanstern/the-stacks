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
verified_against: 1dd5e874c5e7fec48888f245bf29a51c2fb0a38b
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
deliberately not part of `ci:check`. `bench:load` (spec 021) delegates to
`@the-stacks/server`'s own `bench:load` (`tsc -b && node dist/bench/load/cli.js`) — the load
bench's process-level CLI, run on demand rather than as part of `ci:check`; see [[benchmarks]]. `playtest` (TASK-0048) follows the same shape: it delegates to `@the-stacks/server`'s own `playtest` (`tsc -b && node dist/playtest/cli.js`), on demand and not part of `ci:check`; see [[playtest-harness]].

`turbo.json` defines the task graph: `build` depends on `^build` (each workspace's
dependencies build first) and declares `dist/**` as its cacheable output; `typecheck` depends
on `^typecheck` the same way; `test` depends on `^build`, has `"cache": false` (its result
depends on database reachability, which Turbo cannot hash), and runs against fresh output;
`lint` has no dependencies. `globalEnv` lists `APP_PORT`, `DATABASE_URL`,
`TEST_DATABASE_URL`, `DB_PORT`, `REQUIRE_DATABASE` — the environment variables whose value
changes must bust the cached tasks' cache, since none of them appear in any task's input files.

Root `tsconfig.json` has `"files": []` and a `references` array pointing at `packages/shared`,
`packages/dnd5e-engine`, `packages/dnd5e-engine/test`, `packages/session-model`, `packages/session-model/test`, `packages/srd`, `packages/srd/test`, `packages/intent`, `packages/intent/test`,
`apps/server`, `apps/server/test`, `apps/web` — it builds nothing itself, only orchestrates
`tsc -b` across the eight ([[dnd5e-engine]] is the pure rules package and its test project;
[[srd-data]] is the SRD data package and its test project; [[session-model]] is the pure session event package and its test project). Each workspace's own `tsconfig.json` extends `tsconfig.base.json`
(target ES2022, `module`/`moduleResolution`: ESNext/Bundler, `strict: true`,
`composite: true`, `declaration: true` — composite and declaration are what make project
references work at all) and adds its own `outDir`/`rootDir`/`include`. `apps/web` declares `references: [{ "path": "../../packages/shared" }]`; `apps/server` also references `packages/dnd5e-engine` and `packages/session-model`, matching the
Dockerfile's build-order comment that `@the-stacks/server` depends on `@the-stacks/shared`
resolving through the workspace. `apps/web`'s tsconfig additionally widens `lib` to include
`DOM`/`DOM.Iterable` and sets `jsx: "react-jsx"`. `apps/server/test` is its own project
reference (`apps/server/test/tsconfig.json`: `noEmit: true`, `include: ["."]`, references
`apps/server`, `packages/shared`, `packages/dnd5e-engine` and `packages/session-model`) — see [[test-suite]] for why this exists.

`biome.json` is the single formatter and linter (`quoteStyle: "double"` for JS), reading
`.gitignore` (`vcs.useIgnoreFile: true`) and additionally excluding `.claude`, `.specify`,
`backlog`, `docs`, `specs`, `fixtures` from its `files.includes` — non-source directories it
never touches — plus narrower carve-outs: `apps/server/test/fixtures/ddb` (raw
export-shaped HTML fixtures, not app code; see [[ddb-parser]]), `apps/server/test/fixtures/write-boundary`
(the seeded violation tree for the import-graph test, [[proposal-gate]]; also excluded from the
server test tsconfig) and the generated SRD data
(`packages/srd/data`, `packages/srd/provenance`; see [[srd-data]]) and the DM scene seeds (`apps/server/seeds`; see [[dm-runtime]]). Nine `overrides` entries add
a `noRestrictedImports` rule scoped to
`apps/web/**`, `packages/shared/**`, and the server's `library`/`codex`/`session` planes,
each forbidding imports of the others (constitution III's plane isolation). The sixth,
scoped to `packages/dnd5e-engine/src/**`, also adds `noRestrictedGlobals` and denies
database, network, model, `node:*`, app-package imports and clock/network globals
(constitution VI purity; see [[dnd5e-engine]]). The seventh, scoped to `packages/srd/**`, forbids
importing the engine, server, or web app (the engine may import srd, never the reverse; see
[[srd-data]]). The eighth, scoped to `packages/session-model/src/**`, applies the same purity denials as the engine (database, network, model, clock globals; see [[session-model]]), and the engine override also forbids importing `@the-stacks/session-model`. The ninth, scoped to `apps/server/src/dm/**`, forbids importing the log writers, ingestion, the library store, codex and ws ([[dm-runtime]]; `apps/server` now also depends on `@the-stacks/srd` and references it in its tsconfig) — a tenth, scoped to `packages/intent/src/**`, applies the same purity denials (no node modules, workspace packages, network or clock globals; zod only, see [[intent-contract]]), and an eleventh turns off `noThenProperty` for `packages/intent/**` (a `then` Intent param is a real field) — see [[ci-pipeline]] for the fixture-backed check that proves these rules fire.

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
