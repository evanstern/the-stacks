# Quickstart: a three-human table on a worktree stack

This seats three accounts at one table and starts the trio scene with the scripted fake DM. No
provider key is used. Phase 4 of `tasks.md` runs it and records it in `evidence/live-run.md`.
Written against OQ-1 (a): the seed is `greyhollow-ford-trio`.

## Prerequisites

- This worktree with Phases 1 to 3 committed, `pnpm install --frozen-lockfile` and `pnpm build` done.
- Brave, for three browser contexts and the screenshots. The UI has no modals.
- A session scratchpad directory outside the repo for generated test passwords.

## Steps

1. Bring the stack up and migrate it credential-free, as
   `specs/053-env-fake-dm-script/quickstart.md` steps 1-2 describe. `<env>` is `task-0176`.
2. Turn script mode on (that quickstart, steps 3-5) with `DM_FAKE_SCRIPT=greyhollow-live`. Expect
   the boot line `DM script mode: greyhollow-live (9 calls, 1 dice)`. The script fits: its
   scene-start Director call has `companionPrompts: []` and no call names a companion.
3. Create the operator inside the app container with a generated password (that quickstart,
   step 6). Store the credentials only in the scratchpad.
4. Context A: sign in as the operator. On Settings, create two invitations.
5. Context B (signed out): redeem the first token as `player2`. Context C (signed out): redeem
   the second token as `player3`. Each lands signed in with no operator links.
6. Context A: open Table, press `Start a new table`, copy the `/play/<uuid>` link. Contexts B and
   C open it. Expect three names in the presence strip.
7. Context A: press `Start scene`. Choose `Greyhollow Ford (three players) (greyhollow-ford-trio)`.
   Expect three selects (Tamsin Vale, Brother Odo, Kestrel) and no `AI companions:` note.
8. Seat the operator on Tamsin Vale and `player2` on Brother Odo. Expect `Start` disabled. Seat
   `player2` on Kestrel too. Expect `Start` disabled. Seat `player3` on Kestrel. Expect `Start`
   enabled. Press `Start`. Expect the slide-out to close and `Scene start queued.`
9. Expect the scripted opening narration in all three contexts within a few seconds. Expect each
   context's speaker selector to offer only its own character.
10. Open `/play/<uuid>/debug` in context A. Expect a succeeded scene-start turn job and no
    companion job.

## Expected refusals

- A start request on the trio seed with one user on two seats: 400, `A user can hold only one seat.`
- A start request with two of the three seats: 400 naming the missing seat.
- A second start on the same session: 409, `The session already has a scene.`
