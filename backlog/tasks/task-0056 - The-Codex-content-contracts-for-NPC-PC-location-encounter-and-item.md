---
id: TASK-0056
title: 'The Codex: content contracts for NPC, PC, location, encounter and item'
status: To Do
assignee: []
created_date: '2026-10-25 20:13'
updated_date: '2026-10-27 03:54'
labels:
  - codex
  - contracts
milestone: m-4
dependencies:
  - TASK-0053
references:
  - docs/design/architecture.md
priority: medium
ordinal: 46000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: one shared Zod contract per codex entity type (NPC, PC, location, encounter, item), each with identity, portrayal and hooks, plus the portrayal-completeness lint.

Why: architecture A5 and constitution II. The First Scene ran from a hand-authored scene seed; its playtests (TASK-0048, TASK-0053) show what an entity must hold for the AI DM to play it. Identity uses the 5e engine's record shapes (A10), so a codex NPC can enter a fight without translation.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Each entity type has one Zod contract with identity, portrayal and hooks sections, in a shared package.
- [ ] #2 Identity sections reuse the 5e engine's record shapes for stats, AC and HP.
- [ ] #3 Hooks declare typed edges to other entities, secrets and agendas.
- [ ] #4 A portrayal-completeness lint runs in CI and fails on an entity missing required portrayal fields.
- [ ] #5 The M2 scene seed fixture converts to valid codex entities, and a test proves it.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
From decision-0025 (D17, TASK-0135, 2026-10-26): M3 tracks only minimal scene presence for seed NPCs (TASK-0142). NPC disposition beyond 'yielded' (attitude, loyalty) is untracked in M3 and belongs to the Codex NPC contract; research basis: docs/research/NPCs-Social-and-Information/ (TASK-0119).
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
