---
description: "Task list for fight statistics counting NPCs reduced to zero (TASK-0134)"
---

# Tasks: Fight statistics count NPCs reduced to zero

**Input**: `specs/042-fight-stats-npc-zero/` — spec.md, plan.md.

**Tests**: required. Every card AC is proven by a named test.

**Dispatch unit**: one phase is one implementer dispatch (haiku). Run phases in order: 1, 2.

**Rules for every phase**: add no dependency. Add no migration. Make no model or provider call.
Edit nothing outside the files plan.md "Files touched" names. Never edit `auditor/schema.ts`,
`auditor/render.ts`, any `specs/032-playtest-harness/contracts/` file, or any file under
`docs/design/m2-demo/`.

**Commits**: one or more per phase, each message led by `TASK-0134:`.

## Format: `[ID] [P?] [Story] Description`

## AC coverage map

| Card AC | Proven by |
|---|---|
| #1 The fight-statistics fold counts NPCs reduced to 0 HP | T001, T002 |
| #2 A test replays a ledger with an NPC dropped to 0 HP and asserts the count | T002 |
| #3 The M2 demo session's recomputed statistics report goblin-3 reduced to zero | T003 |

## Phase 1: Fix the fold and prove it

**Goal**: `fightStats` counts every drop to 0 HP. A test proves NPC drops, party drops and the M2
demo recompute.

- [ ] T001 [US1] In `apps/server/src/playtest/auditor/stats.ts`, change the condition `if (a.current === 0 && b.current > 0 && side === "players")` to `if (a.current === 0 && b.current > 0)`. Leave the `side` variable: the damage tallies use it. In the file's top comment, add one sentence: "`reducedToZero` lists every combatant dropped to 0 HP, party and NPC alike (TASK-0134)." Change nothing else in the file.
- [ ] T002 [US1] Create `apps/server/test/playtest/stats.test.ts`. Import `describe, expect, it` from `vitest`, `fightStats` from `../../src/playtest/auditor/stats.js`, and `loadDoctored` from `./helpers.js`. Add `describe("fightStats reducedToZero", ...)` with two cases:
  - Case "counts an NPC dropped to 0 HP": call `loadDoctored()`. Find the ledger row with `kind === "change"`, `type === "hp.changed"` and `seq === 68` (subject `goblin-3`, before current 7, after current 3). Set its `after` to `{ current: 0, temp: 0 }`. Call `fightStats(d.transcript, d.ledger)`. Assert `stats?.reducedToZero` equals `["Goblin lookout"]`.
  - Case "counts a party member dropped to 0 HP": call `loadDoctored()`. Copy the seq 68 row with `structuredClone`. Set the copy's `subject` to `"tamsin"`, `before` to `{ current: 13, temp: 0 }`, `after` to `{ current: 0, temp: 0 }`. Push the copy onto `d.ledger`. Call `fightStats`. Assert `stats?.reducedToZero` equals `["Tamsin Vale"]`.
  - Narrow the row type with a type guard, as `stats.ts` does (`Extract<LedgerRow, { kind: "change" }>`), so the file typechecks without `any`.
- [ ] T003 [US1] In the same file, add case "recomputes the M2 demo session". Define `const DEMO = new URL("../../../../docs/design/m2-demo/demo-session", import.meta.url).pathname;`. Call `readRunDir(DEMO)` (import from `../../src/playtest/export.js`). Read `report.json` from `DEMO` with `readFileSync` and `JSON.parse`. Call `fightStats(run.transcript, run.ledger)`. Assert it equals `{ ...report.fight, reducedToZero: ["Goblin lookout"] }`. If any field other than `reducedToZero` differs, stop and report the diff. Do not change the expected value.
- [ ] T004 Prove the test bites. Restore `&& side === "players"` in `stats.ts` locally. Run the new test file. Confirm the NPC case and the M2 demo case fail and the party case passes. Remove the guard again. Do not commit the restored guard. Record the result in the commit message body.
- [ ] T005 Run `pnpm --filter @the-stacks/server test -- test/playtest/stats.test.ts`, then `pnpm lint && pnpm typecheck`, then `pnpm ci:check`. All pass. Commit `stats.ts` and `stats.test.ts`.

**Checkpoint**: the new test file passes; `pnpm ci:check` green.

## Phase 2: Wiki re-ground

**Goal**: the `playtest-harness` note describes the corrected statistic and is re-pinned honestly.

- [ ] T006 Update `docs/wiki/playtest-harness.md` (NEEDS-REVIEW per the runbook). In the `stats.ts` sentence, say reduced-to-zero lists every combatant dropped to 0 HP, party and NPC alike (TASK-0134). Add `apps/server/test/playtest/stats.test.ts` to `sources:`.
- [ ] T007 Leave the note's `description` unchanged unless T006 changes it. If it changes, regenerate `docs/wiki/CAPSULES.md` and update the `playtest-harness` line in `docs/wiki/INDEX.md`.
- [ ] T008 Re-pin `verified_against` only on notes re-verified against this branch's code. Run `node ~/.claude/plugins/cache/praxisflux/grounding-wiki/0.68.0/gates/cli.mjs freshness . docs/wiki` until it prints `OK`.
- [ ] T009 Run `node ~/.claude/plugins/cache/praxisflux/spec-bridge/0.68.0/gates/cli.mjs check .` and `pnpm ci:check`. Both pass. Commit the wiki files.

**Checkpoint**: freshness `OK`, spec-bridge exit 0, `pnpm ci:check` green.

## Dependencies

- Phase 2 depends on Phase 1 (the test file is a new wiki source).
- Within Phase 1: T002 and T003 depend on T001; T004 depends on T002 and T003; T005 runs last.
