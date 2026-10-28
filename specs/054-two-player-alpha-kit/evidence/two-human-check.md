# Two-human behaviour check (spec 054, T012)

Seed: `greyhollow-ford-duo` (tamsin and kestrel human, odo AI companion).

## Result

No defect found in the cases that ran without a database. The database cases are written and
await the orchestrator's run (see "Orchestrator-run" below). Any failure there is a defect to
card unless it blocks the seed from starting.

## Cases run (no database): `apps/server/test/dm/duo-views.test.ts`, 7 passed

- Snapshot: tamsin and kestrel hold `player` controllers for two distinct user ids; odo is an
  `ai-companion`.
- `dm` view: both humans are `party, player`; kestrel is never `ai-companion`; odo is `party, ai-companion`.
- `seat` view for tamsin and for kestrel: the other human shows as a `party, player` member with
  the full sheet.
- `fiction` view: Tamsin Vale and Kestrel read `human player`; Brother Odo reads `AI companion`.
- Interpret prompt: names both humans; kestrel is `party, player`; no user id appears.
- Narrate prompt: `Tamsin Vale (party, human player)`, `Kestrel (party, human player)`,
  `Brother Odo (party, AI companion)`; never `Kestrel (party, AI companion)`; no user id appears.

## Cases written, not yet run: `apps/server/test/dm/duo.integration.test.ts` (database, 4 cases)

The implementer could not export `TEST_DATABASE_URL`. The file skips without a database
(verified: 4 skipped).

1. Scene start through the real queue (`scene-start.json`, seats `{tamsin: A, kestrel: B}`): three
   party rows, `player` for A and B, `ai-companion` for odo, no failed job.
2. Party action, both present: A's commit is refused `GROUP_SIGNOFF_REQUIRED` (waiting `[B]`);
   B's approve commits (`action.commented`, `presence.recorded`, `action.committed`).
3. Party action, B absent: A's commit succeeds.
4. Turn mode (reed-camp via a resolve with the duo seed): A ends the turn, the floor moves to B,
   B is absent, the absence check passes B's turn to `ai:companion:odo`.

Assumptions the first run may falsify (fix the test, not the product, unless the seed is blocked):
case 3 asserts an explicit commit by A succeeds with B absent; case 4 assumes the
`turn-floor-round.json` dice give the order tamsin, kestrel, odo.

## Findings from reading the code

- The `seat` snapshot view has no "own character" marker for party members: `self` only widens
  the detail of a non-party actor. Both humans therefore render identically in every seat view.
  Not a defect today (party members always render in full). The spec task text expects a
  "marks that user's own character" assertion; the view does not produce one.
