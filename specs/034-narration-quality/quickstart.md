# Quickstart: verification run and CI playtest (orchestrator only)

The verification run spends provider money. The orchestrator runs it, never an implementer. It
needs an operator-approved spend ceiling, recorded on TASK-0106 before the run.

## A. Build the composite worktree (once, before Phase 5)

1. Push this branch after Phase 4 lands.
2. Run `git fetch origin`.
3. Confirm `origin/task-0048-playtest` holds the TASK-0048 seat fix. Record its commit on the card.
4. Run `git worktree add --detach .worktrees/task-0106-run origin/task-0048-playtest` from the
   repo root.
5. Run `git -C /Users/evanstern/projects/the-stacks/.worktrees/task-0106-run merge --no-edit origin/task-0106-narration-quality`.
6. On a conflict, stop and report to the operator. Do not resolve it by hand on either branch.
7. Never push from this worktree. Its commits are detached and disposable.
8. In the worktree, run `pnpm install` and `pnpm env:up`.
9. Migrate the app database. `apps/server/scripts/migrate.ts` prefers `TEST_DATABASE_URL`, so
   pass the app database URL as `TEST_DATABASE_URL` to `pnpm --filter @the-stacks/server db:migrate`.
10. Follow `docs/design/m2-demo.md` sections A and B in this worktree (operator account,
    provider configuration, `pnpm playtest estimate`).

## B. Pre-run checks

1. Run `pnpm --filter @the-stacks/server test` in the composite worktree. Stop on a failure.
2. Read the scenario's `moves.fallback.text` in
   `apps/server/playtests/scenarios/greyhollow-ford.json`. Record it on the card.
3. Read how the fixed seat records a fallback move. When the seat no longer declares the
   fallback text verbatim, adapt the `$fb` selector in C5 and record the selector on the card.

## C. Verification run (Phase 5)

1. Ask the operator for a spend ceiling. Record it on TASK-0106 with
   `backlog task edit TASK-0106 --append-notes` from `.worktrees/task-0106`.
2. Build the `localhost` form of `AI_PROVIDERS`: replace `host.docker.internal` with
   `localhost` in each base URL.
3. Run, in the composite worktree:
   `AI_PROVIDERS='<localhost form>' pnpm playtest run --mode provider --spend-ceiling-usd <ceiling>`.
4. Copy the run directory to `specs/034-narration-quality/evidence/verify-<runId>/` in
   `.worktrees/task-0106`.
5. Compute the fallback rate (research.md R5) in the evidence directory:

   ```sh
   jq -s --arg fb "<moves.fallback.text>" '
     ([.[] | select(.type=="action.declared" and .payload.text==$fb) | .payload.actionId]) as $seat
     | def seatonly(ids): (ids|length)>0 and all(ids[]; . as $i | $seat|index($i));
     { narrated_all: ([.[]|select(.type=="narration")]|length),
       fallback_all: ([.[]|select(.type=="journal.entry.added" and .payload.title=="Audit flag: narration replaced")]|length),
       narrated: ([.[]|select(.type=="narration" and (seatonly(.payload.actionIds)|not))]|length),
       fallback: ([.[]|select(.type=="journal.entry.added" and .payload.title=="Audit flag: narration replaced" and (seatonly(.payload.sourceActionIds)|not))]|length) }
     | .rate = (.fallback/.narrated) | .rate_all = (.fallback_all/.narrated_all)' transcript.jsonl
   ```

   On run 5 this prints `narrated 14, fallback 7, rate 0.5`; all turns `39, 23`.
6. Count the report's fails by kind:
   `jq '[.findings[] | select(.severity=="fail") | .kind] | group_by(.) | map({(.[0]): length}) | add' report.json`.
7. Pass when both hold:
   - `rate` is at most 0.10;
   - the report has zero `hidden-info-leak` and zero `ledger-contradiction` fails.
8. A fail of any other kind does not change pass or fail. Commit the evidence anyway and stop
   for an operator ruling before Phase 6.
9. Record on the card: run id, outcome, spend, `rate`, `rate_all`, fail counts by kind, pass or
   fail.
10. Commit the evidence in `.worktrees/task-0106` as `TASK-0106: verification run <runId>`.
11. On a fail, classify each failing turn with research.md's method. Write
    `evidence/verify-<runId>/classification.md`. Report to the operator before any further
    spend.

12. **Phase 5b rerun notes.** Apply these on top of steps 1–11.
    - Confirm `dm.narrate` `maxTokens` is 1500 in the provider configuration (research.md
      R7.1). The code default stays 500. Do not edit `.env` or code for it.
    - Expect the estimate's upper bound near $23.40. A ceiling below it refuses to start. Ask
      the operator for a ceiling at or above the estimate. Never pick one yourself.
    - Rebuild the composite worktree from the Phase 4b tip (step A5). Confirm the composite
      holds `dm.narrate-v3` and the party-name filter before the run.
    - `moves.fallback` is a list (TASK-0048 `b3f09ca`). Use the list-form selector below in
      place of the step 5 command. `$fbs` is every `moves.fallback[].text`. A seat action is an
      `action.declared` row whose text equals any of them.

    ```sh
    SCEN=/Users/evanstern/projects/the-stacks/.worktrees/task-0106-run/apps/server/playtests/scenarios/greyhollow-ford.json
    jq -s --argjson fbs "$(jq '[.moves.fallback[].text]' "$SCEN")" '
      ([.[] | select(.type=="action.declared" and (.payload.text as $t | any($fbs[]; . == $t))) | .payload.actionId]) as $seat
      | def seatonly(ids): (ids|length)>0 and all(ids[]; . as $i | $seat|index($i));
      { narrated_all: ([.[]|select(.type=="narration")]|length),
        fallback_all: ([.[]|select(.type=="journal.entry.added" and .payload.title=="Audit flag: narration replaced")]|length),
        narrated: ([.[]|select(.type=="narration" and (seatonly(.payload.actionIds)|not))]|length),
        fallback: ([.[]|select(.type=="journal.entry.added" and .payload.title=="Audit flag: narration replaced" and (seatonly(.payload.sourceActionIds)|not))]|length) }
      | .rate = (.fallback/.narrated) | .rate_all = (.fallback_all/.narrated_all)' transcript.jsonl
    ```

    On the Phase 5 run (`verify-20261026T183818Z-greyhollow-ford-provider`) this prints
    `narrated 34, fallback 12, rate 0.35`; all turns `38, 13`.
    - Apply the operator's rulings on F4, F32 and F54 (research.md R7.5) when judging step 7.
      Record which rulings applied on the card.

## D. Scripted CI playtest (Phase 6)

1. Merge this branch's latest tip into the composite worktree (A5 again).
2. Run `pnpm playtest run --mode ci` in the composite worktree.
3. Confirm exit 0. Record it on the card.

## E. Teardown

1. Run `pnpm env:down` in the composite worktree.
2. Run `git worktree remove .worktrees/task-0106-run` from the repo root.
3. Run `pnpm env:prune --check`.
