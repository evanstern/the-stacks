# Feature Specification: Code Director for a companion's own turn

**Feature Branch**: `task-0321-companion-director`
**Card**: TASK-0321 (milestone m-10). Wave 2c, round time (R1 exit 3).
**Created**: 2026-11-15
**Status**: Draft
**Authored against**: `origin/main` `b6a6f683` (contains TASK-0299, spec 107; TASK-0337, spec 111; TASK-0347, spec 116).
Origin: `specs/107-ai-turn-intents/spec.md` OQ-7 (and OQ-8, the monster-turn precedent).
Evidence: TASK-0321 AC #3 profile (hosted session `6031b671-da08-4336-b7ab-058dcedb4939`, round 1, read from the calls ledger) and `docs/playtests/2026-11-15-combat-smoke-retest.md`.
Runbook: `docs/design/r1-fast-table-runbook.md` "Amendment 2026-11-15", wave 2c.
**Clarify**: skipped. Card AC #1 fixes the scope, the AC #3 profile confirms it, and the judgment calls are recorded below.
**Spec Kit**: authored directly in the template shape, as specs 114 and 116 were. `.specify/feature.json` is untouched.

## Summary

Since TASK-0299 a companion's own turn in turn mode costs two model calls: `dm.companion` (typed
Intent bodies, declared as slash lines) and the commit turn job's `dm.director`. Interpret makes no
call. A monster turn already skips the Director with a code-made stay-put output (`NPC_DIRECTOR`,
spec 107 D4).

The AC #3 profile shows the Director is the largest share of both companion turns:

| Turn | Total | `dm.companion` | `dm.director` (opus) | Other |
|---|---|---|---|---|
| Odo | 25.1 s | 8.4 s | **9.9 s (39%)** | `dm.adjudicate` 4.5 s (opus); a 2.0 s wait for a `dm.chronicle` job before the commit job started |
| Kestrel | 39.9 s | 9.4 s | **18.7 s (47%)**, 1325 output tokens | `dm.narrate` 11.5 s, the previous turn's tail |

The scope stays on the Director. After this card, a turn job whose beat is only the active AI
companion's own committed action runs a code-made Director output, so it makes no `dm.director`
call. Everything after the Director (interpret pre-pass, resolve, the code fight end, narrate) runs
as today.

## What the code Director decides (decision record, question 1)

The Director's legality (`legalizeDirector`, `nodes/director.ts`) already fixes most of a turn-mode
decision. The table lists each output field on a companion's own turn in turn mode.

| Field | Model Director in turn mode today | Code Director | Lost? |
|---|---|---|---|
| `beat` | `hold` is illegal outside free mode; legality forces `resolve` | `resolve` | No. Legality already fixes it. |
| `tableMode` `turn` | Illegal ("already in turn mode") | `stay` | No. |
| `tableMode` `free` | Legal: ends the encounter and returns to free mode | `stay` | **Yes, on this beat.** Resolve still ends the fight in code when no foe stands (spec 099 FR-020, `directorClosing`), whatever the Director said. A negotiated end waits for the next model-Director beat. |
| `trackers` | Legal: advance a known tracker | `[]` | **Yes, on this beat.** The next model-Director beat may advance it. |
| `scene` `end` | Legal | `continue` | **Yes, on this beat.** The next model-Director beat may end it. |
| `companionPrompts` | Illegal outside free mode; legality drops them | `[]` | No. Legality already fixes it. |
| `arrivals` | Legal: a joinable monster of the running fight, or an offstage NPC | `[]` | **Yes, on this beat.** The next model-Director beat may land it. |
| `pacing` | Free text the narrator reads (`tension`, `beatId`) | `rising`, `spotlight: null`, `beatId: null` | Minor. With `beatId: null`, narrate reads `assembled.presentNpcIds`, as on a monster turn. |
| `goalNote` | A private note for the narrator | `""` | Minor. The narrate prompt shows an empty private note, as on a monster turn. |

**D1 — Reuse the stay-put output.** The code Director is the existing `INTENT_DIRECTOR` constant,
under a new name `COMPANION_DIRECTOR`, as `NPC_DIRECTOR` is. A combat-specific `tension: "high"`
was considered and rejected: monster turns already narrate with `rising`, and one constant keeps the
three code paths identical.

