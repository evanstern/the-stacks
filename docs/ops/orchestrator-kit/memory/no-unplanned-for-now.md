---
name: no-unplanned-for-now
description: "Never defer known-wanted work with \"for now\" unless an ordered board task pins when it lands; maybes need a concrete revisit task."
metadata:
  node_type: memory
  type: feedback
  originSessionId: 415a1f81-9278-483d-a3f4-b5081ad9d0a6
  modified: 2026-10-25T19:51:11.776Z
---

Do not propose "fold X in for now, split it later" or similar deferrals of work we already know we want.

- Known-wanted, timing known: deferral is fine only with explicit, correctly ordered board tasks created at the same time.
- Known-wanted, timing unknown: build it now, or build toward it from day 1.
- Maybe-wanted (e.g. LangGraph adoption): skipping is fine, but create a concrete revisit task tied to the trigger point, so the question cannot be forgotten.

**Why:** "For now" deferrals get forgotten once "for now" stops applying (operator, 2026-10-25 re-design session, rejecting a Director-folded-into-interpret proposal).

**How to apply:** Every design or plan that defers something names the card (or creates it) and the trigger that makes it due. Related: [[spec-authoring-dispatch-tier]].
