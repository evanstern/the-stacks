# Implementation Plan: Env-reachable scripted fake DM provider

**Branch**: `task-0158-env-fake-dm-script` | **Date**: 2026-10-28 | **Spec**: [spec.md](spec.md)

**Input**: `specs/053-env-fake-dm-script/spec.md`, with Q1 to Q8 ruled by the operator on
2026-10-28 ("I accept the recommended defaults Q1 to Q8").

## Summary

One env value, `DM_FAKE_SCRIPT=<name>`, puts the running app in script mode. In script mode the
app loads `apps/server/dm-scripts/<name>.json` with the unchanged `loadDmScript`. It builds a
strict provider with the unchanged `createScriptedDm`, uses that script's AI config as the
whole AI config, and passes the provider to the gateway as the `fake` adapter. It also gives the
gate one RNG that serves the script dice and then `seededRng(0)`. Boot refuses script mode
unless `STACKS_ENV` names a worktree stack. A shipped live script and a quickstart produce a
narrated scene-start turn, plus an optional player-action turn, on a worktree stack with no key.
Root cause and code facts: spec.md "Why the live check failed" and research.md.

## Technical Context

**Language/Version**: TypeScript 5, Node 22 (the existing server).

**Primary Dependencies**: Existing only: Zod, Hono, `@the-stacks/dnd5e-engine` (`seededRng`). No
new runtime dependency.

**Storage**: None new. No migration.

**Testing**: Vitest. Unit tests need no database. One integration test runs a scene-start
through the DM worker against the worktree test database (`REQUIRE_DATABASE=1`).

**Target Platform**: The app container on a worktree compose stack.

**Project Type**: Web service (the existing server) plus evidence scripts in the spec dir.

**Performance Goals**: None. A scripted turn completes in seconds.

**Constraints**: No provider key; no paid call; no frozen contract change; refused on
`STACKS_ENV` `default`, `main`, `dev` or unset.

**Scale/Scope**: One new server module, one wiring edit, one shipped script, one Dockerfile
line, one `.env.example` block, tests, two evidence helpers, wiki re-pin.

## Constitution Check (constitution 2.0.0)

*Checked before research and again after design. Both pass.*

- [x] **I. Agent-operable**: An agent drives script mode through the same env value and the same
      HTTP and WebSocket interfaces a human uses (`POST /dm/sessions/:id/start`, the gate request
      frame). The evidence helpers are agents of this kind. No human-only path.
- [x] **II. Content contract**: No codex entity. N/A.
- [x] **III. Data planes**: No new state. The script is a shipped file, read once at boot. Script
      mode writes session state only through the gate, as today.
- [x] **IV. Event sourcing**: Unchanged. Scripted turns append the same typed events through the
      gate. No event type is added.
- [x] **V. Citations**: Retrieval code is unchanged. In script mode, embeddings are the fake's
      hash vectors, on a worktree stack only. No eval change.
- [x] **VI. 5e engine boundary**: The engine owns every number. Script mode supplies the dice
      faces through the gate's existing `rng` option; no model rolls. The engine is not changed,
      so no new engine scripted-dice test is needed. The faces-then-seed RNG gets its own unit test.
- [x] **VII. Structured first**: Script responses pass the same node schemas as model output.
- [x] **VIII. Operator-owned content**: Live script prose is original and references the shipped
      Greyhollow seed. No rulebook text.
- [x] **IX. Self-hostable**: Works from `docker compose up` on a worktree stack. Model access
      stays behind the gateway seam. No new container. A self-hoster's plain compose stack
      (`STACKS_ENV=default`) refuses script mode.

**Stack conformance**: Within the Architecture Constraints table. No departure.

## Design decisions

- **D1 — One module owns script mode.** `apps/server/src/dm/script/env.ts` exports
  `createAiRuntime(env, opts)` and `facesThenSeed(faces, seed)` (contracts/env-dm-script.md).
  It lives in `dm/script/` beside the loader. It imports `ai/config.ts` (`loadAiConfig`) and the
  engine. It does not import `playtest/`, `events/`, `ws/` or the library store (biome dm rule).
