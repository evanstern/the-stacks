---
description: "Task list for seed NPCs carrying minimal scene presence (TASK-0142, decision-0025 U8)"
---

# Tasks: Seed NPCs carry minimal scene presence

**Input**: `specs/050-seed-npc-presence/` (spec.md, plan.md, research.md, data-model.md,
contracts/seed-presence.md). Binding: decision-0025 (D17) Terms, §1.2, §2.1, §2.7. The operator
rulings of 2026-10-27 (OQ-1 to OQ-6, all (a); card commit 43e6d6a) are quoted in spec.md
"Operator rulings".

**Tests**: required and written first. Each test task precedes its implementation task in the
same phase and must fail before the implementation lands.

**Dispatch unit**: each phase is one sonnet implementer dispatch. Run the phases in order:
1, 2, 3, 4, 5.
- Phase 2 touches only `packages/session-model` and the 029 contracts. It may run beside
  Phase 1, never beside Phase 4.
- Phase 3 needs Phase 1 (the seed fields). Phase 4 needs Phases 1, 2 and 3.
- Phase 4 runs the DB suites. Never run it beside another DB phase.

**Gate for every code phase** (run before the phase's last commit):
`pnpm lint && pnpm typecheck && pnpm test && pnpm check:boundaries`.
- Phase 4 also runs the DB suites and `pnpm ci:check`, and `pnpm playtest run` (ci mode).

**Database suites**: run on the worktree's own stack.
1. Run `pnpm env:up`.
2. Migrate both databases by hand (fresh stacks come up unmigrated, TASK-0098).
3. Restart the app.
4. Export only `TEST_DATABASE_URL` from the worktree `.env`. Never `source` the whole file.
5. Run the suites with `REQUIRE_DATABASE=1`.
6. Leave the stack up. The orchestrator runs `pnpm env:down`.

**Known flakes**: the WebSocket gateway integration tests flake. DB scene and playtest tests can
hit the 5 s timeout under full-suite load (TASK-0154). Re-run once. Do not fix them. Record each
re-run in the phase's commit message.

**Rules for every phase**:
- Follow spec.md and plan.md exactly. A needed deviation is a STOP: report it.
- Add no event type, event version, proposal kind, engine command, refusal code, ws frame,
  migration or dependency. The only schema changes are the ruled ones: `beats[].presence`,
  `identity.aliases`, the seed cross-checks, and `scene-presence.visibility`.
- Edit frozen contract text only where a task below names it. Each such edit carries the line
  "Amended 2026-10-27 (TASK-0142, operator ruling OQ-n)", with the ruling quoted.
- Never edit `docs/design/m2-demo/**`. The AC #3 test reads the record in place.
- Tests use the fake gateway and scripted dice. No paid run.
- UI: no modals. This card has no UI change.
- Never use the backlog MCP tools. Touch no file under `backlog/`.
- No "for now" without a card (decision-0020). Report any deferral as an open question.

**Commits**: one or more per phase. Each message starts with `TASK-0142:` and ends with the
Co-Authored-By trailer. Stage and commit in separate Bash calls with
`git -C /Users/evanstern/projects/the-stacks/.worktrees/task-0142`. Push after each phase.

## Phase 1: Seed declaration, identity check and aliases (card AC #1, AC #4 seed half)

**Goal**: The seed declares each NPC's presence per beat, pins one id across NPC and combatant,
and carries authored aliases. The loader refuses every breach.

**Independent test**: `pnpm --filter @the-stacks/server exec vitest run test/dm/seed.test.ts`.

### Tests first

- [x] T001 [US1] In `apps/server/test/dm/seed.test.ts`, add tests that fail today:
      the shipped seed's beats carry `presence` for `wenna`, `pell` and `snag` with the plan D2
      values; and `issuesFor` refusals for: a beat missing an NPC key, a beat with an unknown
      key, a beat whose `npcIds` names an NPC it declares `absent`, an NPC whose
      `identity.combatant` differs from its `id`, an NPC whose `identity.combatant` names no
      encounter monster, an alias over 60 characters, and seven aliases. Assert each issue text
      names the beat or NPC (plan D1).
- [x] T002 [US1] [P] In the same file, assert `parseSeed` yields `identity.aliases` `[]` for an
      NPC with no `aliases`, and the plan D2 aliases on the shipped seed.

### Implementation

- [x] T003 [US1] In `apps/server/src/dm/seed/schema.ts`, add `beats[].presence`
      (`z.record(RefIdSchema, ScenePresenceSchema)`, required, `ScenePresenceSchema` imported
      from `@the-stacks/session-model`) and `SeedNpc.identity.aliases`
      (`z.array(Text(60)).max(6).default([])`).
- [x] T004 [US1] In `apps/server/src/dm/seed/load.ts` `crossCheckSeed`, add the three plan D1
      checks with the plan D1 issue texts.
- [x] T005 [US1] Edit `apps/server/seeds/greyhollow-ford.json` to the plan D2 presence maps and
      aliases. Apply the same edit to `specs/031-dm-runtime/data/greyhollow-ford.seed.json` so
      the existing copy-equality test passes.
- [x] T006 [US1] Amend `specs/031-dm-runtime/contracts/scene-seed.md`: the `presence` map in the
      schema block, `beats[0]` as the opening beat, the identity rule, `aliases`, and the new
      loader checks (contract `seed-presence.md` §1). Add the amendment line quoting the ruling.
- [x] T007 [US1] Run `pnpm typecheck`. Fix any type error in tests that build a `SceneSeed` by
      hand (for example `snapshot-render.test.ts` `big()`), without changing what they assert.

**Checkpoint**: the seed loads; every breach is refused with its issue.

## Phase 2: `scene-presence` proposal visibility (card AC #2 support, OQ-4)

**Goal**: A `scene-presence` proposal can write a `dm` row. The default stays `public`.

**Independent test**: `pnpm --filter @the-stacks/session-model test`.

### Tests first

- [x] T008 [US2] [P] In `packages/session-model/test/gate-schemas.test.ts`, assert a
      `scene-presence` proposal parses with `visibility` absent (default `public`), `public` and
      `dm`, and refuses any other value.
- [x] T009 [US2] [P] In `packages/session-model/test/gate-plan.test.ts`
      ("scene-presence planner"), assert a `dm` proposal plans a `scene-presence.changed` row
      with visibility `dm`, a default proposal plans `public`, and engine rows planned beside a
      `dm` row stay `public`.

### Implementation

- [x] T010 [US2] In `packages/session-model/src/gate/proposals.ts`, add
      `visibility: z.enum(["public", "dm"]).default("public")` to the `scene-presence` schema.
- [x] T011 [US2] In `packages/session-model/src/gate/plan.ts`, write the changed row with
      `proposal.visibility`. Leave the engine rows `public`.
- [x] T012 [US2] Add a `dm` `scene-presence` example to
      `packages/session-model/src/fixtures/proposal-examples.ts`; keep `fixtures.test.ts` green.
- [x] T013 [US2] Amend `specs/029-proposal-gate/contracts/proposals.md` (the schema block and the
      "`scene-presence` is always `public`" rule) and `specs/029-proposal-gate/contracts/gate-api.md`
      §1 (the `scene-presence` row: visibility from the proposal). Add the amendment line quoting
      the ruling to each.

**Checkpoint**: session-model suites green; the DM runtime still compiles unchanged.

## Phase 3: Snapshot aliases, the M2 log test, one identity (card AC #2, AC #3, AC #4)

**Goal**: NPC actors carry seed aliases. The recorded M2 log proves only the event moves
presence. Snag is one actor before and after he becomes a combatant.

**Independent test**: `pnpm --filter @the-stacks/server exec vitest run test/dm/seed-npc-presence.test.ts test/dm/snapshot.test.ts`.

### Tests first

- [x] T014 [US3] Create `apps/server/test/dm/seed-npc-presence.test.ts`. Read
      `docs/design/m2-demo/demo-session/transcript.jsonl` from a path built on `import.meta.url`.
      Parse each line with `StoredEventSchema`, fold with `applyEvent` from
      `emptyProjections({ role: "dm" })` (as `test/dm/snapshot-fixtures.ts` does), and build a snapshot with `loadSeed("greyhollow-ford")`
      at each seq 295 to 301. Assert (spec User Story 3, scenarios 1 and 2):
      - 333 rows, 0 fold diagnostics;
      - at every seq, exactly one actor has `id` or `combatantId` `snag`; it has `kind: "npc"`,
        `combatantId: "snag"` and `presence: "present"`;
      - the log holds 0 `scene-presence.changed` rows;
      - `diffSnapshots(S298, S301).actors` holds 0 entries of kind `presence`.
- [x] T015 [US3] In the same file, append one synthetic `scene-presence.changed` row (seq 334,
      `actorId: "snag"`, `before: "present"`, `after: "absent"`, `reason: "fled"`) to the seq-301
      fold. Assert Snag reads `absent` and the diff from S301 holds exactly one `presence` entry
      (scenario 3).
- [x] T016 [US4] [P] In `apps/server/test/dm/snapshot.test.ts`, assert (User Story 4, scenarios
      1 and 2): before `combatant.add`, actor `snag` is `kind: "npc"` with `combatantId: null`;
      after it, the same id has `combatantId: "snag"`, a prior presence row still applies, and no
      `monster` actor `snag` exists. Assert NPC `aliases` end with the seed aliases, deduped
      (Wenna includes "the keeper").

### Implementation

- [x] T017 [US2] In `apps/server/src/dm/snapshot/build.ts`, append `npc.identity.aliases` to the
      NPC `aliases` (plan D6). Change nothing else in the build.
- [x] T018 [US2] Amend `specs/040-actor-snapshot/contracts/actor-snapshot.md`: rule 7 (seed
      declarations reach presence only as logged rows), §4 (seed aliases), and the U8 extension
      row marked Built with the U9 note (contract `seed-presence.md` §4).

**Checkpoint**: AC #3's recorded-log test passes against the untouched record.

## Phase 4: Seed-presence group in resolve, NPC lists from presence (card AC #2, AC #4 resolve half)

**Goal**: Scene start and encounter start log the seed's declarations through the gate. Prompts
list only NPCs that are not absent.

**Independent test**: `REQUIRE_DATABASE=1 pnpm --filter @the-stacks/server exec vitest run test/dm/resolve.integration.test.ts test/dm/facts.test.ts`.

### Tests first

- [x] T019 [US2] In `apps/server/test/dm/resolve.integration.test.ts`, add a "seed presence
      (spec 050)" block. Assert after `startScene` on Greyhollow Ford: exactly two
      `scene-presence.changed` rows, for `pell` and `snag`, `after: "absent"`, reason
      `removed`, `actionId: null`, visibility `dm`; their submissions are keyed
      `seed:presence:`; S1 reads `wenna` `present`, `pell` and `snag` `absent` (User Story 2,
      scenario 1).
- [x] T020 [US4] In the same block, start the reed-camp encounter. Assert two public `arrived`
      rows (`pell`, `snag`) land before the `initiative.roll` rows; S1 reads both `present`;
      `snag` appears exactly once in the order (User Story 4, scenario 4).
- [x] T021 [US2] In the same block, run two different Director outputs that start `reed-camp`
      (different reasons and trackers) on fresh worlds. Assert identical seed submissions
      (FR-008). Re-run a reclaimed scene start and assert no second seed row.
- [x] T022 [US3] Amend the 048 test "no Director fixture produces a scene-presence submission":
      keep asserting 0 `director:`-keyed `scene-presence` submissions; count only rows whose
      submission key does not start `seed:presence:` (plan D4).
- [x] T023 [US2] [P] In `apps/server/test/dm/facts.test.ts`, assert a `dm` `scene-presence.changed`
      row yields no presence fact, and a `public` one still does.
- [x] T024 [US2] [P] Add assemble and narrate tests (in the existing assemble or narrate test file):
      `presentNpcIds` lists only S0 NPCs not `absent`, in seed order; narrate's `beatNpcIds`
      drops S1-absent NPCs.

### Implementation

- [x] T025 [US2] In `apps/server/src/dm/nodes/resolve.ts`, add `seedPresence` (plan D4): the
      scene-start call after the setup group, and the encounter-start call after the monsters'
      `combatant.add` and before `initiative.roll`. Submit through `run.submit` with keys
      `seed:presence:<moment>:<npcId>`, kind `scene-presence`, reasons per OQ-3, visibility per
      OQ-4. Read only the seed and the projections.
- [x] T026 [US2] In `apps/server/src/dm/nodes/assemble.ts`, derive `presentNpcIds` from S0 (plan
      D5). In `apps/server/src/dm/nodes/narrate.ts`, filter `beatNpcIds` by S1 presence.
- [x] T027 [US2] Run the full DM, session-model and playtest suites with the DB. Fix any
      row-count or seq assertion the new seed rows shift (for example in
      `scene.integration.test.ts`) by excluding `seed:presence:` rows, never by deleting a check.
      List each adjusted test in the commit message.
- [x] T028 [US2] Amend `specs/031-dm-runtime/contracts/resolve.md` with the seed-presence group
      (contract `seed-presence.md` §3) and the amendment line.
- [x] T029 Run `pnpm ci:check` and `pnpm playtest run` (ci mode, default scenario). The scenario
      must end `ended` with a passing report (SC-006).

**Checkpoint**: Greyhollow Ford opens with Pell and Snag absent, and the fight brings them in.

## Phase 5: Wiki re-ground

**Goal**: The grounding wiki describes the merged behaviour, with honest re-pins.

**Independent test**: the freshness gate prints `OK`, and the spec-bridge check exits 0.

- [ ] T030 Run the `grounding-wiki:wiki-update` plan. Classify each note whose sources changed as
      RE-PIN-ONLY or NEEDS-REVIEW against `git diff <old-pin>..HEAD -- <sources>`.
- [ ] T031 NEEDS-REVIEW `docs/wiki/actor-snapshot.md`: seed aliases, seed rows as the only path
      from the seed to presence, the U8 extension point built. Re-pin it.
- [ ] T032 NEEDS-REVIEW `docs/wiki/dm-runtime.md`: the per-beat presence map, the identity
      check, the seed-presence group, NPC lists from presence. Re-pin it.
- [ ] T033 NEEDS-REVIEW `docs/wiki/proposal-gate.md` and `docs/wiki/session-model.md`:
      `scene-presence.visibility`. Re-pin each.
- [ ] T034 Review `docs/wiki/dm-turn-jobs.md`, `docs/wiki/dm-failure-and-gates.md`,
      `docs/wiki/presence.md` and `docs/wiki/turn-floor.md`. Re-pin each whose sources changed;
      amend prose before re-pinning where behaviour changed.
- [ ] T035 Regenerate `docs/wiki/CAPSULES.md` if any `description:` changed. Add one sentence for
      seed NPC presence to the `docs/wiki/INDEX.md` state paragraph.
- [ ] T036 Run `node ~/.claude/plugins/cache/praxisflux/grounding-wiki/0.68.0/gates/cli.mjs freshness . docs/wiki`
      (it must print `OK`). Run
      `node ~/.claude/plugins/cache/praxisflux/spec-bridge/0.68.0/gates/cli.mjs check .`
      (it must exit 0).

**Checkpoint**: the wiki is fresh, and the bridge is clean.

## Dependencies

- Phase 1 → Phase 3. The snapshot reads `identity.aliases`; the M2 test loads the new seed.
- Phase 2 can run beside Phase 1 (disjoint files).
- Phases 1, 2, 3 → Phase 4. Resolve submits `dm` proposals and reads the presence map.
- Phases 1 to 4 → Phase 5.
- Within a phase, `[P]` test tasks can be written beside the other tests. Every test must fail
  before its implementation task.

## Story map

| Story | Card AC | Phases |
|---|---|---|
| US1 seed declaration | #1 | 1 |
| US2 NPC actors with declared presence | #2 | 2, 3, 4 |
| US3 only the event changes presence | #3 | 3, 4 |
| US4 one identity | #4 | 1, 3, 4 |
