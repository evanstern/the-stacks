---
description: "Task list for the unseated-operator viewer fix (TASK-0118)"
---

# Tasks: An unseated operator views the table as a player

**Input**: `specs/038-unseated-operator-view/` — spec.md, plan.md, quickstart.md.

**Tests**: required. Every card AC is proven by a named test.

**Dispatch unit**: one phase is one implementer dispatch. Phase 1 is a sonnet dispatch. Phase 2
is a sonnet dispatch (or haiku, at the orchestrator's call). Run Phase 1, then Phase 2.

**Why the three user stories share Phase 1**: all three are rows of one pure function and its
one test file. Splitting them would give three dispatches the same two files.

**Gate for Phase 1** (run before the phase's commit):
`pnpm lint && pnpm typecheck && pnpm --filter @the-stacks/web test && pnpm check:boundaries`.
Phase 2 runs `pnpm ci:check`, the freshness probe and the spec-bridge check.

**Database**: none. This card touches no server code and no database. `REQUIRE_DATABASE=1`
suites are not required by this card; `pnpm ci:check` still runs whatever it runs.

**Rules for every phase**: no modals (slide-out panels or autocomplete dropdowns only). Browser
automation, if any, uses Brave. Do not touch `apps/server/`. Do not touch
`packages/session-model/`. Do not change frozen contracts. Add no dependency. Add no migration.

**Commits**: one or more per phase, each message led by `TASK-0118:`.

## Format: `[ID] [P?] [Story] Description`

## AC coverage map

| Card AC | Proven by |
|---|---|
| #1 AI DM seat, unseated operator: player view, no approvals panel | T003 (derivation, view-model), T004 (render) |
| #2 seat-holder and character-controller cases unchanged | T003 (unchanged rows), existing "operator seated as a character" test |
| #3 viewer.test covers AI seat and another user's human seat | T003 |

---

## Phase 1: The viewer mirrors the server rule (US1, US2, US3) — sonnet dispatch

**Goal**: `viewerFor` returns the DM viewer only for the human DM seat holder. Every other user,
operator included, gets the player viewer with their own id.

**Independent test**: `pnpm --filter @the-stacks/web test` passes with the new rows in
`viewer.test.mjs` and the new render test in `table-view.test.tsx`.

- [x] T001 [US1] In `apps/web/app/play/viewer.ts`, reduce `viewerFor(user, projections)` to the seat check: return `{ role: "dm" }` when `projections.gate.seat` is `{ kind: "human", userId: user.id }`; else return `{ role: "player", userId: user.id }`. Remove the account-role fallback and the now-dead character-controller branch. Rewrite the doc comment: the client mirrors `apps/server/src/ws/registry.ts` `viewerFor` (TASK-0045); the account role does not decide the viewer (TASK-0118); an unseated user, operator included, is a spectator player. Keep `LiveUser` unchanged. Narrow `ViewerProjections` to `Pick<SessionProjections, "gate">` only if every caller still typechecks; otherwise keep it.
- [x] T002 [US1] In `apps/web/app/play/use-live-table.ts`, seed the `project(events, …)` call inside the viewer `useMemo` with `{ role: "player", userId: user.id }` for every user. Replace the comment above it: the seed fold reads only the public seat and party rows, so a player seed serves every user.
- [x] T003 [P] [US1] [US2] [US3] In `apps/web/test/play/viewer.test.mjs`, update the derivation table. Change the "unseated operator" row to expect `{ role: "player", userId: "op-1" }`. Add rows: unseated operator, AI seat, empty party → player `op-1`; unseated operator, `{ kind: "human", userId: "dm-2" }` seat, party controlled by someone else → player `op-1`; operator controlling a character while `dm-2` holds the human seat → player `op-1`. Keep the seat-holder, character-controller and both player rows unchanged. Add a test: build the unseated operator's viewer at an AI seat, project `turnModeCombat.events` with it, call `toTableViewModel` with a non-empty `proposals` input, and assert `isDm === false`, `proposals` is empty, `composer.characters` is empty and `composer.actionAvailable === false`. Keep the existing "operator seated as a character" test unchanged.
- [x] T004 [P] [US1] In `apps/web/test/play/table-view.test.tsx`, add a test: take the `dm-approvals` fixture, derive the viewer with `viewerFor({ id: "op-unseated", role: "operator" }, project(f.events, f.viewers.dm))`, assert it is a player viewer, render `TableView` with `sourceFor(f, viewer)`, and assert the markup contains no "Pending proposals", no `<dialog` and no `aria-modal`.
- [x] T005 [US1] Run the Phase 1 gate. Commit with a message led by `TASK-0118:`.

**Checkpoint**: card AC #1, #2 and #3 are proven by tests.

---

## Phase 2: Wiki re-pin — sonnet dispatch

**Goal**: `docs/wiki/play-route.md` describes the new viewer rule and is pinned honestly.

- [ ] T006 Classify the `play-route` pin: run `git diff <its verified_against>..HEAD -- <its sources>`. Expect NEEDS-REVIEW, because `viewer.ts` and `use-live-table.ts` changed behaviour.
- [ ] T007 In `docs/wiki/play-route.md`, rewrite the `useLiveTable` bullet's viewer sentence: a user holding the human DM seat views as `{ role: "dm" }`; every other user, operator included, views as a player with their own id, matching the server's rule (TASK-0045, TASK-0118). Remove the "falls back to the account role" clause. Note that an operator reads DM-only data in the debug view (TASK-0117), not `/play`. Then re-pin `verified_against` to the Phase 1 commit or later.
- [ ] T008 If `play-route`'s `description:` changed, regenerate `docs/wiki/CAPSULES.md`. Update the state paragraph in `docs/wiki/INDEX.md` with one clause for TASK-0118 only if the paragraph names the viewer fallback; otherwise leave `INDEX.md` unchanged and say so in the commit message.
- [ ] T009 Run `pnpm ci:check`, `node ~/.claude/plugins/cache/praxisflux/grounding-wiki/0.68.0/gates/cli.mjs freshness . docs/wiki` (expect `OK`) and `node ~/.claude/plugins/cache/praxisflux/spec-bridge/0.68.0/gates/cli.mjs check .` (expect exit 0). Commit with a message led by `TASK-0118:`.

**Checkpoint**: wiki fresh; gates green; PR-ready.

---

## Dependencies & Execution Order

- Phase 1 before Phase 2 (the re-pin targets the Phase 1 commit).
- Within Phase 1: T001 and T002 first; T003 and T004 can run in parallel after T001; T005 last.

## Implementation Strategy

Phase 1 alone closes the bug and proves all three card ACs. Phase 2 keeps the grounding fresh,
which the PR needs before merge.
