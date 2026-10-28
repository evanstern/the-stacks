# Live run: a two-player table on the task-0163 stack

Date: 2026-10-28. Branch `task-0163-two-player-alpha-kit`, HEAD at run start `bca346e`.
Stack: `stacks-task-0163`, app `http://localhost:3163`. Browser: Brave (Playwright, two contexts).
No provider key, no paid call. Test accounts exist only on this local stack. Passwords were
generated at random and live only in the untracked scratchpad file. No password appears here.
The screenshots show the invitation token field; that token was redeemed and is dead.

## Setup

| Step | Command | Result |
| --- | --- | --- |
| Migrate app DB, credential-free | `docker build --target build -t stacks-task-0163-migrate .` then `docker run --rm --network stacks-task-0163_default --env-file .env -e TEST_DATABASE_URL= -w /app/apps/server stacks-task-0163-migrate node --experimental-strip-types scripts/migrate.ts` | `Migrations applied.` Migrate image removed. |
| Script mode | `printf '\nDM_FAKE_SCRIPT=greyhollow-live\n' >> .env`; `grep -c '^DM_FAKE_SCRIPT=' .env` | `1` |
| Rebuild and recreate app at HEAD | `docker compose -p stacks-task-0163 up -d --build --force-recreate --wait app` | app healthy |
| Boot line | `docker compose -p stacks-task-0163 logs app \| grep "DM script mode"` | `DM script mode: greyhollow-live (9 calls, 1 dice)` |
| Operator | `docker exec -e OPERATOR_PASSWORD=<generated> -e OPERATOR_USERNAME=operator stacks-task-0163-app-1 node dist/cli/create-operator.js` | `Operator account created: operator` |

`greyhollow-live` narrated the duo opening unchanged. No duo script was added (T034 branch not taken).

## Walk (`evidence/shoot-live.mjs`)

First run: the player account `player2` was created, then the script timed out choosing the seed
by label (the option text carries the seed id; see Corrections). The run was repeated with the
player `player2b` (the used `player2` account cannot be recreated without DB access).
The first run's invitation redeemed fine, so steps 4 to 7 passed twice.

Output of the second run (PASS lines; the no-modal and no-overflow lines are PASS in all 4 variants of every shot):

```
PASS step 4 invitation token shown
PASS step 4 expiry shown
PASS step 5 player redeemed and signed in (operator-only links visible: 0)
PASS step 6 second redeem refused: invalid, expired, or already redeemed
PASS step 7 presence strip shows both users
PASS refusal GET /dm/seeds as player: 403
PASS step 8 two human seats shown: 2
PASS step 8 Start disabled with one user on both seats
PASS step 8 Start enabled with distinct users
PASS step 8 note: AI companions: Brother Odo.
PASS step 9 opening narration arrived in both contexts
PASS step 9 no modal after Start
debug first job card: turn scene-start succeeded shipped 0 s attempts 1 3 calls 0 tokens unpriced
```

Session `3d21994f-4748-4b73-86c3-a1bf993f1216`. Opening narration in both contexts: "The party
reaches Greyhollow Ford as the light goes amber. ..." The presence strip showed `AI DM`,
`operator`, `Player Two`. The operator's speaker selector offered Tamsin Vale. The player's
offered Kestrel. Brother Odo shows in no chip and in no table text. Step 10: the debug page
shows a succeeded scene-start turn job, 3 calls, 0 tokens.

## Refusals (`evidence/refusals.mjs`)

| Request | Result |
| --- | --- |
| `GET /dm/seeds` as `player2b` | 403 `You do not have permission to perform this action.` |
| Start, one user on both seats, fresh session | 400 `Request validation failed.`; issue `seats.kestrel`: `A user can hold only one seat.` |
| Second start on the started session | 409 `The session already has a scene.` |
| Second redeem of a used token (UI, fresh context) | `This invitation is invalid, expired, or already redeemed.` |

The UI also holds `Start` disabled while one user fills both seats.

## Screenshots (`evidence/shots/`, each at 1280 and 390 px, light and dark)

- `redeem-form-<width>-<scheme>.png`: the sign-in card in redeem mode.
- `invite-section-<width>-<scheme>.png`: Settings, `Invite a player`, after creation.
- `start-scene-<width>-<scheme>.png`: the Start scene slide-out with both seats chosen.
- `table-operator-<width>-<scheme>.png` and `table-player-<width>-<scheme>.png`: both tables after the opening.

No modal appeared in any shot. No horizontal overflow in any shot.

## Corrections made by this run

1. The `Seed` option reads `Greyhollow Ford (two players) (greyhollow-ford-duo)`. The runbook step 14 and quickstart step 8 now say so.
2. The table shows no Brother Odo chip. Runbook step 19 and quickstart step 9 now say the speaker selector offers only the viewer's own character.
3. The duplicate-seat message sits in `issues[0].message`, not `error.message`. The runbook and quickstart now say "first issue".

## Not done

`pnpm ci:check` was run without `TEST_DATABASE_URL` (the agent may not export it): web 245 pass, 0 fail;
the server DB integration suites skip or fail without a database, so the gate needs the orchestrator's
`REQUIRE_DATABASE=1` run. T035 stays unticked for that reason.
