---
id: TASK-0056
title: 'The Codex: content contracts for NPC, PC, location, encounter and item'
status: To Do
assignee: []
created_date: '2026-10-25 20:13'
updated_date: '2026-11-10 03:11'
labels:
  - codex
  - contracts
  - 'ws:codex'
milestone: m-11
dependencies:
  - TASK-0053
references:
  - docs/design/architecture.md
priority: medium
ordinal: 46000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
REWRITTEN by replan-2026-11: `@stacks/codex-model` per P-10; absorbs 0202. Frozen at CP-6.

Intent: create `packages/codex-model` per target-architecture §4. It defines a generic entity base with a typed payload per MVP kind (pc, npc, location nested region to room, encounter, item, clue/secret, session), the link types, per-block visibility and append-only versions with provenance. Each kind has a playable core (A5 identity, portrayal, hooks) plus free prose blocks; a readiness lint gates 'ready for play', never saving. NPC and encounter payloads carry starting conditions (absorbed TASK-0202). `compile()` is built in TASK-0060. The model freezes at CP-6.

Source: docs/design/replan-2026-11/board-rework-map.md (rewrite row), plan-of-action.md §5, target-architecture.md, decisions-for-ratification.md.

Prior scope (superseded): one Zod contract per entity type (NPC, PC, location, encounter, item) with identity, portrayal and hooks, a portrayal-completeness lint, and conversion of the M2 scene seed. NPC disposition beyond 'yielded' belongs here per decision-0025.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 packages/codex-model defines a generic entity base with a typed payload schema for every MVP kind.
- [ ] #2 Playable-core identity sections reuse dnd5e-engine record shapes for stats, AC and HP.
- [ ] #3 The package defines every target-architecture §4 link type and per-block visibility dm, party or pc:<id>[].
- [ ] #4 Each version schema carries author, source, parent and a draft or curated status.
- [ ] #5 NPC and encounter payloads carry starting conditions, and the Greyhollow seeds convert to valid entities in a test.
- [ ] #6 A readiness lint blocks 'ready for play' for an entity missing playable-core fields and never blocks a save.
- [ ] #7 A decision record freezes the model at CP-6 with CODEX_SCHEMA_VERSION per kind; boundary lint forbids app imports.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
From decision-0025 (D17, TASK-0135, 2026-10-26): M3 tracks only minimal scene presence for seed NPCs (TASK-0142). NPC disposition beyond 'yielded' (attitude, loyalty) is untracked in M3 and belongs to the Codex NPC contract; research basis: docs/research/NPCs-Social-and-Information/ (TASK-0119).

Rewritten by replan-2026-11. `@stacks/codex-model` per P-10; absorbs 0202. Frozen at CP-6.

Merged from TASK-0202 (Seed-declared starting conditions on NPCs) by replan-2026-11: Starting conditions are NPC/encounter payload.

AC re-authored by replan-2026-11.

Operator ruling 2026-11-09 (R1 lane specs 097-100): spec 099 OQ-4 — seeds/codex declare combatant sides (party, hostile, neutral).
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
