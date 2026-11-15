# Implementation Plan: A deed posted mid-narration is audited against the narration that tells it

**Spec**: `specs/115-deed-mid-narration/spec.md` | **Card**: TASK-0350 | **Branch**: `task-0350-deed-mid-narration`
**Authored against**: `origin/main` `3525683f`.

## Summary

The runtime already tells a mid-narration deed in the next narration. The auditor assigns it by
transcript position, so it blames the in-flight narration. The fix is auditor-side: export each
turn job's `factsThrough` and `narration.seqs`, and cut each segment at its narration's window.
No runtime change, no migration, no prompt bump, no new dependency.

## Constitution Check (3.0.0)

| Principle | Verdict |
|---|---|
| I Agent-operable | Pass, strengthened. The auditor reads the window the runtime recorded; a CI test replays the hosted race. |
| II One Intent vocabulary | Pass. Untouched. |
| III Event-sourced, server authority | Pass. No event type or payload changes. The export reads existing job records. |
| IV Three data planes | Pass. Playtest export reads `jobs` only. |
| V Many views, one state | Pass. The `/dm` turns route item is unchanged. |
| VI Engine owns the numbers | Pass. `dice-lines` still rebuilds from the ledger. |
| VII Narration around facts | Pass. The check compares each narration to the facts it read. |
| VIII Campaign is data | Pass. Seeds unchanged. |
| IX UX quality bar | Pass. Spec 108 AC #4 holds: no Intent is held while a narration streams. |
| X Grounded claims carry citations | Pass. The spec cites the hosted job records. |
| XI Operator-owned content | Pass. |
| XII Self-hostable | Pass. No config change. |
| XIII Plan just-in-time | Pass. Talk-turn windows are deferred as OQ-1 with a trigger. |

## Design

### D1 — Export the window (`playtest/export.ts`)

`JobItem` gains two optional fields:

```ts
/** Spec 115: the checkpoint's `factsThrough` (spec 104 FR-018); null when absent. */
factsThrough?: number | null;
/** Spec 115: the narration seqs the job shipped; [] when none. */
narrationSeqs?: number[];
```

`toJobItem` reads `result.checkpoint.factsThrough` and `result.checkpoint.narration.seqs` for
`kind === "turn"`; other kinds get `null` and `[]`. `readRunDir` needs no change: it casts
`jobs.json`, and the fields are optional. The `/dm` turns route keeps its own `toItem`.

### D2 — Cut-aware segments (`playtest/auditor/segments.ts`)

```ts
/** Spec 115: narration seq → its job's facts window end. */
export function narrationCuts(
  jobs: readonly { factsThrough?: number | null; narrationSeqs?: number[] }[],
): Map<number, number>;
export function segment(transcript, ledger, cuts?: ReadonlyMap<number, number>): Segment[];
```

- `narrationCuts`: for each job with a number `factsThrough`, map each of its `narrationSeqs` to
  it. Import the field shape structurally; do not import `export.ts` (it pulls DB code).
- `segment`: list the DM narrations in seq order. For narration k at seq N:
  `cut[k] = clamp(cuts.get(N) ?? N − 1, cut[k−1], N − 1)`, with `cut[−1] = 0`.
  Segment k's rows are the non-DM-narration rows with seq in `(cut[k−1], cut[k]]`, then the
  narration row. `fromSeq` and `toSeq` are the first and last row seq (the narration is last).
  Its ledger is the ledger rows whose seq is in its row set.
- The tail is the rows after the last cut that are not DM narrations. It closes on `talk` or a
  deed carrier, as today.
- With `cuts` absent or empty, every cut is `N − 1`. That is today's rule exactly (FR-005).
- `toSeq` already bounds the `nameResolver` projection in `checks.ts`; the narration is the last
  row, so the projection still covers every row in the segment. `checks.ts` is not edited.

Walkthrough on 8c7d506e (spec Summary §4): cuts `{68: 67, 81: 77, 86: 82, 88: 87}`. Segment 81
holds 69–77 (the NPC attack); 86 holds 78–80, 82 (the first `/attack`); 88 holds 83–85, 87
(the second). 243 (cut 233) holds the NPC miss; 252 (cut 251) holds 234–242 and 244–251.

### D3 — Wiring (`auditor/audit.ts`, `playtest/cli.ts`)

- `runAudit`: `segment(transcript, input.ledger, narrationCuts(input.jobs))`.
- `cli.ts` provider preflight (L514): pass `narrationCuts(contents.jobs)` so the segment count
  matches the audit.

