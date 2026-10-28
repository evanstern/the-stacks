# Quickstart: a human DM approves a check roll and the table narrates (live check)

Card AC #1, SC-003. Run on the worktree stack in script mode (`DM_FAKE_SCRIPT`, spec 053). No
provider key. Browser automation uses Brave. The UI has no modals. The orchestrator runs this
(Phase 4) and records it in `evidence/live-run.md`.

## Prerequisites

- Phases 1 to 3 are on the branch. `greyhollow-human-dm.json` holds 10 calls.
- `pnpm install --frozen-lockfile` and `pnpm build` are done in the worktree.
- The root checkout's `.env` does not hold `DM_FAKE_SCRIPT`.

## Steps

1. Run `pnpm env:up` in the worktree. Migrate both databases (053 quickstart steps 1 and 2; `<env>`
   is `task-0168`).
2. Append `DM_FAKE_SCRIPT=greyhollow-human-dm` to the worktree `.env` with `printf '\n...\n' >>`.
   Recreate the app container once. Check the boot log for
   `DM script mode: greyhollow-human-dm (10 calls, 1 dice)`.
3. Create the operator in the app container and one player by invitation (055 quickstart step 3).
   Generate passwords randomly. Keep them in an untracked file outside the repo. Never print them.
4. Run `node specs/057-human-dm-roll-resume/evidence/live-resume.mjs <creds-file>`. It does steps 5
   to 9 in Brave.
5. Seat the operator as human DM and start `greyhollow-ford` (055 `start-human-dm.mjs`).
6. As the DM, carry out the scene suggestion and approve the 10 non-narration suggestions (055 steps
   6 to 8b).
7. As the player, declare and commit `act-search` (053 `declare.mjs`). Expect the commit turn to
   call `dm.director` and `dm.interpret` and pause on one `check.roll` proposal (policy `ask`).
8. As the DM, approve the roll. Expect the `approval` turn to end `completed` with calls
   `dm.director`, `dm.narrate`, `dm.audit` and no `dm.interpret`. Expect no second `check.roll` in
   the approvals slide-out. Expect one pending narration proposal naming `act-search`.
9. Approve the narration. Expect the narration text and the rendered dice line in the transcript,
   on the DM's and the player's tables. Expect the next `approval` turn to end `empty-beat` with no
   calls.
10. Record job ids, outcomes, call purposes, the `action.resolved` row (`outcome: applied`, the
    approved batch id) and the count of `check.roll` proposals (1).
11. Do not restart the app until step 10 is recorded. Leave the stack up for the orchestrator.

## Screenshots (Brave, `evidence/shots/`)

- `roll-pending-1280-light.png`: the approvals slide-out with the one `check.roll` (step 7).
- `narration-pending-1280-light.png`: the slide-out after the approval: the narration, no roll (step 8).
- `narrated-<1280|390>-<light|dark>.png`: the player's table showing the narration (step 9).

No shot may show a modal (0 `dialog[open]` and 0 `[aria-modal=true]`).