**D2 — Accept the lost decisions.** This follows spec 107 OQ-8, which accepted the same losses on
monster turns. A fight with no foe standing still ends in code. Scene end, tracker advances and
turn-mode arrivals move to the next beat that runs the model Director: a human's turn, or any beat
whose items are not all the active companion's own.

**D3 — The rule is read from state, not from the trigger.** The runner chooses the code Director
when all of these hold:

1. No checkpointed Director exists (`ctx.checkpoint.director === null`).
2. `assembled.projections.tableMode.mode === "turn"`.
3. `assembled.projections.tableMode.activeActor` starts with `ai:companion:`.
4. `assembled.npcTurn === null`.
5. The beat is not empty, and every beat item's `actor` equals that `activeActor`.

A beat that also holds a human's item (for example a held party action, TASK-0244) keeps the model
Director, because a human's act may trigger a scene end or a tracker. The trigger is not read: a
`commit`, `reconcile` or `manual` job with this beat shape is the same beat. The rule does not read
whether the companion's text is slash lines or prose. A companion committing an older prose action
(spec 107 FR-014) still gets the code Director; interpret then reads the prose as today.

## Out of scope, with defaults (questions 2 and 3)

- **The `dm.adjudicate` call on Odo's turn (4.5 s, opus).** It ran after the Director, in resolve:
  the Intent runner's `needs_ruling` path (`intent-runner.ts` calls `answerRulings`). A companion's
  `attempt` (or any stage the planner cannot settle) needs a ruling, and the engine cannot rule. It
  does not fall out of this change. OQ-2 holds it.
- **The 2.0 s wait for the chronicle job.** The worker loop runs one job at a time
  (`worker.ts` `startLoop` awaits `processOne()`). A chronicle job claimed before the commit turn job
  was queued holds the worker until it finishes. Claim priority (turn first) cannot help a job not
  yet queued. OQ-3 holds it.

## Acceptance criteria map

| Card AC | Requirements | Success criteria | Phase |
|---|---|---|---|
| #1 Companion beats in turn mode make no `dm.director` call, with a test | FR-001–FR-004, FR-005–FR-009 | SC-001–SC-004 | 1 |
| #2 The hosted 4v4 round time is re-measured after the change | FR-012 (post-merge step) | SC-006 | Post-merge, not a build task |
| #3 Profile one hosted companion turn first | Done (card notes, 2026-11-15) | — | — |
| Brief: a replay or fixture test of a companion turn | FR-006, FR-007 | SC-002, SC-003 | 1 |

## User scenarios

### US1 — A companion's turn skips the Director (P1, AC #1)

It is Odo's turn in a fight. The companion job returns one `attack` body and commits
`/attack @goblin-3 with Mace`. The commit turn job assembles a beat of that one action. The runner
sees the active companion's own beat and uses the code Director. Interpret parses the slash line with
no call. Resolve runs the attack. Narrate makes the turn's one call. The turn advances. The job made
no `dm.director` and no `dm.interpret` call.

### US2 — A companion's killing blow still ends the fight (P1, AC #1)

Odo's attack drops the last standing foe. The code Director says `stay`. Resolve's closing group
loads fresh projections, sees `encounterOver`, ends the encounter and sets free mode with reason
"No foe still stands." The job made no `dm.director` call.

### US3 — A human item in the beat keeps the model Director (P1)

A beat holds the active companion's action and a human's party action. The runner calls the
Director as today.

### US4 — A scripted round shows the saving (P1, AC #1)

The 4v4 bench round plays one human turn, three companion turns and four monster turns. It makes one
`dm.director` call, for the human's turn.

## Requirements

### Runner (AC #1)

- **FR-001**: `pipeline/runner.ts` MUST add `COMPANION_DIRECTOR`, equal to `INTENT_DIRECTOR`.
- **FR-002**: At the `director` node, the runner MUST use `COMPANION_DIRECTOR` and make no call when
  D3's five conditions hold. The check MUST sit beside the spec 107 D4 `npc-turn` check and follow
  its shape: set `results.director`, store no checkpoint, `continue`.
