# M3 sweep — paused 2026-10-28

The operator paused the sweep after TASK-0176 merged: "Before we start on another slice of M-3 I'd
like to pause -- after the next PR merges." The pause is recorded on TASK-0177 and in the runbook
amendment row (PR #86).

## State at the pause

- Merged this stretch: TASK-0167 (#84, 3cf55655), TASK-0165 (#85, 7c18b8ff), TASK-0176 (#86,
  664cc7dc). All three Done on main; worktrees, branches and stacks removed; `env:prune --check`
  clean.
- Root checkout: `main`, clean, level with origin.

## Resume order (runbook amendment row, operator-ruled)

1. TASK-0177 — operator seats a human DM from the web (finding F-1 of spec 061). Not started.
2. TASK-0163 AC #4 — the two-account alpha run on vm-104. Needs the operator's go on each exact
   vm-104 command, and the operator's friend needs Tailscale access and an invitation.
3. TASK-0053 — the demo. $50 ceiling already on the card in the operator's words. Human-review
   checkpoint before it runs; the operator recruits the three players. Depends on TASK-0176 (Done)
   and TASK-0177.

## Tools

- Dispatch rules: `m3-dispatch-rules.md` (this folder).
- `m3-sweep-tools/seed.py` adds the phase ACs. Do not use `link.py` on an authored spec: it
  overwrites spec.md with a stub. Set the `Spec:` marker with `backlog task edit -d`.
- `backlog task edit --dep` replaces the dependency list: pass every dependency.
