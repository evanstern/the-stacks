---
id: decision-0020
title: 'D12 Planning principle: no unplanned for-now deferrals'
date: '2026-10-25'
status: accepted
---
## Context

Design documents collect "for now" and "later" clauses. Without a tracker entry, each one is a
commitment that lives only in prose and silently expires. The project's rule is that a
commitment left as prose where its durable home is the tracker did not happen.

## Decision

**No unplanned "for now".** Known-wanted work is built now, or deferred only with ordered
board tasks created at the same time. A maybe gets a revisit task tied to a concrete trigger.

**All known-wanted milestones are carded up front** (operator ruling, 2026-10-25, on the
TASK-0041 follow-up). Cards may be refined at each milestone's planning, but never silently
dropped; dropping one needs a decision record.

**Rationale.** Deferral is fine; untracked deferral is drift. Requiring the card at the moment
of deferral costs a minute and makes every "later" visible on the board, ordered, and
reviewable. Carding whole milestones up front exposes their size and dependencies before
they are scheduled, instead of at each milestone's close.

## Consequences

- architecture.md A14 states this rule.
- Applied in this revision: every milestone from M2 to M9 is carded. M2: TASK-0042 to
  TASK-0048. M3: TASK-0049 to TASK-0053 and TASK-0055. M4: TASK-0054, TASK-0056 to
  TASK-0063. M5: TASK-0064 to TASK-0067. M6: TASK-0068 to TASK-0076. M7: TASK-0077 to
  TASK-0082. M8: TASK-0083 to TASK-0086. M9: TASK-0087 to TASK-0091.
- The two maybes have revisit cards: TASK-0054 (LangGraph) and TASK-0055 (parked combat
  rules).
- M9 is a sketch. Its re-plan card (TASK-0087) gates every other M9 card and refines them from
  V1 play evidence.
- Each milestone's first cards depend on the previous milestone's closing card, so the board
  order matches milestones.md.
- Reviewers reject a design or spec change that adds a "for now" without a card or a revisit
  trigger, and reject a card removal without a decision record.