### D4 — Tests (fake gateway only)

- `test/playtest/checks.test.ts` (unit, extend `describe("segments")`):
  1. `segment(t, l)` deep-equals `segment(t, l, new Map())` on the clean fixture.
  2. The 8c7d506e shape from plain rows (SC-001). Build rows with the file's existing row helpers.
     Without cuts: a `deeds-narrated` finding at 80 and a `dice-lines` finding at 81. With cuts:
     every check passes on every segment. Also assert segment 86 holds seq 78–80.
  3. A cut is clamped: a cut below the previous cut, or at or above N, still yields disjoint,
     ordered segments.
  4. `narrationCuts` maps narration seqs and skips jobs with no `factsThrough`.
- `test/playtest/audit.test.ts`: unchanged; it must still pass (fixtures carry no new fields).
- `test/dm/deed-mid-narration.integration.test.ts` (DB, new; FR-007, FR-008):
  1. `inTurnMode` (from `encounter-lifecycle.ts`) with the turn order giving a goblin the next
     turn, then the party member Tamsin. Script `dm.narrate` twice (monster, intent) and spare
     `dm.chronicle` calls. Dice: initiative, the monster attack, Tamsin's attack.
  2. Wrap the gateway with `pausing` so the monster turn's `dm.narrate` stalls. Enqueue the
     `npc-turn` and start `worker.processOne()`. Await `reached`.
  3. As the player, submit a confirmed `/attack` Intent (parse the slash line, or build it as
     `ai-actor-parity.integration.test.ts` does). Expect `ok`.
  4. `release()`, await the job, then `drainAll`.
  5. Assert the race shape: the deed carrier's seq is below the monster narration's seq; that
     narration has no `Deed:` line; a later narration has the deed's `Deed:` line.
  6. `exportSession`, then `runAudit({ ..., gateway: null, seed })`. Every segment passes
     `deeds-narrated` and `dice-lines`.
  7. Control: rerun `runAudit` with `factsThrough` stripped from every job. Expect a
     `deeds-narrated` finding citing the carrier seq.
  If the turn order in the fixture does not reach Tamsin after one monster turn, pick the seed
  and dice that do and record why in the commit.
- `pausing` moves from `narration-stream-gate.integration.test.ts` to `test/dm/worker-world.ts`
  as an export, so both files share it. The spec 108 test imports it; its body is unchanged.

## Files

| File | Change |
|---|---|
| `apps/server/src/playtest/export.ts` | `JobItem.factsThrough`, `JobItem.narrationSeqs`; `toJobItem` fills them |
| `apps/server/src/playtest/auditor/segments.ts` | `narrationCuts`; `segment` takes `cuts` |
| `apps/server/src/playtest/auditor/audit.ts` | pass cuts to `segment` |
| `apps/server/src/playtest/cli.ts` | pass cuts in the provider preflight count |
| `apps/server/test/playtest/checks.test.ts` | D4 unit cases |
| `apps/server/test/dm/deed-mid-narration.integration.test.ts` | new: the 8c7d506e replay |
| `apps/server/test/dm/worker-world.ts` | export `pausing` |
| `apps/server/test/dm/narration-stream-gate.integration.test.ts` | import `pausing` |
| `specs/032-playtest-harness/contracts/auditor.md` | "Segments": the window cut |
| `specs/032-playtest-harness/contracts/run-directory.md` | `jobs.json`: two optional fields |
| wiki | Phase 3 |

Not edited: `dm/enqueue.ts`, `dm/deeds.ts`, `dm/nodes/narrate.ts`, `dm/pipeline/runner.ts`,
`dm/talk-turn.ts`, `dm/worker.ts`, `auditor/checks.ts`, `routes/dm.ts`, the gate, the stream,
`dm/prompts/react.ts` and `dm/nodes/schemas.ts` (TASK-0347).

## Migrations, prompts, dependencies

- Migrations: none.
- Prompts: none.
- Dependencies: none.

## Flags

- The committed CI evidence (`specs/032-playtest-harness/evidence/ci-playtest/jobs.json`) has no
  new fields. It audits as before. Do not regenerate it in this card.
- TASK-0347 edits `dm/prompts/react.ts` and `dm/nodes/schemas.ts`. This plan touches neither.

## Size and split check

Three phases, each one sonnet dispatch. Phase 2 needs Phase 1's `narrationCuts` and export fields.
