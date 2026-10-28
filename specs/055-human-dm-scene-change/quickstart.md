# Quickstart: a human DM carries out the scene-start suggestion (live check)

Card AC #1 and #2, SC-002. This runs on the worktree stack in script mode (`DM_FAKE_SCRIPT`, spec
053). No provider key is used. Phase 5 of `tasks.md` runs it and records it in
`evidence/live-run.md`. Browser automation uses Brave. The UI has no modals.

## Prerequisites

- Phase 4 is merged on the branch: `apps/server/dm-scripts/greyhollow-human-dm.json` exists.
- `pnpm install --frozen-lockfile` and `pnpm build` done in the worktree.
- The root checkout's `.env` does not hold `DM_FAKE_SCRIPT`.

## Steps

1. Bring the stack up and migrate it as in `specs/053-env-fake-dm-script/quickstart.md` steps 1
   and 2 (`<env>` is `task-0159`).
2. Append `DM_FAKE_SCRIPT=greyhollow-human-dm` to the worktree `.env` with `printf '\n...\n' >>`.
   Recreate the app container. Check the boot log for `DM script mode: greyhollow-human-dm`.
3. Create the operator inside the app container (053 quickstart step 6). Create one player through
   an invitation (the TASK-0163 routes; reuse `specs/054-two-player-alpha-kit/evidence/` scripts
   where they fit). Generate every password randomly. Keep them in an untracked JSON file outside
   the repo. Never print them.
4. Run `node specs/055-human-dm-scene-change/evidence/start-human-dm.mjs <creds-file>`. It signs in
   as the operator, sends `dm.seat` (`after: { kind: "human", userId: <operator id> }`) over the
   WebSocket, starts `greyhollow-ford` with the player on the human seat, and prints the play and
   debug URLs.
5. Open the debug URL as the operator. Expect a `succeeded` scene-start turn job. Its scene
   proposal is `pending`, policy `suggest`. The header on the play URL shows "No scene yet".
6. Open the play URL in Brave as the operator (now the seated DM). Open "Change scene". Expect the
   "Suggestions" list with the scene-start seed and the form filled: Scene id `greyhollow-ford`,
   the seed's title, summary, location and reason. Take the shots (below).
7. Edit the summary. Click "Apply". Expect the header to show the scene title and location, and the
   suggestion to leave "Pending proposals".
8. On the debug page, expect one `scene.changed` row by the operator with `after.sceneId`
   `greyhollow-ford`, one `proposal.rejected` row on the seed, and then an `approval` turn job.
   That job loaded the seed: its `checkpoint.beat` is set (the no-scene baseline leaves it null).
   With no player action it ends `empty-beat` by design and makes no model calls. Record the job id,
   outcome, `checkpoint.beat` and call purposes.
8b. In the approvals slide-out, approve the pending scene-start suggestions (party, combatants,
   tracker and presence).
8c. As the player, declare and commit `act-search` with `specs/053-env-fake-dm-script/evidence/declare.mjs`.
   Expect a turn job that narrates it from the `human-dm-approval` calls (director, interpret,
   narrate, audit), then the chronicle jobs. Record the job id and its `scripted` call purposes.
9. Baseline (red): on a second session, repeat steps 4 and 5, then click Dismiss on the suggestion
   instead of carrying it out. Expect the `approval` turn job to finish with outcome `empty-beat`
   and `checkpoint.beat` null (no scene). Recreate the app container first if the script is spent (053 quickstart step 11).
10. Open the play URL as the player. Expect no "Change scene" button.
11. Remove the `DM_FAKE_SCRIPT` line and recreate the app container. Leave the stack up.

## Screenshots (Brave, `evidence/shots/`)

Take each at 1280 px and 390 px wide, in light and dark (4 shots per state):

- `scene-panel-seeded-<width>-<theme>.png`: the open panel seeded from the suggestion (step 6).
- `scene-applied-<width>-<theme>.png`: the table after Apply, header showing the scene (step 7).

Also one `debug-approval-turn-1280-light.png` of the debug page at step 8, and one
`player-no-control-1280-light.png` at step 10. No shot may show a modal.

## Expected refusals

- A Clear with no scene set is not offered.
- A player who sends a `scene` frame by hand gets `NOT_AUTHORIZED`.
