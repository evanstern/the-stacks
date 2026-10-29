# Quickstart: a human DM ends an encounter and changes table mode (live check)

Card AC #1 and #2. This runs on the worktree stack in script mode (`DM_FAKE_SCRIPT`, spec 053). No
provider key is used. Phase 4 of `tasks.md` runs it and records it in `evidence/live-run.md`.
Browser automation uses Brave. The UI has no modals.

## Prerequisites

- Phases 1 and 2 are on the branch.
- `pnpm install --frozen-lockfile` and `pnpm build` done in the worktree.
- The root checkout's `.env` does not hold `DM_FAKE_SCRIPT`.

## Steps

1. Bring the stack up and migrate it as in `specs/053-env-fake-dm-script/quickstart.md` steps 1
   and 2 (`<env>` is `task-0165`).
2. Append `DM_FAKE_SCRIPT=greyhollow-human-dm` to the worktree `.env` with `printf '\n...\n' >>`.
   Recreate the app container. Check the boot log for `DM script mode: greyhollow-human-dm`. The
   shipped script fits: this check needs only the human-DM scene start (plan.md R7).
3. Create the operator and one player as in `specs/055-human-dm-scene-change/quickstart.md` step 3.
   Generate every password randomly. Keep them in an untracked JSON file outside the repo. Never
   print them.
4. Run `node specs/055-human-dm-scene-change/evidence/start-human-dm.mjs <creds-file>`. It seats
   the operator as the human DM and starts `greyhollow-ford` with the player on Tamsin.
5. Open the play URL in Brave as the operator. Carry out the scene suggestion from "Change scene"
   (spec 055). In "Pending proposals", approve the scene-start suggestions (party, combatants,
   tracker, presence).
6. Run `node specs/060-human-dm-encounter-mode/evidence/start-encounter.mjs <creds-file> <session-id>`
   (Phase 4 writes it). As the seated DM, over `/ws`, it sends `mechanics`
   `{ type: "initiative.roll", participants: [{ combatantId: <Tamsin's>, mode: "normal" }], reason }`,
   where Tamsin's combatant id is the `combatantId` on her `party.member.changed` row (read from
   `GET /dm/sessions/<id>/events`),
   then `table-mode` `{ mode: "turn", activeActor: <player id>, activeCharacterId: "tamsin" }`. It
   prints each result and never a secret. The player is the only active actor, so no AI DM turn is
   queued.
7. Reload the play URL. Expect "Turn mode · Tamsin Vale's turn" and the turn-order strip. Open
   "Table mode". Expect "Turn mode", "Encounter active.", "End encounter" and "Switch to free mode",
   with "The encounter stays active.". Take the `panel-turn` shots.
8. Click "Switch to free mode". Expect the badge "Free mode" and no turn-order strip. Reopen the
   panel. Expect "Switch to turn mode" and "End encounter". Take the `panel-free-encounter` shots.
9. Click "Switch to turn mode". Expect the badge to name Tamsin again (OQ-3 (a)).
10. Type a reason. Click "End encounter". Expect "Free mode", no turn-order strip, and in the ledger
    an `encounter.ended` row and a `table-mode.changed` row by the operator. Reopen the panel. Expect
    "No encounter.", no action buttons, and "Turn mode needs an encounter. The AI DM starts one."
    Take the `ended` shots.
11. On the debug page, expect no turn job queued after step 6 (OQ-6 (a)). Record the job list.
12. Open the play URL as the player. Expect the same badge and no "Table mode" button. Take
    `player-no-control-1280-light.png`.
13. Remove the `DM_FAKE_SCRIPT` line and recreate the app container. Leave the stack up.

## Screenshots (Brave, `evidence/shots/`)

Take each at 1280 px and 390 px wide, in light and dark (4 shots per state):
`panel-turn-<width>-<theme>.png`, `panel-free-encounter-<width>-<theme>.png`,
`ended-<width>-<theme>.png`. Also `player-no-control-1280-light.png`. No shot may show a modal.

## Expected refusals

- A player who sends a `table-mode` or `mechanics` frame by hand gets `NOT_AUTHORIZED`.
- A second "End encounter" sent by hand after the end gets `NO_ACTIVE_ENCOUNTER` (source `engine`).