- **D2 — `index.ts` calls it once.** `createAiRuntime(process.env)` replaces
  `loadAiConfig(process.env)`. The gateway gets `adapters`; the gate gets `rng`. Everything else
  in `index.ts` reads `runtime.aiConfig` where it read `aiConfig`.
- **D3 — The guard is in `createAiRuntime`.** The test that pins the guard calls the function
  directly. Phase 1 runs a mutation check on it.
- **D4 — Shipped script dir.** `apps/server/dm-scripts/` is resolved module-relative from
  `dist/dm/script/env.js` (three levels up to `apps/server`), the way `loadSeed` finds
  `apps/server/seeds`. The Dockerfile adds
  `COPY --from=build /app/apps/server/dm-scripts apps/server/dm-scripts`.
- **D5 — One live script, pinned to the test scripts.** `greyhollow-live.json` holds the
  `scene-start.json` calls and then the `exploration-check.json` calls, with dice `[14]`. A test
  asserts that equality (research R8).
- **D6 — Evidence helpers live in the spec dir.** `evidence/start-scene.mjs` and
  `evidence/declare.mjs` use only Node 22 built-ins (`fetch`, the global `WebSocket`). They read
  the app port from the worktree `.env` and the operator credentials from a creds file outside the
  repo, whose path is passed as an argument. They never print a secret.
- **D7 — Screenshots.** Phase 4 takes Brave screenshots by `executablePath` with playwright-core
  loaded from outside the repo, as `specs/041-debug-page/evidence/shoot-debug.mjs` does. If
  Brave cannot be driven, the orchestrator asks the operator, per the 2026-10-27 runbook ruling.

## Files touched

| File | Change | Phase |
|---|---|---|
| `apps/server/src/dm/script/env.ts` | New: `createAiRuntime`, `facesThenSeed`, `DmScriptEnvError` | 1 |
| `apps/server/test/dm/script-env.test.ts` | New: unit tests for every contract rule and the RNG | 1 |
| `apps/server/src/index.ts` | Use `createAiRuntime`; pass `adapters` and `rng`; boot log line | 2 |
| `apps/server/dm-scripts/greyhollow-live.json` | New live script | 2 |
| `apps/server/test/dm/dm-scripts.test.ts` | New: each shipped script loads; `greyhollow-live` equals the concatenation | 2 |
| `apps/server/test/dm/script-env.integration.test.ts` | New: scene-start through the DM worker in script mode (DB) | 2 |
| `Dockerfile` | Copy `apps/server/dm-scripts` into the runtime image | 3 |
| `.env.example` | Document `DM_FAKE_SCRIPT` and the guard | 3 |
| `specs/053-env-fake-dm-script/evidence/start-scene.mjs` | New helper | 3 |
| `specs/053-env-fake-dm-script/evidence/declare.mjs` | New helper | 3 |
| `specs/053-env-fake-dm-script/quickstart.md` | Correct any step the live run disproves | 4 |
| `specs/053-env-fake-dm-script/evidence/live-run.md`, `evidence/shots/` | New: the live run | 4 |
| `docs/wiki/*.md`, `CAPSULES.md`, `INDEX.md` | Re-pin | 5 |
| `docs/design/m3-table-sweep-runbook.md` | TASK-0157 row, amendment row, TASK-0158 row | 5 |

No migration. No new runtime dependency. No frozen contract edit.

## Project Structure

```text
specs/053-env-fake-dm-script/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/env-dm-script.md
├── checklists/requirements.md
├── evidence/            # Phases 3 and 4
└── tasks.md
apps/server/
├── dm-scripts/greyhollow-live.json
├── src/dm/script/env.ts
└── test/dm/{script-env.test.ts, script-env.integration.test.ts, dm-scripts.test.ts}
```

## Complexity Tracking

None. Every gate passes.
