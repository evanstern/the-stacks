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

**Rationale.** Deferral is fine; untracked deferral is drift. Requiring the card at the moment
of deferral costs a minute and makes every "later" visible on the board, ordered, and
reviewable.

## Consequences

- architecture.md gains a Planning principle section stating this rule.
- Applied in this revision: M2 and M3 are carded (TASK-0042 to TASK-0053); the two maybes
  have revisit cards (TASK-0054 LangGraph, TASK-0055 parked combat rules); milestones M4 to
  M9 exist on the board (m-4 to m-9) with scope and entry gates, and their cards are authored
  at the preceding milestone's close.
- Reviewers reject a design or spec change that adds a "for now" without a card or a revisit
  trigger.