- **FR-003**: Every other beat MUST call the Director as today, including a beat that mixes the
  active companion's item with any other actor's item, a free-mode companion beat, and a human's turn.
- **FR-004**: Nothing after the Director changes. Resolve's code fight end (`directorClosing`), the
  turn advance, the interpret pre-pass, the cut and narrate run unchanged.

### Tests (AC #1, brief)

- **FR-005**: `test/dm/runner.test.ts` MUST prove, with stub nodes, that the director node is not
  called and `results.director` equals the stay-put output for a turn-mode beat whose only item is
  the active companion's. It MUST prove the director node is called for: a free-mode companion beat;
  a turn-mode beat with the companion's item and a human's item; a turn-mode human turn; and a beat
  with a checkpointed Director (checkpoint reuse wins).
- **FR-006**: `test/dm/companion-turn-intents.integration.test.ts` MUST drop the scripted
  `dm.director` reply. The gateway is strict, so a Director call fails the job. Each existing case
  MUST assert no `dm.director` call.
- **FR-007**: A new DB case MUST play a companion's turn whose attack drops the last standing foe, and
  assert: no `dm.director` call; an `encounter.ended` row; table mode `free` with reason
  "No foe still stands." Put it in `companion-turn-intents.integration.test.ts`, or in
  `encounter-auto-end.integration.test.ts` if that file's world builds it with less setup.
- **FR-008**: `test/ai-round.bench-test.ts` MUST assert `count("dm.director")` is 1.
  `test/dm/scripts/ai-round-4v4.json` MUST drop its three companion-beat Director replies (notes
  `beat 1`–`beat 3`), keeping `beat 0` (the human's turn).
- **FR-009**: Every committed DM script and fixture that scripts a Director reply for a turn-mode
  companion beat MUST drop it. The scripted purpose queues are strict per purpose, so a stale reply
  would be consumed by the next Director call. Known files (from a scan at `b6a6f683`):
  `test/dm/scripts/turn-floor-round.json` (note "Odo's committed action"),
  `test/dm/scripts/fight-round.json` (notes "companion action" and "back to free mode; scene ends"),
  and the files that copy the fight segment: `test/dm/scripts/greyhollow-ford-full.json`,
  `test/dm/scripts/greyhollow-ford-deeds.json`, `test/playtest/fixtures/downed-seat.json`.
  `apps/server/dm-scripts/runbook-a-reed-camp.json` and `runbook-b-reed-camp.json` script
  "companion action" and "Odo attacks goblin-3" Directors too; the build MUST check whether those
  beats are turn-mode companion beats and drop them if so.

### The fight segment's scene end (FR-009 consequence)

- **FR-010**: `fight-round.json` ends the scene through the Director on Kestrel's turn. That beat now
  has no Director. The scene end MUST move to Tamsin's round-2 turn, the next model-Director beat.
  The segment MUST script, in consumption order: the monster turns between Kestrel's turn and
  Tamsin's round-2 turn (one `dm.narrate` each, and dice for each code-built attack; pick d20 faces
  that miss so no party member drops), then Tamsin's strike (the moved scene-end Director reply, its
  `dm.interpret`, its dice, its `dm.narrate`). The build reads the initiative order from the run, not
  from this spec. The same edit MUST land in every file that copies the segment, and
  `scene.integration.test.ts`'s "full is the parts" check MUST still pass.
- **FR-011**: Tests that drive the fight segment MUST play Tamsin's round-2 strike and update their
  counts to the new script: `scene.integration.test.ts` (narration, turn-job and companion-job counts;
  one more `commitAction`), `test/playtest/playtest.integration.test.ts` (segment count; the driver
  repeats the combat move on its own), `playtests/fixtures/greyhollow-ford.audit.json` (one
  `playtest.audit` pass per new segment) and `test/playtest/harness.integration.test.ts` (the
  downed-seat case). Every changed count MUST be stated in the commit message.

### Post-merge (AC #2)

- **FR-012**: After the merge deploys to hosted dev, the operator re-runs the hosted combat smoke run
  (the TASK-0338 driver) and records round time and each companion turn's calls on the card. This is
  a playtest step, not a build task.

