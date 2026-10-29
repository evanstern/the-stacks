# Live run: operator seats a human DM (T027)

**Date**: 2026-10-29. **Stack**: `stacks-task-0177` (app :3177), branch `task-0177-human-dm-seat`.
**Mode**: script mode, `DM_FAKE_SCRIPT=greyhollow-human-dm` (boot log: `DM script mode:
greyhollow-human-dm (10 calls, 1 dice)`). No provider key; no paid run. **Browser**: Brave, three
contexts (operator, `ana`, `bram`), driven by `evidence/shoot-live.mjs` (playwright-core, headed).

Accounts: the operator was created in the app container; the script redeemed two invitations for
`ana` and `bram`. Every password is random and lives in an untracked file outside the repo. No
password or token appears here. The first script run stopped at a script bug (invitation field
selector) after creating the accounts; the final run reused them. Final session
`55cbb44c-3032-4d25-ba70-92d47d09bb1f`.

| Step | Check | Result |
|---|---|---|
| 1-2 | Stack up, both DBs migrated, script line appended, app recreated, boot log shows script mode | PASS |
| 3 | operator, `ana`, `bram` exist and sign in | PASS |
| 4 | New table; three contexts open it; presence strip shows operator, Bram, Ana | PASS |
| 5 | "AI DM holds the seat."; select "Seat a human DM" lists `operator (you)`, Bram, Ana; no Return button | PASS |
| 6 | Seat the operator, blank reason: panel closes; header has Pending proposals, Change scene, Table mode; strip marks operator DM | PASS |
| 7 | Operator on Tamsin: Start disabled; `ana` on Tamsin: Start enabled; Start shows "Scene start waiting for the DM." | PASS |
| 7 | Operator on Tamsin: inline issue "The DM cannot hold a character seat." | **FAIL (defect 1)** |
| 8 | Change scene seeded `greyhollow-ford`, Apply; 9 of 11 pending rows approved; the 2 tracker rows left pending | PASS |
| 9 | Panel reads "operator holds the seat."; select lists Bram only; Return button; "Pending proposals stay pending under the AI DM: 2. Decide them first." | PASS |
| 10 | Pick Bram with a reason, Seat as DM: Bram's window shows "Pending proposals (2)" (the two trackers), Change scene and Table mode, with no reload; operator's window loses Pending proposals | PASS |
| 11 | Debug page `dm.seat.changed` rows | PASS (see below) |
| 12 | Operator panel reads "Bram holds the seat.", no pending warning; Return: strip shows AI DM, Bram drops to player view | PASS |
| 13 | `ana` has no "DM seat" button (`player-no-control-1280-light.png`) | PASS |
| 14 | `DM_FAKE_SCRIPT` line removed, app recreated, boot log has no script mode, stack up and healthy | PASS |
| all | No modal in any shot (0 dialogs in all 17) | PASS |

Spec numbers: the quickstart says one tracker; the seed yields two tracker suggestions, so the
counts are 2, not 1. Not a product fault.

## `dm.seat.changed` seqs (step 11)

Seq 1 (operator seated before the scene), seq 45 (hand to Bram), seq 46 (return to the AI DM). All
three are by the operator. The script read the rows from the collapsed debug list, so `before` and
`after` were not read from the page (`evidence/debug-page.txt` holds the page text); the visible
effects in steps 6, 10 and 12 match the pressed values.

## Expected refusals

| Request | Result |
|---|---|
| Player (`ana`) sends `dm.seat` by hand | PASS: `NOT_AUTHORIZED` |
| `dm.seat` with `userId` "not-a-uuid" | PASS: `INVALID_PROPOSAL` |

## Defects

1. **Step 7: the "The DM cannot hold a character seat." text never renders.** Expected: with the DM on
   Tamsin, the Start scene slide-out shows the inline issue (spec FR-006, `start-scene.ts`
   `seatMapIssues`). Seen: Start is disabled (`ready` uses `seatMapIssues`), but no text shows.
   `StartSceneForm` renders only the `issues` prop from the server response (`issuesBySeat(issues)`),
   and `StartScenePanel` never feeds it the client-side `seatMapIssues`. The unit test passes the
   issues in by hand, so it does not catch the gap. Not fixed: the brief says to stop and report.

## Runbook walk (`docs/ops/dev-vm-104.md` "Seat a human DM")

Mismatches:
- Step 7 of the seat-before-scene list ("Expect `Scene start waiting for the DM.`") matches.
- The runbook says nothing of the missing issue text (defect 1), and it states the refusal
  "A start with the DM on a character seat shows `The DM cannot hold a character seat.`" That line
  is false until defect 1 is fixed.
- Otherwise the labels (`DM seat`, `Seat a human DM`, `Seat as DM`, `Reason (optional)`, `Return the
  seat to the AI DM`, the pending line) matched the run.

## Shots (`evidence/shots/`)

`panel-ai`, `panel-human`, `bram-dm`, `returned` at 1280 and 390 px, light and dark; and
`player-no-control-1280-light.png`. Run 1 left T027 unticked because step 7 failed; run 2 passes.

## Run 2 (after the step 7 fix, 80e8adf1 / T019a)

**Date**: 2026-10-29. Same stack, rebuilt with `docker compose -p stacks-task-0177 up -d --build
--force-recreate --wait app` (image created after the pull; no re-migration; `/health` ok). Script
line re-applied with `printf`; boot log `DM script mode: greyhollow-human-dm (10 calls, 1 dice)`.
Same script, accounts reused, new table `37e417a9-80af-4b28-ba3e-be25bb45e079`. The script now also
takes `start-dm-seat-issue-1280-light.png`.

| Step | Result |
|---|---|
| 3 | PASS (accounts exist, sign in) |
| 4 | PASS (three names in the presence strip) |
| 5 | PASS ("AI DM holds the seat."; `operator (you)`, Bram, Ana; no Return) |
| 6 | PASS (panel closes; header has Pending proposals, Change scene, Table mode; strip marks operator DM) |
| 7 | PASS: operator on Tamsin shows "The DM cannot hold a character seat." inline; Start disabled; Ana on Tamsin enables Start; "Scene start waiting for the DM." (defect 1 fixed) |
| 8 | PASS (Change scene seeded `greyhollow-ford`, Apply; 9 of 11 approved; 2 trackers pending) |
| 9 | PASS (select lists Bram only; Return button; "Pending proposals stay pending under the AI DM: 2. Decide them first.") |
| 10 | PASS (Bram sees "Pending proposals (2)", the tracker suggestions, Change scene, Table mode, no reload; operator loses Pending proposals) |
| 11 | PASS: `dm.seat.changed` at seq 1, 45 and 46, all by the operator |
| 12 | PASS ("Bram holds the seat.", no pending warning; Return puts the AI DM in the strip; Bram drops to the player view) |
| 13 | PASS (Ana has no DM seat button) |
| 14 | PASS (script line removed, app recreated, no script-mode log, stack up) |
| Refusals | PASS: player `dm.seat` gives `NOT_AUTHORIZED`; non-uuid `userId` gives `INVALID_PROPOSAL` |
| Shots | PASS: all shots regenerated, 0 dialogs; new `start-dm-seat-issue-1280-light.png` shows the inline issue in the slide-out |

Every step passed in run 2. T027 is ticked. The quickstart now says two tracker suggestions
(steps 8 to 10). Run 1's defect record above stays as history.
