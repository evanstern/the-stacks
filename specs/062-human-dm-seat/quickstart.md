# Quickstart: the operator seats a human DM and returns the seat (live check)

Card AC #1, #2 and #3. This runs on the worktree stack in script mode (`DM_FAKE_SCRIPT`, spec 053).
No provider key is used. Phase 5 of `tasks.md` runs it and records it in `evidence/live-run.md`.
Browser automation uses Brave. The UI has no modals. Steps 5 to 12 follow the new
`docs/ops/dev-vm-104.md` "Seat a human DM" section, so the run also proves the runbook.

## Prerequisites

- Phases 1 to 4 are on the branch.
- `pnpm install --frozen-lockfile` and `pnpm build` done in the worktree.
- The root checkout's `.env` does not hold `DM_FAKE_SCRIPT`.

## Steps

1. Bring the stack up and migrate it as in `specs/053-env-fake-dm-script/quickstart.md` steps 1
   and 2 (`<env>` is `task-0177`).
2. Append `DM_FAKE_SCRIPT=greyhollow-human-dm` to the worktree `.env` with `printf '\n...\n' >>`.
   Recreate the app container. Check the boot log for `DM script mode: greyhollow-human-dm`.
3. Create the operator and two players (`ana`, `bram`) as in
   `specs/055-human-dm-scene-change/quickstart.md` step 3. Generate every password randomly. Keep
   them in an untracked JSON file outside the repo. Never print them.
4. Open Table as the operator and press `Start a new table`. Open the `/play/<uuid>` link in Brave
   as the operator, as `ana` and as `bram` (three browser profiles). Check the presence strip shows
   three names.

### Seat before a scene (US1)

5. As the operator, open "DM seat". Expect "AI DM holds the seat.", the select "Seat a human DM"
   listing the operator as "<name> (you)", `ana` and `bram`, and no "Return the seat to the AI DM".
   Take the `panel-ai` shots.
6. Pick the operator. Leave the reason blank. Press "Seat as DM". Expect the panel to close, the
   presence strip to mark the operator DM, and "Pending proposals", "Change scene" and "Table mode"
   in the operator's header.
7. Open "Start scene". Pick `greyhollow-ford`. Put the operator on `Tamsin Vale`. Expect the issue
   "The DM cannot hold a character seat." and Start disabled. Put `ana` on `Tamsin Vale`. Press
   Start. Expect "Scene start waiting for the DM.".
8. Carry out the scene suggestion from "Change scene" (spec 055 quickstart steps 6 to 8). In
   "Pending proposals", approve the scene-start suggestions except the tracker. Leave the tracker
   pending.

### Hand the seat to another account during the scene (US1, US2, OQ-4, OQ-5)

9. Open "DM seat". Expect "<operator> holds the seat.", the select listing `bram` only (`ana`
   controls Tamsin, the operator holds the seat), "Return the seat to the AI DM", and "Pending
   proposals stay pending under the AI DM: 1. Decide them first.". Take the `panel-human` shots.
10. Pick `bram`. Type a reason. Press "Seat as DM". In `bram`'s window, expect the DM view without
    a reload: "Pending proposals (1)" holding the tracker suggestion made before `bram` was seated,
    "Change scene" and "Table mode". In the operator's window, expect the player view and no
    "Pending proposals". Take the `bram-dm` shots.
11. On the debug page, expect one `dm.seat.changed` row per press, each by the operator, with
    `before` and `after` as pressed. Record the seqs.

### Return the seat (US2)

12. As the operator, open "DM seat". Expect "<bram> holds the seat." and no pending warning (the
    operator is not seated, so sees no `dm` rows). Press "Return the seat to the AI DM". Expect the
    presence strip to show the AI DM, and `bram`'s window to drop to the player view. Take the
    `returned` shots.
13. As `ana`, check there is no "DM seat" button. Take `player-no-control-1280-light.png`.
14. Remove the `DM_FAKE_SCRIPT` line and recreate the app container. Leave the stack up.

## Screenshots (Brave, `evidence/shots/`)

Take each at 1280 px and 390 px wide, in light and dark (4 shots per state):
`panel-ai-<width>-<theme>.png`, `panel-human-<width>-<theme>.png`, `bram-dm-<width>-<theme>.png`,
`returned-<width>-<theme>.png`. Also `player-no-control-1280-light.png`. No shot may show a modal.

## Expected refusals

- A player who sends a `dm.seat` frame by hand gets `NOT_AUTHORIZED`.
- A `dm.seat` frame with a non-uuid `userId` sent by hand gets `INVALID_PROPOSAL`.