## Success criteria

- **SC-001**: `runner.test.ts` passes FR-005's five cases.
- **SC-002**: `companion-turn-intents.integration.test.ts` passes with no scripted `dm.director` reply
  and asserts no `dm.director` call per case (FR-006).
- **SC-003**: The FR-007 case passes: a companion's killing blow ends the fight in code with no
  Director call.
- **SC-004**: `pnpm check:timing` prints `director=1` on the `ai-round 4v4` line and passes.
- **SC-005**: `pnpm ci:check` is green with every script spent (`scriptRemaining` zero, chronicle
  aside) where a test asserts it today.
- **SC-006** (post-merge): the hosted re-measure records, for each companion turn, no `dm.director`
  ledger row in its commit turn job, and records round time per round.

## Expected saving (question 5)

Measured Director time on companion turns (6031b671, round 1): Odo 9.9 s, Kestrel 18.7 s. The
2026-11-14 run (8c7d506e) had two live companions in all three rounds, at 22–37 s per companion
turn and 95–104 s per round.

- **Per companion turn:** about 10–19 s and one opus call ($0.056–0.074).
- **Per round with two companions:** about 25–30 s and about $0.13. Rounds of 95–104 s would fall to
  about 66–78 s.
- **Against exit 3 (60 s): not enough alone.** In the retest, rounds 2 and 3 had no live companion
  (Odo unconscious and Kestrel dead after round 1) and still took 81 s and 70 s. Monster turns took
  6.8–20.9 s each, and a monster turn's only model call is its `dm.narrate`. Tamsin's turns took
  11.5–27.0 s. OQ-4 records the next lever.

## Scope

- **In**: `COMPANION_DIRECTOR` and its runner check, the tests in FR-005–FR-008, the script and
  fixture edits in FR-009–FR-011, one contract amendment, wiki.
- **Out**: the `dm.adjudicate` call (OQ-2); the chronicle wait (OQ-3); monster-turn and human-turn
  latency (OQ-4); the hosted re-measure as a build task (FR-012). Engine packages, `nodes/director.ts`,
  `prompts/director.ts`, `companion.ts`, `nodes/resolve.ts`, `worker.ts` and `jobs.ts` are not edited.

## Open questions

- **OQ-1 — Scene end, trackers and arrivals on a companion's turn.** D2 moves them to the next
  model-Director beat. A fight may now run one companion turn past the moment a model Director would
  end it. Default: accept, as spec 107 OQ-8 did for monster turns. Recommend no card. Revisit if a
  playtest shows a scene end or arrival landing a turn late and a player notices.
- **OQ-2 — `dm.adjudicate` on a companion's turn (Odo, 4.5 s, opus).** A ruling decides what the
  engine cannot, so the call stays. Default: no change here. Recommend the orchestrator card a
  config-only change with a trigger: if the re-measure shows `dm.adjudicate` above 3 s on a companion
  turn, move the `dm.adjudicate` purpose to a sonnet-tier model in the hosted `AI_PURPOSES` (no code
  change; the prompt asks for a decision and a tier only).
- **OQ-3 — The commit job waits for a running chronicle job (2.0 s).** The worker runs one job at a
  time. Options for a later card: let chronicle jobs run in a second worker lane, or hold chronicle
  jobs while a session is in turn mode. Default: no change here. Recommend a card with the trigger:
  the re-measure shows a chronicle wait above 1 s before a turn job in two or more turns of a round.
- **OQ-4 — Exit 3 needs more than this card.** Rounds without live companions still took 70–81 s.
  Recommend the orchestrator card "profile one hosted monster turn and one human turn" with this
  trigger: the AC #2 re-measure shows a round above 60 s. Two candidates to time: each monster turn's
  `dm.narrate` call, and whether the next actor's job waits on the previous turn's narration (the
  11.5 s `dm.narrate` tail at the start of Kestrel's turn suggests it does).
- **OQ-5 — AC #2 needs live companions in more than one round.** The retest's party was down by
  round 3 and the encounter never ended (TASK-0354). Default: re-measure with the same driver.
  Report round 1 alone if the companions drop again. Recommend sequencing the re-measure after
  TASK-0354 if that card lands first.
