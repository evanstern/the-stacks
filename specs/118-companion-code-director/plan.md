# Implementation Plan: Code Director for a companion's own turn

**Spec**: `specs/118-companion-code-director/spec.md` | **Card**: TASK-0321 | **Branch**: `task-0321-companion-director`
**Authored against**: `origin/main` `b6a6f683`.

## Summary

The runner gains one more code-Director check beside spec 107 D4's monster check. A turn-mode beat
whose items all belong to the active AI companion uses the stay-put output (`COMPANION_DIRECTOR`,
equal to `INTENT_DIRECTOR`) and makes no `dm.director` call. Tests prove the skip and the code fight
end. Committed scripts drop their companion-beat Director replies, and the fight segment moves its
scene end to Tamsin's round-2 turn. No migration, no prompt change, no new dependency, no engine
change.

## Constitution Check (3.0.0)

| Principle | Verdict |
|---|---|
| I Agent-operable | Pass. Companions act through the same Intents and gate as before. |
| II One Intent vocabulary | Pass. No Intent or schema change. |
| III Event-sourced, server authority | Pass. No event type changes. Resolve stays the only writer. |
| IV Three data planes | Pass. No plane touched. |
| V Many views, one state | Pass. No view change. |
| VI Engine owns the numbers | Pass. The engine and resolve's code fight end are unchanged. |
| VII Narration around facts | Pass. Narrate reads the same facts, with an empty `goalNote`, as on a monster turn. |
| VIII Campaign is data | Pass. Seeds unchanged. |
| IX UX quality bar | Pass, the point of the card. One opus call (10–19 s) leaves each companion turn. |
| X Grounded claims carry citations | Pass. The saving cites the AC #3 ledger profile. |
| XI Operator-owned content | Pass. |
| XII Self-hostable | Pass. No purpose or config change. |
| XIII Plan just-in-time | Pass. Adjudicate, chronicle wait and monster-turn latency wait for evidence (spec OQ-2–OQ-4). |

## Design

### D1 — Runner (`dm/pipeline/runner.ts`)

- Add `const COMPANION_DIRECTOR: NodeOutputs["director"] = INTENT_DIRECTOR;` with a comment citing
  spec 118 D1.
- Add a pure exported helper beside it, so the unit test can call it directly:

```ts
/** Spec 118 D3: a turn-mode beat whose items all belong to the active AI companion. */
export function companionOwnBeat(a: NodeOutputs["assemble"]): boolean {
  const mode = a.projections.tableMode;
  if (mode.mode !== "turn") return false;
  const actor = mode.activeActor;
  if (!actor?.startsWith("ai:companion:")) return false;
  if (a.npcTurn !== null || a.beat.length === 0) return false;
  return a.beat.every((b) => b.actor === actor);
}
```

- Read the installed `SessionProjections["tableMode"]` type first. If `activeActor` is not on the
  turn arm under that name, use the field the type has, and say so in the commit message.
- In the node loop, directly after the spec 107 D4 `npc-turn` check and before checkpoint reuse:

```ts
// Spec 118: the active companion's own turn needs no Director call.
if (
  name === "director" &&
  ctx.checkpoint.director === null &&
  ctx.results.assemble &&
  companionOwnBeat(ctx.results.assemble)
) {
  ctx = { ...ctx, results: { ...ctx.results, director: COMPANION_DIRECTOR } };
  continue;
}
```

- Store no Director checkpoint, as D4 stores none. A reclaim re-derives the same choice from the
  frozen beat.
- The post-interpret cut runs as today. In turn mode `cutPlans` cuts nothing, and `holdDirector` on a
  stay-put output changes nothing, so the stored `director` stays the stay-put output.

### D2 — Tests (fake gateway only)

- `test/dm/runner.test.ts` (extend, unit): spec FR-005. Use `stubNodes` and `assembled({...})` with
  `projections: { party: [], tableMode: { mode: "turn", activeActor: "ai:companion:odo", ... } }`
  and beat items carrying `actor`. Assert `spy` saw no director call and `results.director` equals
  the stay-put fields. Add the four keep-the-Director cases. Add direct `companionOwnBeat` cases if
  the stub setup is heavier than a pure call.
- `test/dm/companion-turn-intents.integration.test.ts` (extend, DB): spec FR-006. Remove `director`
  from `odoTurn`'s calls. Add `expect(purposes(w)).not.toContain("dm.director")` to each case.
- FR-007 case (DB): build the fight so one foe stands, give Odo an `attack` body on it, and script
  d20 and damage faces that drop it. Look at `encounter-auto-end.integration.test.ts` first; reuse its
  world if it already builds a one-foe fight. Assert no `dm.director` call, an `encounter.ended` row
  and a `table-mode.changed` row to `free` with reason "No foe still stands."
- `test/ai-round.bench-test.ts` and `test/dm/scripts/ai-round-4v4.json`: spec FR-008. Update the
  test title to "one director call".

### D3 — Scripts and fixtures

- Drop the Director reply of each turn-mode companion beat (spec FR-009). Find each one by its
  `note` and by running the test that consumes the file. A stale reply is consumed by the next
  Director call, which shifts every later decision; the symptom is a wrong scene end, a wrong mode
  or a spare reply at the end.
- `turn-floor-round.json`: drop "Odo's committed action". The test's `scriptRemaining` check then
  proves the change. `duo`, `trio` and `floor-jobs` read the same file; they seat humans or stop
  before Odo's turn, so expect no change. Confirm by running them.
