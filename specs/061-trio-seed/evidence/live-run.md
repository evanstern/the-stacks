# Live run: three-player table (T016, T017)

**Date**: 2026-10-28. **Stack**: `stacks-task-0176` (app :3176), branch `task-0176-trio-seed` at
the T013 record commit. **Mode**: script mode, `DM_FAKE_SCRIPT=greyhollow-live` (boot log:
`DM script mode: greyhollow-live (9 calls, 1 dice)`). No provider key; no paid run. **Browser**:
Brave, three contexts, driven by `evidence/shoot-live.mjs` (playwright-core, headed).

Accounts: the operator was created in the app container. The script generated the player2 and
player3 passwords and kept every credential in an untracked file outside the repo. No password or
token appears in this record.

Session `41ba9d4f-86f1-432f-84d4-47829e70e587`.

| Step | Check | Result |
|---|---|---|
| 4 | Two distinct invitations created on Settings | PASS |
| 5 | player2 and player3 redeem; each lands signed in with no operator links | PASS |
| 6 | All three open the table; the presence strip shows three names | PASS |
| 7 | Seed `greyhollow-ford-trio`: selects `start-seat-tamsin`, `start-seat-odo`, `start-seat-kestrel`; no `AI companions:` note | PASS |
| 8 | Start disabled with two seats filled, and with player2 on two seats; enabled with three distinct players | PASS |
| 8 | Start closes the slide-out; header "Scene start queued." | PASS |
| 9 | The scripted opening narration in all three contexts | PASS |
| 9 | Speaker selectors: Tamsin Vale / Brother Odo / Kestrel, one each | PASS |
| 10 | Jobs: one `turn` job whose input carries `start` (the scene start), `succeeded`; one `chronicle` job; no `companion` job | PASS (see note) |
| all | No modal in any shot | PASS (0 dialogs) |

Note on step 10: the script's first version read a `trigger` field that the jobs route does not
return, so its scene-start check printed FAIL. A direct read of `GET /dm/sessions/<id>/jobs` showed
the fields `id, kind, status, stage, attempts, input, result, error, …` and a succeeded `turn` job
whose `input.start.seats` names all three players. The script now checks `input.start`. It was not
rerun: a rerun would redeem new invitations under the same usernames.

## Refusals (quickstart "Expected refusals")

| Request | Result |
|---|---|
| Trio start, one user on `odo` and `kestrel` (fresh session) | PASS: 400, `seats.kestrel` "A user can hold only one seat." |
| Trio start with two of three seats (fresh session) | PASS: 400, `seats.kestrel` "A human seat needs a user id." |
| Second start on the started session | PASS: 409 "The session already has a scene." |

## Runbook walk (T011)

`docs/ops/dev-vm-104.md` "Seat three players" matches the run: a second invitation, three names in
the presence strip, the trio seed in `Seed`, a different user per seat, no `AI companions:` note,
and one character per speaker selector.

## Shots (`evidence/shots/`)

- `start-scene-trio-{1280,390}-{light,dark}.png`: the slide-out with the trio chosen and three
  seats filled.
- `table-operator-*`, `table-player2-*`, `table-player3-*` at 1280 and 390 px, light and dark: the
  table after the opening in each context.

## Teardown

The `DM_FAKE_SCRIPT` line was removed from the worktree `.env` and the app container recreated; the
boot log no longer shows script mode. The stack is left up.
