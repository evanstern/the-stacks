---
id: decision-0010
title: 'D2 5e only: drop the system-agnostic core and the Fate conformance module'
date: '2026-10-25'
status: accepted
---
## Context

Architecture A6 and constitution Principle VI made the core system-agnostic behind a
system-module interface, with `dnd5e` as the product and `fate-core` as a deliberately alien
conformance module exercised in CI. decision-1 item 2 ratified this. The re-centred design
(decision-0009) puts an AI-run 5e game first. Nothing system-specific has been built yet, so
no code depends on the agnostic interface.

## Decision

the-stacks supports **D&D 5e only**. Drop the system-agnostic posture and the Fate
conformance module.

- Keep a `dnd5e` module boundary in code: the engine is its own package with a narrow entry
  point. This is cheap and keeps mechanics out of the session, library and codex code.
- Build no second system and no conformance suite.

**Rationale.** The conformance module is a tax paid for a user we do not have. Every hour
spent keeping an interface honest for Fate is an hour not spent on the 5e depth the AI DM
needs. The boundary that matters for testability (a pure engine) survives without the
agnostic interface.

## Consequences

- Supersedes architecture A6 and constitution Principle VI (amended in constitution 2.0.0).
  Supersedes decision-1 item 2.
- The old M3 Sheets & Systems milestone is dissolved: the engine lands in M2 (TASK-0042),
  sheets with the Codex (M4).
- Existing specs' CR-004 "system-agnostic" requirements are historical. They need no
  migration because they forbade 5e assumptions in code that has none.
- The spec, plan and tasks templates replace the system-agnostic check with a 5e-boundary check.
