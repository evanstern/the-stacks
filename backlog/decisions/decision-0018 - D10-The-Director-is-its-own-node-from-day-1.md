---
id: decision-0018
title: D10 The Director is its own node from day 1
date: '2026-10-25'
status: accepted
---
## Context

The turn pipeline (decision-0017) needs someone to own pacing: the scene's goal, when it ends,
hidden clocks, and when free mode becomes turn mode. Folding that into `interpret` would mix
"what did the player mean" with "where is this scene going".

## Decision

The **Director** is its own pipeline node from day 1. It:

- owns the scene's goal and decides when the scene ends;
- runs clocks (secret trackers);
- owns table-mode switches (free to turn and back);
- decides when a beat resolves.

It is not folded into `interpret`.

**Rationale.** Pacing is the craft most AI DMs lack. A separate node with its own gateway
purpose (`dm.director`) can be prompted, tested and tuned on its own, and later grows into
campaign pacing (M8) without untangling it from intent parsing.

## Consequences

- TASK-0046 builds the Director with the other nodes.
- Secret trackers are DM-only events (TASK-0044).