- `fight-round.json` (spec FR-010): drop "companion action". Move the "back to free mode; scene
  ends" reply to Tamsin's round-2 strike. Script, in consumption order, each monster turn between
  Kestrel and Tamsin (one `dm.narrate` text each; d20 faces that miss), then Tamsin's strike: the
  moved Director reply, a `dm.interpret` reading (an `attack` stage on a standing goblin), its dice,
  and a `dm.narrate` text that tells the hit and Snag's offer. Read the initiative order and the dice
  each code-built monster attack draws from a run. Do not guess.
- Copy the new segment verbatim into `greyhollow-ford-full.json`, `greyhollow-ford-deeds.json` and
  `test/playtest/fixtures/downed-seat.json` (each copies the fight segment; downed-seat's dice differ,
  so drop its "companion action" reply and re-check the downed-seat path rather than copying dice).
- `dm-scripts/runbook-a-reed-camp.json`, `runbook-b-reed-camp.json`: check each Director reply that
  follows a `dm.companion` call. If it is a turn-mode companion beat, drop it. These live scripts
  have no test that spends them all; `dm-scripts.test.ts` checks shape only. Say in the commit
  message which replies were dropped.

### D4 — Tests that drive the fight segment (spec FR-011)

- `scene.integration.test.ts`: add one `commitAction` for Tamsin's round-2 strike after the round-1
  strike, then drain. Update the narration, turn-job and companion-job counts to what the new script
  plays.
- `test/playtest/playtest.integration.test.ts`: update `report.counts.segments`. The driver repeats
  `moves.combat.text` each human turn, so the scenario JSON needs no new move. Add the new
  segments' `playtest.audit` pass replies to `playtests/fixtures/greyhollow-ford.audit.json`.
- `test/playtest/harness.integration.test.ts`: re-run the downed-seat case; keep `stalled` and
  `seat-downed`.

### D5 — Contract amendment

Append to `specs/031-dm-runtime/contracts/director.md`:

> ## Amendment 2026-11-15 (specs/118-companion-code-director, TASK-0321): the companion's own turn
>
> A turn job whose beat items all belong to the active AI companion in turn mode, with no monster
> turn, makes no `dm.director` call. The runner supplies the stay-put output: `resolve`, `stay`, no
> trackers, `continue`, pacing `rising` with no spotlight or beat, an empty `goalNote`, no companion
> prompts, no arrivals, no overrides. Resolve's code fight end still runs. Scene end, tracker
> advances and arrivals wait for the next beat that calls the Director (spec 107 OQ-8, spec 118 D2).

## Files

| File | Change |
|---|---|
| `apps/server/src/dm/pipeline/runner.ts` | `COMPANION_DIRECTOR`, `companionOwnBeat`, the runner check |
| `apps/server/test/dm/runner.test.ts` | FR-005 cases |
| `apps/server/test/dm/companion-turn-intents.integration.test.ts` | no scripted Director; FR-006, FR-007 |
| `apps/server/test/ai-round.bench-test.ts`, `test/dm/scripts/ai-round-4v4.json` | FR-008 |
| `apps/server/test/dm/scripts/turn-floor-round.json`, `fight-round.json`, `greyhollow-ford-full.json`, `greyhollow-ford-deeds.json`, `test/playtest/fixtures/downed-seat.json` | D3 |
| `apps/server/dm-scripts/runbook-a-reed-camp.json`, `runbook-b-reed-camp.json` | D3, if a turn-mode companion beat |
| `apps/server/test/dm/scene.integration.test.ts`, `test/playtest/playtest.integration.test.ts`, `playtests/fixtures/greyhollow-ford.audit.json` | D4 |
| `specs/031-dm-runtime/contracts/director.md` | D5 |
| wiki | Phase 3 |

Not edited: `packages/*`, `nodes/director.ts`, `prompts/director.ts`, `companion.ts`,
`nodes/resolve.ts`, `intent-runner.ts`, `rulings.ts`, `worker.ts`, `jobs.ts`, `enqueue.ts`, the gate
and the web.

## Concurrency

A parallel session works in `.worktrees/task-0304` on engine files. This card edits no engine
package. The fight segment and the deeds script are shared with any card that adds scripted calls:
merge `origin/main` before Phase 2 and before the PR, and re-run the consuming tests after each
merge.

## Migrations, prompts, dependencies

- Migrations: none.
- Prompts: none. `dm.director-v12` is unchanged; it simply runs less often.
- Dependencies: none.

## Flags

- The fight segment edit (D3) is the largest part of the card. If the new segment cannot reach
  Tamsin's round-2 turn without a party member dropping, script hits that leave every PC up, or end
  the scene on Tamsin's round-1 strike with a Director reply there (it already has one: "human
  active actor"). The second option is smaller: merge the scene-end decision into that reply and drop
  Kestrel's turn from the segment's expectations. Pick the smaller edit that keeps
  `scene.integration.test.ts` meaningful, and say which in the commit message.
- The purpose queues are strict per purpose, not ordered across purposes. A dropped Director reply
  shifts only Director replies; narrate and interpret queues are unaffected.

**Operator ruling 2026-11-15 ("Yes, (b)"):** take the second option. The scene end folds into Tamsin's
round-1 "human active actor" Director reply. No monster turns are scripted and no round-2 strike is added.
The "companion action" and "back to free mode; scene ends" replies are dropped.

## Size and split check

Three phases, one sonnet dispatch each. Phase 1 is small (runner and direct tests). Phase 2 is the
script work; it is mechanical but needs runs to read the order and dice.
