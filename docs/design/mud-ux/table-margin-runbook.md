# Table margin (TASK-0236, spec 090) — sweep runbook (2026-11-05)

- **Status:** signed-off (operator, 2026-11-05, in chat). The operator said "I want you to do the
  actual work", then answered "How should I start building the redesign?" with "Build independent
  half now".
- **Scope:** one task, TASK-0236, building `specs/090-table-margin/`. The 066-dependent half is
  TASK-0247 (spec 091). It is not in this sweep: it waits for TASK-0199 in runbook C.
- **Orchestrator:** this session plans, dispatches and gates. It never implements.
- **Dispatch rules:** `docs/ops/orchestrator-kit/dispatch-rules.md` binds every dispatched agent.

## State (2026-11-05)

- Branch `task-0236-mud-ux` in `.worktrees/mud-ux`. It already carries the research vault, the
  design rounds, the decision record and specs 090 and 091. `origin/main` is merged in.
- Runbook B2 (`docs/design/m3-runbook-b2-playtest-fixes.md`) is executing in another session.
  Its lanes touch `apps/server/src/dm/**` only. No open branch touches `apps/web/app/play/**` or
  `apps/web/app/app.css` (checked 2026-11-05).
- Spec numbers 086–089 belong to runbook B2. This sweep uses 090; TASK-0247 holds 091.

## Lane

| Order | Task | Tier | Spec set | Parallel |
|---|---|---|---|---|
| 1 | TASK-0236 spec 090, phase 1 (margin, mini-strip, status strip) | sonnet | `specs/090-table-margin/` | no |
| 2 | TASK-0236 spec 090, phase 2 (contrast, no-dialog, contracts, wiki) | sonnet | same | after phase 1 |
| 3 | TASK-0236 spec 090, phase 3 (verification) | orchestrator | same | after phase 2 |

## Model tiers (from `.claude/model-tiers.json`, `tiers.mjs --check` exit 0 on 2026-11-05)

- sonnet → `sonnet-implementer`, pinned `cc/claude-sonnet-5-5[1m]`. Spec authoring ran on opus
  (`cc/claude-opus-5-5[1m]`) under the standing 2026-09-29 ruling.

## Execution mode

- Interactive-root mode. Board-only commits go direct to `main`. This task's card lives on its
  branch and merges with its PR.
- Commit with `git -C /Users/evanstern/projects/the-stacks/.worktrees/mud-ux`, in its own Bash call.
- Merge on green with `gh pr merge --merge` (pin-carrying branch: never squash).

## Gates (per PR, on the branch's final tree)

- `pnpm ci:check` green.
- `node ~/.claude/plugins/cache/praxisflux/grounding-wiki/1.0.1/gates/cli.mjs freshness . docs/wiki` prints `OK`.
- `node ~/.claude/plugins/cache/praxisflux/spec-bridge/1.0.1/gates/cli.mjs check .` reports no task exceeding its artifacts.
- The research gates pass:
  - `research ... branch docs/research MUD-Client-UX`
  - `research ... analysis docs/research MUD-Client-UX`
- The card carries a `Dispatch:` line with a real `served=` ID for each dispatch.
- Every task in `specs/090-table-margin/tasks.md` is ticked.
- `grep -rn "<dialog\|showModal\|aria-modal" apps/web/app/play` prints nothing.
- Expected wiki reviews (NEEDS-REVIEW candidates): the play-route and turn-floor notes.

## Merge conditions

- If TASK-0199 merges first, merge `origin/main` into this branch and re-run every gate.
- The PR carries the full design trail: the vault, rounds, decision, specs 090 and 091, and the build.

## Operator checkpoints

- C1: any change to a frozen contract beyond R2 (a).
- C2: new runtime dependencies. Stop after the phase that proposes one.

## Done means

- TASK-0236 is Done via its merged PR.
- `main` is green on all gates above.
- TASK-0247 and TASK-0239 stay on the board, with the right dependencies.
- `.worktrees/mud-ux` is removed after the merge is verified, and `pnpm env:prune --check` exits 0.

## Execution log

| Date | Task | PR | Merge | Dispatches | Notes |
|---|---|---|---|---|---|
| 2026-11-05 | TASK-0236 | (pending) | — | spec opus; phases 1-2 sonnet; phase 3 orchestrator | live check in the app browser pane, not Brave (see evidence) |
