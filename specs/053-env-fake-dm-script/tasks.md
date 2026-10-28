# Tasks: Env-reachable scripted fake DM provider

**Input**: `specs/053-env-fake-dm-script/` (spec.md, plan.md, research.md, data-model.md,
contracts/env-dm-script.md, quickstart.md)

**Board task**: TASK-0158. Card AC #1: one env value makes the running app's fake provider replay
a DM script, with a test. Card AC #2: a documented quickstart runs a narrated turn on a worktree
stack with no key.

**Tests**: Required. Each phase writes its tests first and sees them fail before the code.

**Rules for every phase**: one phase is one sonnet dispatch. Work only in
`.worktrees/task-0158`. No provider key, no paid call. Never print or commit a secret. Do not
change `DmScriptSchema`, `loadDmScript`, `createScriptedDm`, `FakeProvider`, the gateway, the
`ws-protocol` frames, or the 029 and 030 contracts. Finish each phase with `pnpm ci:check` green.
Commit as `TASK-0158: Phase <n> — <title>`.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an open task).
- **[US1]**: User Story 1 (card AC #1). **[US2]**: User Story 2 (card AC #2).

---

## Phase 1: Script-mode runtime and its boot guard (card AC #1)

**Goal**: `createAiRuntime` and `facesThenSeed` exist, pinned by unit tests, with no caller yet.

**Independent test**: `pnpm --filter @the-stacks/server exec vitest run test/dm/script-env.test.ts`.

- [x] T001 [US1] Create `apps/server/test/dm/script-env.test.ts` with cases for contract rules 1
  to 6 (`contracts/env-dm-script.md`). Pass `scriptDir` as a temp directory built in the test
  (`mkdtempSync` under `os.tmpdir()`), holding one valid script and one invalid one. Cases:
  unset value returns `scriptName: null`, no `adapters`, no `gateRng`, and the `loadAiConfig`
  result; an empty value behaves as unset; `STACKS_ENV` unset, empty, `default`, `main` and `dev`
  each throw a message naming `DM_FAKE_SCRIPT`; `STACKS_ENV=task-158` with a valid name returns
  the scripted config; a bad name (`../x`, `X`, empty after trim) throws; an unknown name throws
  and lists the available names; a file failing `DmScriptSchema` throws naming the file; script
  mode does not call `loadAiConfig` (an env whose `AI_PROVIDERS` is invalid JSON still boots).
- [x] T002 [US1] In the same file, add gateway cases. Build `createGateway({ config, sink:
  memorySink(), adapters })` from the runtime. Assert a `dm.director` chat yields the scripted JSON
  text and `done`; a second call to the now-empty purpose yields `error` kind `config` with
  `unscripted call for dm.director`; an `embedding` embed returns 1024-length vectors.
- [x] T003 [US1] In the same file, add `facesThenSeed` cases: faces come out in order; after the
  faces it matches `seededRng(0)` draw for draw; a face outside `1..sides` throws; one shared
  instance from `gateRng()` advances across calls (two `gateRng()` calls return the same RNG).
- [x] T004 [US1] Run the file and confirm every case fails because the module is missing.
- [x] T005 [US1] Create `apps/server/src/dm/script/env.ts` per `contracts/env-dm-script.md` and
  plan D1, D3 and D4. Resolve the default `scriptDir` from `import.meta.url` three levels up to
  `apps/server`, then `dm-scripts`, as `apps/server/src/dm/seed/load.ts` resolves `seeds`.
  Import only `ai/config.ts`, `ai/adapters/fake.ts` types, `dm/script/load.ts`, `dm/script/schema.ts`
  and `@the-stacks/dnd5e-engine`. Run T001 to T003 green.
- [x] T006 [US1] Mutation check on the guard. Commit T001 to T005 first. Then replace the `STACKS_ENV` deny check in
  `apps/server/src/dm/script/env.ts` with a pass-through. Run `test/dm/script-env.test.ts` and
  confirm the guard cases fail. Restore the file. Confirm `git diff -- apps/server/src/dm/script/env.ts`
  is empty. Record the failing case names in `specs/053-env-fake-dm-script/evidence/mutation-guard.md`.
- [x] T007 [US1] Run `pnpm ci:check`. Commit the mutation record.

---

## Phase 2: Boot wiring, the live script and a scripted scene-start (card AC #1)

**Goal**: The running app enters script mode from `DM_FAKE_SCRIPT` and a scene-start narrates.

**Independent test**: `REQUIRE_DATABASE=1` with only `TEST_DATABASE_URL` exported from the
worktree `.env`: `pnpm --filter @the-stacks/server exec vitest run test/dm/script-env.integration.test.ts test/dm/dm-scripts.test.ts`.

- [x] T008 [P] [US1] Create `apps/server/test/dm/dm-scripts.test.ts`. Assert every file in
  `apps/server/dm-scripts/` loads with `loadDmScript`. Assert `greyhollow-live.json`'s `calls`
  deep-equal `scene-start.json`'s calls followed by `exploration-check.json`'s calls (both in
  `apps/server/test/dm/scripts/`), and its `dice` equal `[14]` (plan D5).
- [x] T009 [P] [US1] Create `apps/server/test/dm/script-env.integration.test.ts`, skipped without
  a database like `apps/server/test/dm/scene.integration.test.ts`. Build the runtime with
  `createAiRuntime({ DM_FAKE_SCRIPT: "greyhollow-live", STACKS_ENV: "task-158" })`. Build the
  gateway and the gate from it as `index.ts` will (plan D2), and start the DM worker the way the
  existing scene integration test does. Enqueue a scene-start for a new session with the
  `greyhollow-ford` seed. Assert the turn job ends `done`, a `narration` event holds the scripted
  opening text, and `dm_model_calls` rows name provider `scripted` with null cost.
- [x] T010 [US1] Run T008 and T009 and confirm they fail (no script file, no wiring).
- [x] T011 [US1] Create `apps/server/dm-scripts/greyhollow-live.json` (`name: "greyhollow-live"`)
  per plan D5. Run T008 green.
- [x] T012 [US1] Edit `apps/server/src/index.ts` per plan D2: call `createAiRuntime(process.env)`
  in place of `loadAiConfig`; pass `adapters` to `createAiGateway` and `rng: runtime.gateRng` to
  `createGate`; read `runtime.aiConfig` everywhere `aiConfig` was read; log
  `DM script mode: <name> (<n> calls, <d> dice)` once when `scriptName` is set. Run T009 green.
- [x] T013 [US1] Run `pnpm ci:check` with `REQUIRE_DATABASE=1` on this worktree's stack
  (`pnpm env:up`, migrate both databases by hand). Leave the stack up. Commit.

---

## Phase 3: Image, env docs and evidence helpers (card AC #2)

**Goal**: The script ships in the image, the env value is documented, and two helpers drive the
quickstart.

**Independent test**: `docker build` succeeds, and the built image lists
`/app/apps/server/dm-scripts/greyhollow-live.json`. `node --check` passes on both helpers.

- [ ] T014 [P] [US2] Add `COPY --from=build /app/apps/server/dm-scripts apps/server/dm-scripts`
  to `Dockerfile` beside the seeds line, with a one-line comment naming spec 053.
- [ ] T015 [P] [US2] Add a commented `DM_FAKE_SCRIPT` block to `.env.example`. State that it names
  a file in `apps/server/dm-scripts/`, belongs in a worktree `.env` (never the root `.env`),
  replaces the whole AI config, and is refused when `STACKS_ENV` is unset, `default`, `main` or `dev`.
- [ ] T016 [P] [US2] Create `specs/053-env-fake-dm-script/evidence/start-scene.mjs` per plan D6.
  Arguments: the creds file path. It signs in through the auth route, creates a session id,
  calls `POST /dm/sessions/<id>/start` with `seedId: "greyhollow-ford"` and every human seat set
  to the operator's user id, and prints the play and debug URLs. If the play page needs a prior
  event to load a fresh session, seed it the way `specs/041-debug-page/evidence/seed-live.mjs`
  does and say so in a header comment.
- [ ] T017 [P] [US2] Create `specs/053-env-fake-dm-script/evidence/declare.mjs` per plan D6 and
  research R7. Arguments: the creds file path and the session id. It opens the WebSocket with the
  session cookie, subscribes, and sends the gate requests that declare `act-search` for `tamsin`
  ("I search the ferry-house for whoever cut the bell rope.") and commit it, in the frame shapes of
  `docs/wiki/ws-protocol.md`. It prints each refusal code and exits nonzero on one.
- [ ] T018 [US2] Build the image (`docker compose -p stacks-task-158 build app`) and confirm the
  script is in it. Run `node --check` on both helpers. Run `pnpm ci:check`. Commit.

---

## Phase 4: Live quickstart run on this worktree's stack (card AC #2)

**Goal**: The quickstart is run for real, start to end, with evidence saved in the spec dir.

**Independent test**: `specs/053-env-fake-dm-script/evidence/live-run.md` records every
quickstart step with its outcome, and `evidence/shots/` holds the screenshots.

- [ ] T019 [US2] Confirm the root `.env` lacks `DM_FAKE_SCRIPT` (`grep -c` on the key name only;
  never print values). Follow `specs/053-env-fake-dm-script/quickstart.md` steps 1 to 9 on this
  worktree's stack. Keep the test credentials in a file outside the repo.
- [ ] T020 [US2] Confirm no call left the process: every `dm_model_calls` row for the session
  names provider `scripted`, and the app log shows no outbound provider request.
- [ ] T021 [US2] Run quickstart step 10 (`declare.mjs`). Confirm a `done` turn job with a d20 of
  14, a success against DC 13, and the scripted narration. If a chronicle job fails with
  `unscripted call for dm.chronicle`, append one `dm.chronicle` call to
  `apps/server/dm-scripts/greyhollow-live.json` only. Change the T008 equality to allow trailing
  `dm.chronicle` calls after the concatenation. Leave the test scripts unchanged. Re-run Phase 2's tests.
  *Note (Phase 3, orchestrator direction): the two `dm.chronicle` calls were added in Phase 3, one for
  the scene-start turn and one for the `act-search` turn. Both turns land narration, so both queue a
  chronicle job. Do not append more in this task.*
- [ ] T022 [US2] Take Brave screenshots per plan D7 at 1280 and 390 px, light and dark: the play
  page after the opening narration, the debug page with the `done` turn selected and its events
  highlighted, and the play page after the `act-search` turn. Save to
  `specs/053-env-fake-dm-script/evidence/shots/<name>-<width>-<scheme>.png`. Confirm no modal:
  panels open as slide-out sheets.
- [ ] T023 [US2] Run quickstart step 11: one more DM call fails loudly with `unscripted call`.
  Run step 12: removing the line and recreating the app leaves script mode (no boot log line).
- [ ] T024 [US2] Write `specs/053-env-fake-dm-script/evidence/live-run.md`: commit under test,
  stack, each step with its result, the counts from T020, the shot list, and any quickstart
  correction. Apply each correction to `specs/053-env-fake-dm-script/quickstart.md`.
- [ ] T025 [US2] Run `pnpm ci:check`. Commit. Leave the stack up for the orchestrator.

---

## Phase 5: Merge main, wiki re-ground and runbook rows (card AC #1, #2)

**Goal**: The branch is current with `origin/main`, the wiki is re-pinned honestly, and the
runbook records the ruling and the PRs.

**Independent test**: `node ~/.claude/plugins/cache/praxisflux/grounding-wiki/0.68.0/gates/cli.mjs freshness . docs/wiki`
prints `OK`, and `node ~/.claude/plugins/cache/praxisflux/spec-bridge/0.68.0/gates/cli.mjs check .`
exits 0.

- [ ] T026 Run `git -C /Users/evanstern/projects/the-stacks/.worktrees/task-0158 fetch origin`
  and then `git -C /Users/evanstern/projects/the-stacks/.worktrees/task-0158 merge origin/main`.
  Resolve any conflict by keeping both sides. Run `pnpm ci:check` with `REQUIRE_DATABASE=1`.
- [ ] T027 Run `/grounding-wiki:wiki-update`. Review every note the planner lists as
  NEEDS-REVIEW against the diff. Expected: `ai-gateway` (the `adapters` use at boot, script mode),
  `dm-runtime` (script mode, `apps/server/dm-scripts/`, the live script), `configuration`
  (`DM_FAKE_SCRIPT` and the guard), `container-image` (the new COPY), `runtime-stacks` (set the
  value in the worktree `.env`; the root `.env` wins), `server-entrypoint-and-app` (boot wiring),
  `proposal-gate` (the gate `rng` in script mode), `playtest-harness` (the shared script format),
  and `debug-view` (a live check can now show a `done` turn). Add `apps/server/src/dm/script/env.ts`
  and `apps/server/dm-scripts/greyhollow-live.json` to the sources of the notes that describe them.
  Point the notes at `specs/053-env-fake-dm-script/quickstart.md`.
- [ ] T028 Update `docs/wiki/CAPSULES.md` and `docs/wiki/INDEX.md`: the state line gains one
  sentence on script mode (TASK-0158, specs/053), and every changed note's one-liner stays true.
  Re-pin every touched note to the commit verified. Run the freshness gate until it prints `OK`.
- [ ] T029 Update `docs/design/m3-table-sweep-runbook.md` "Execution log":
  in the TASK-0157 row, replace "(this PR)" with `[#77](https://github.com/evanstern/the-stacks/pull/77)`
  and fill its merge cell with `` `854ecb7` ``; add an amendment row dated 2026-10-28 that quotes
  the ruling: "TASK-0158: I accept the recommended defaults Q1 to Q8, including the DM_FAKE_SCRIPT
  name, the shipped dm-scripts directory, the whole-config replacement and the STACKS_ENV boot
  guard."; add a TASK-0158 row with PR "(this PR)", merge "—", tokens "spec (opus), impl ×4
  (sonnet)", and a one-sentence note naming script mode, the guard and the live run.
- [ ] T030 Run `pnpm ci:check`, the freshness gate and the spec-bridge gate. Commit and push.

---

## Dependencies and order

- Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5. Each phase needs the previous one merged on
  the branch.
- Within Phase 2, T008 and T009 can run in parallel. Within Phase 3, T014 to T017 can run in parallel.
- Phase 4 needs a running stack and is the only phase with browser work.

## Implementation strategy

- MVP: Phases 1 and 2 meet card AC #1 on their own.
- Phases 3 and 4 meet card AC #2. Phase 4 also yields the screenshots the TASK-0117 merge
  condition asked for.
- Phase 5 lands the wiki and the runbook in the same PR.
