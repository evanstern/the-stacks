---
name: merge-on-green-grant
description: Since 2026-10-27 the operator lets the orchestrator merge sweep PRs on green CI; human review happens at checkpoints the orchestrator picks.
metadata:
  node_type: memory
  type: feedback
  originSessionId: 0e915e47-fbe4-4a92-bb45-af284da05a42
  modified: 2026-10-28T03:02:39.324Z
---

On 2026-10-27, during the M3 sweep, the operator granted merging on green without their review. They review "human-style" at checkpoints the orchestrator decides. The grant is recorded verbatim on TASK-0117.

**Why:** the operator was merging each PR by hand as soon as it went green, which slowed the sweep.

**How to apply:**
- Merge as a merge commit once CI is green and the card's Dispatch lines are recorded.
- The grant does not cover operator rulings on frozen contracts or player-facing open questions, paid playtests, vm-104 changes, or keys.
- Pick checkpoints such as before a paid demo and at milestone close. Name them on the card.
- Related: [[pr-merge-order-follows-green]].
