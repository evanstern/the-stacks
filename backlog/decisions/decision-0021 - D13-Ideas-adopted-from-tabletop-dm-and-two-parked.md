---
id: decision-0021
title: 'D13 Ideas adopted from tabletop-dm, and two parked'
date: '2026-10-25'
status: accepted
---
## Context

tabletop-dm (github.com/bradbushSFAI/tabletop-dm, MIT, studied at commit fe2c29b) is a single
Claude skill plus a Python engine with SRD 5.1 data (CC-BY-4.0). It runs a solo hero plus up
to two DM-played companions, with no maps and no multiplayer. It plays well because of a hard
ownership split (script owns numbers; LLM owns story) and DM-craft doctrine written as
concrete right/wrong pairs. Its gaps (free-markdown world state, solo only, honour-system
spoilers, small monster and spell lists, conditions left to the LLM, no narration check) are
covered by our design. Summary in doc-0004.

## Decision

Adopt these ideas, adapting with MIT attribution where text is borrowed:

1. Script owns numbers, LLM owns story; refuse before write with specific error codes.
2. Roll ledger: every roll logs a reason; every state change logs before and after.
3. The log is truth, chat memory is not; crash-safe save points.
4. Secret trackers (named clocks hidden from players).
5. DM-style doctrine written as right/wrong pairs.
6. Scripted-dice tests (injected RNG) plus playtests where a DM agent plays and an auditor
   agent checks the transcript against the ledger and the doctrine.
7. Compact lookup records (about 100 tokens) so the model never loads a whole data file.

**Parked, not adopted:** the Grit save house rule, and fight budgeting with downed-target
tables. The operator is unsure about them.

**Rationale.** Each adopted idea is either already native to our design (log as truth) or
cheap to add and directly improves honesty or play quality. The parked rules change game
balance and should be judged from our own playtest evidence.

## Consequences

- Idea 1: TASK-0042, TASK-0045. Idea 2: TASK-0044. Idea 3: the event log (M0) plus
  TASK-0044's replay test. Idea 4: TASK-0044, TASK-0046. Idea 5: TASK-0046. Idea 6:
  TASK-0042, TASK-0048. Idea 7: TASK-0043.
- Parked rules: revisit card TASK-0055, which depends on the First Scene playtest
  (TASK-0048).
- Borrowed doctrine text carries an MIT notice naming tabletop-dm and its copyright holder.
