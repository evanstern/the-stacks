---
id: decision-0009
title: D1 First Scene is the next milestone (AI-run vertical slice before the Codex)
date: '2026-10-25'
status: accepted
---
## Context

The ladder ratified on 2026-09-21 (decision-1, milestones.md) built a human-assisted V1 first
(Codex, Sheets & Systems, The Table, Maps, Assisted Table) and put the AI-run game after V1
(M7 to M9). M0 and M1 have landed: the event log, WebSocket gateway, jobs queue, AI gateway,
retrieval and the cited rules answerer all exist. On 2026-10-25 the operator re-centred the
design with Claude, informed by a study of tabletop-dm and of VTT integration surfaces
(doc-0004). Record of that session: doc-0004.

## Decision

The next milestone after M1 is **M2 First Scene**: a vertical slice in which an AI runs a game
loop on our stack. One human player plus AI companions play one scene (exploration, a social
beat, a fight) to its end. It lands ahead of the Codex. This reverses the ratified order
(human-assisted V1 first, auto-DM after).

**Rationale.**
- The AI-run game is the hardest consumer of every subsystem. Building it first gives the
  Codex, maps and the table view real requirements instead of guessed ones.
- It demos on M0/M1 infrastructure: the event log, jobs queue, AI gateway and retrieval exist.
- The autonomy dial (decision-0015) makes assisted mode the same pipeline with approval
  switched on, so reversing the order is cheap: the assisted table is a policy setting, not a
  second product.

## Consequences

- Supersedes the milestone ladder of decision-1 item 3 and milestones.md M2 to M6 as ratified
  2026-09-21. The new ladder is M2 First Scene, M3 The Table (multiplayer), M4 The Codex,
  M5 Imported Mechanics, M6 Maps and the Table View, M7 The Dial = V1, M8 Memory and Pacing,
  M9 Solo Campaign (milestones.md, revised 2026-10-25).
- V1 is re-derived: it ships both ends of the autonomy dial, not only the assisted table.
- The First Scene has no Codex. It runs from a hand-authored, Zod-validated scene seed. M4
  replaces the seed with codex entities.
- M2 cards: TASK-0042 to TASK-0048 (milestone m-2).
- M1's open tasks (TASK-0031, TASK-0038, TASK-0039) stay in M1 and are not re-planned.
