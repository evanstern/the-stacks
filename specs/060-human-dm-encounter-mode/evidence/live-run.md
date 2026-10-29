# Live run: human DM Table mode controls (T027, T028)

**Date**: 2026-10-28. **Stack**: `stacks-task-0165` (app :3165), branch
`task-0165-human-dm-encounter-mode` at cb0545bb. **Mode**: script mode,
`DM_FAKE_SCRIPT=greyhollow-human-dm` (boot log: `DM script mode: greyhollow-human-dm (10 calls, 1
dice)`). No provider key was used. **Browser**: Brave, driven by `evidence/shoot-live.mjs`
(playwright-core, headed). The encounter is started by `evidence/start-encounter.mjs` (T027).

Accounts: the operator (created in the app container) and one player (`tamsin-player`, through an
invitation). Passwords were generated randomly and kept in an untracked creds file outside the repo.

## First run: a defect (fixed in cb0545bb)

Session `b58f585a-b39d-4661-850b-5dadc6846ddd`, at 93955186. Steps 4 to 7 passed. At step 8,
"Switch to free mode" with a blank reason sent nothing: `modeInput` passed `reason: ""`, and
`tableModeFrame` refused it. The session log ended at the step 6 `table-mode.changed` row. The fix
(T019a) gives the mode switches the `tableModeReason` default, as `contracts/table-mode-control.md`
says. A second run reached step 10 and stopped on a script timing issue (it clicked while the panel
closed after an action); the script now waits for the close and reopens the panel.

## Final run

Session `8daf454b-2f8d-4c3e-8365-d3d21b530405`, at cb0545bb, app container rebuilt.

| Step | Check | Result |
|---|---|---|
| 4-5 | Human DM seated; scene suggestion carried out; 10 scene-start suggestions approved | done |
| 6 | `start-encounter.mjs`: `mechanics` initiative.roll (Tamsin only), then `table-mode` turn | `dice.rolled` (and `encounter.started`, seq 49 in the first run's log), `table-mode.changed` |
| 7 | Badge "Turn mode · Tamsin Vale's turn"; turn-order strip | PASS |
| 7 | Panel: "Turn mode. Encounter active.", End encounter, Switch to free mode, "The encounter stays active.", no Switch to turn mode | PASS |
| 8 | Switch to free mode (blank reason): badge "Free mode", no turn-order strip | PASS |
| 8 | Panel: "Free mode. Encounter active.", Switch to turn mode, End encounter (OQ-4 (a)) | PASS |
| 9 | Switch to turn mode: badge names Tamsin again (OQ-3 (a)) | PASS |
| 10 | Reason "The bandits scatter into the reeds", End encounter: badge "Free mode", no strip | PASS |
| 10 | New rows, in order: `encounter.ended`, `table-mode.changed` (`after.mode` free, the typed reason), both by the operator, public (OQ-2 (a)) | PASS |
| 10 | Panel: "Free mode. No encounter.", "Turn mode needs an encounter. The AI DM starts one.", no action buttons | PASS |
| 11 | Jobs before step 6: 13; after step 10: 13; no new job (OQ-6 (a)) | PASS |
| 12 | The player: "Free mode" badge, no "Table mode" button (OQ-5 (a)) | PASS |
| all | No modal in any shot | PASS (0 dialogs) |

## Shots (`evidence/shots/`)

- `panel-turn-{1280,390}-{light,dark}.png`: step 7.
- `panel-free-encounter-{1280,390}-{light,dark}.png`: step 8.
- `ended-{1280,390}-{light,dark}.png`: step 10.
- `player-no-control-1280-light.png`: step 12.

## Teardown

The `DM_FAKE_SCRIPT` line was removed from the worktree `.env` and the app container recreated; the
boot log no longer shows script mode. The stack is left up.
