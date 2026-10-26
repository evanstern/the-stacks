# Quickstart: capture and verification runs (orchestrator only)

These two runs spend provider money. The orchestrator runs them, never an implementer. Each run
needs its own operator-approved spend ceiling, recorded on TASK-0102 before the run.

## A. Build the composite worktree (once, before the capture)

1. Push this branch after Phase 1 lands.
2. Run `git fetch origin`.
3. Run `git worktree add --detach .worktrees/task-0102-run origin/task-0048-playtest` from the
   repo root.
4. Run `git -C /Users/evanstern/projects/the-stacks/.worktrees/task-0102-run merge --no-edit origin/task-0102-director-robustness`.
5. On a conflict, stop and report to the operator. Do not resolve it by hand on either branch.
6. Never push from this worktree. Its commits are detached and disposable.
7. In the worktree, run `pnpm install`, `pnpm env:up`, and
   `pnpm --filter @the-stacks/server db:migrate`.
8. Follow `docs/design/m2-demo.md` sections A and B in this worktree (operator account,
   provider configuration, `pnpm playtest estimate`).
9. Record the `dm.director` `maxTokens` from `AI_PURPOSES` on the card.

## B. Capture run (Phase 2)

1. Ask the operator for a spend ceiling. Record it on TASK-0102 with
   `backlog task edit TASK-0102 --append-notes` from `.worktrees/task-0102`.
2. Build the `localhost` form of `AI_PROVIDERS`: replace `host.docker.internal` with
   `localhost` in each base URL.
3. Run, in the composite worktree:
   `AI_PROVIDERS='<localhost form>' pnpm playtest run --mode provider --spend-ceiling-usd <ceiling>`.
4. Read the run's `run.json`. Note `outcome`, `failedJobId` and `spend`.
5. When `outcome` is `failed`, read the failure record:
   `psql "<app database URL>" -At -c "SELECT result FROM jobs WHERE id = '<failedJobId>'"`.
6. When the record's `failure.node` is `director` and `failure.kind` is `invalid-output`, go to
   step 8.
7. Otherwise, commit what was captured (step 8) and stop. Report to the operator with the
   record. Ask for a second ceiling or a ruling (FR-011). Do not start Phase 3.
8. Write the fixture `apps/server/test/dm/fixtures/director-capture-<runId>.json` in
   `.worktrees/task-0102` (shape below).
9. Copy the run directory to `specs/033-director-robustness/evidence/capture-<runId>/`.
10. Commit both in `.worktrees/task-0102` as `TASK-0102: capture real director failure`.

### Fixture shape

```json
{
  "v": 1,
  "runId": "<runId>",
  "commit": "<composite HEAD sha>",
  "provider": "<provider name>",
  "model": "<dm.director model>",
  "maxTokens": 1500,
  "promptVersion": "dm.director-v1",
  "turn": { "trigger": "commit", "actionIds": ["<action id>"] },
  "failure": { "...": "the whole jobs.result.failure object, unchanged" }
}
```

## C. Verification run (Phase 4; rerun in Phase 4b)

0. Phase 4b only: complete the T035 checkpoint first. Propose a `dm.interpret` `maxTokens` value
   from research R10. Record the operator's decision on the card. The operator sets it in
   `.env`, or approves the orchestrator setting it. Restart the composite stack's server so it
   reads the new value. Record the value in effect on the card.
1. Merge this branch's latest tip into the composite worktree (step A4 again).
2. Ask the operator for a spend ceiling. Record it on the card.
3. Run the same command as B3.
4. Read `run.json` and `jobs.json`.
5. Pass when both hold:
   - the run commits at least 4 moves;
   - no turn job failed with `stopped at director: invalid-output` or
     `stopped at interpret: invalid-output`.

   The target outcome is `completed` (the scene ends). Any other failed turn job is a failure of
   another kind. Commit its record as a fixture (step 8) and stop for an operator ruling, even
   when the pass rule holds. Keep the spend ceiling handling as is: the harness stops at the
   operator-approved ceiling.
6. Copy the run directory to `specs/033-director-robustness/evidence/verify-<runId>/`.
7. Record the outcome, the spend and the pass or fail on the card.
8. On a fail, or on a failure of another kind, read the new failure record (B5). Commit it as a
   fixture under `apps/server/test/dm/fixtures/` (`<node>-capture-<runId>.json`, B fixture
   shape). Report to the operator before any further spend.

## D. Scripted CI playtest (Phase 5)

1. In the composite worktree, run `pnpm playtest run --mode ci`.
2. Confirm exit 0. Record it on the card.

## E. Teardown

1. Run `pnpm env:down` in the composite worktree.
2. Run `git worktree remove .worktrees/task-0102-run` from the repo root.
3. Run `pnpm env:prune --check`.
