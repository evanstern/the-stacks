---
id: decision-0016
title: 'D8 Talk versus action, action lifecycle, and table modes'
date: '2026-10-25'
status: accepted
---
## Context

A chat-based table mixes chatter with declarations that change the world. If every message
can trigger the DM, players cannot discuss a plan without the DM resolving half of it. Combat
needs turn ownership; exploration does not.

## Decision

Two message concepts, possibly one UI:

- **Talk:** in-character or out-of-character chatter. Never changes state. Never triggers a
  DM turn. The narrator may chime in as talk (for example when mentioned), but talk cannot
  roll or move anything.
- **Action:** a declaration that a character does something. Lifecycle:
  declared, discussed, committed, resolved. Anyone may comment on a declared action. Only a
  committed action reaches the DM pipeline.

Commit authority by table mode:

| Mode | Who commits | Everyone else |
|---|---|---|
| Turn mode (combat, initiative) | The active player, for their turn | Talk and suggest |
| Free mode (exploration, social) | The declaring player, for their own character | Talk and suggest |
| Party-scope action in any mode ("we take the left tunnel", "we long rest") | Group sign-off | Approve or object |
| Always | The DM (human or AI) may commit or override | none |

Player actions are proposals with a sign-off policy: the same gate as decision-0015.

Concurrency: nothing is cancelled. Actions committed while a turn resolves queue into the
next beat and resolve together in log sequence order. The Director (decision-0018) decides
when a beat resolves.

**Rationale.** Separating talk from action lets a table think out loud for free. Commit as an
explicit step gives players agency and gives the DM pipeline a clean trigger. Queuing instead
of cancelling keeps the log honest: nothing a player committed disappears.

## Consequences

- Session model events and projections: TASK-0044. Commit authority in the gate: TASK-0045.
  Composer and commit control: TASK-0047.
- With one human (M2), group sign-off reduces to that player plus the DM. M3 adds group
  sign-off (TASK-0049) and floor passing (TASK-0050).
