---
name: board-track-conflicts-with-branch-card
description: Board notes landing on main while a task branch carries the same card guarantees a merge conflict on that card at PR time.
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 8622d6e9-02f8-4fe9-b36e-eeb08c0cbd16
  modified: 2026-09-29T09:39:36.484Z
---

The two-track landing rule puts board bookkeeping (notes, AC ticks) directly on
`main`, but the claim commit puts the *same card file* on the task branch. Both
tracks then edit one file in two histories, so every task whose branch lives
longer than a few board updates hits a merge conflict on its card at PR time.

**Why:** hit on TASK-0016 (PR #12, 2026-09-23). 16 `Update task TASK-0016`
commits accumulated on `main` while the branch held the claim-time snapshot.
Both sides were mine. Resolution was easy — `main`'s copy was a strict superset
(15 checked ACs vs 0) — but it blocked the PR until noticed.

**How to apply:** expect this conflict; it is structural, not a mistake. At PR
time, `git merge origin/main` (never rebase — the root-guard hook forbids it),
then take whichever side's card is the superset — it is NOT always `main`: compare
`grep -c '^- \[x\]'` and the `Spec:`/`Dispatch:` marker counts on both sides
(`git show :2:<card>` vs `:3:<card>`) before choosing. In the M1 wave-1 sweep
(2026-09-29) the branch copy won every time, because dispatch lines and phase ACs
were recorded on the branch. Re-run all gates after the merge — the handoff requires it
unconditionally. Related: [[backlog-reset-desyncs-card]],
[[root-guard-staging-timing]].
