# Quickstart: a two-player table on a worktree stack

This runs the whole kit locally with the scripted fake DM. No provider key is used. Phase 6 of
`tasks.md` runs it for real and records the run in `evidence/live-run.md`.

## Prerequisites

- This worktree, with `origin/main` merged (TASK-0158's `DM_FAKE_SCRIPT` is on it),
  `pnpm install --frozen-lockfile` and `pnpm build` done.
- Brave, for the two browser contexts and the screenshots. The UI has no modals.
- A session scratchpad directory outside the repo for generated test passwords.

## Steps

1. Bring the stack up and migrate it credential-free, as
   `specs/053-env-fake-dm-script/quickstart.md` steps 1-2 describe. `<env>` is `task-0163`.
2. Turn script mode on (that quickstart, steps 3-5) with `DM_FAKE_SCRIPT=greyhollow-live`, or
   `greyhollow-duo-live` if Phase 6 had to add it. Expect the `DM script mode:` boot line.
3. Create the operator inside the app container with a generated password (that quickstart,
   step 6). Store the credentials only in the scratchpad.
4. Browser context A: sign in as the operator. Open Settings. Under `Invite a player`, press
   `Create invitation`. Expect a token and an expiry 7 days out.
5. Browser context B (signed out): press `Have an invitation?`. Enter the token, the username
   `player2`, a display name and a generated password. Press `Create account`. Expect to land
   signed in, with no operator links in the sidebar.
6. Context B again, a second redeem of the same token in a fresh context: expect
   `This invitation is invalid, expired, or already redeemed.`
7. Context A: open Table, press `Start a new table`, and copy the `/play/<uuid>` link.
   Context B: open that link. Expect both names in the presence strip.
8. Context A: press `Start scene`. Choose `Greyhollow Ford (two players) (greyhollow-ford-duo)`. Seat yourself on
   Tamsin Vale and `player2` on Kestrel. Expect `Start` disabled while both seats hold the same
   user. Press `Start`.
9. Expect the scripted opening narration in both contexts within a few seconds. Expect each
   context to offer only its own character in the speaker selector (Tamsin Vale for the operator,
   Kestrel for `player2`). The table shows no chip for Brother Odo; the AI DM voices him.
10. Open `/play/<uuid>/debug` in context A. Expect a succeeded scene-start turn job.

## Expected refusals

- `GET /dm/seeds` as `player2`: 403.
- A start request with one user on both seats: 400, first issue `A user can hold only one seat.`
- A second start on the same session: 409, `The session already has a scene.`
