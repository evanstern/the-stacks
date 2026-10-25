---
id: decision-0014
title: D6 Solo plus AI companions first; multi-actor protocol from day 1
date: '2026-10-25'
status: accepted
---
## Context

The First Scene (decision-0009) needs a table size. The operator's goals include multiplayer
(use case 5) and solo play with an AI DM (the end goal). tabletop-dm proves solo plus
DM-played companions is a satisfying shape.

## Decision

The First Scene seats **one human player plus AI-run companions**. The protocol is
multi-actor from day 1: companions are actors that declare and commit actions through the
same gate as a human. The multiplayer slice comes next as M3 and is carded now
(TASK-0049 to TASK-0053).

**Rationale.** One human removes the hardest social problems (sign-off, floor passing,
presence, chime-in rate) from the first slice. Making companions real actors means the
multi-actor paths are exercised from the start, so M3 adds policy, not plumbing.

## Consequences

- M3 The Table (multiplayer) follows M2 directly.
- Presence is out of the First Scene; ws-protocol still omits it by design. TASK-0051
  decides how to add it.
