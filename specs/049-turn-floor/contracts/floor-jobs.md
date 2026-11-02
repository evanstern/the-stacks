# Contract: the `floor` job kind and floor follow-ups

Binding for spec 049. It amends `specs/031-dm-runtime/contracts/turn-jobs.md` (frozen) and
`resolve.md` under the operator ruling of 2026-10-27 (FT-3). Decisions: `../research.md`
R7 to R10, R13.

## Kinds table (turn-jobs.md)

| kind | one row is | claim priority | model calls |
|---|---|---|---|
| `turn` | one beat of one session | 1 | yes |
| `floor` | one absence or stall check | 2 | none |
| `companion` | one or more AI companions acting once | 3 | yes |
| `chronicle` | one journal pass | 4 | yes |

`floor` is serialised with `turn` and `companion` per session. Its `notBefore` gates the
claim, as the `react` companion job's does. Payload and result: `../data-model.md`.

## Enqueue table additions (dm/enqueue.ts)

| Appended row | Condition | Effect |
|---|---|---|
| `table-mode.changed`, turn mode, actor is a human | after names `ai:dm` | `enqueueTurn(npc-turn)` |
| same | after names `ai:companion:<id>` | companion job, reason `turn` |
| `table-mode.changed`, turn mode, any actor | after names a human who is absent now, AI seat | arm `absence` |
| `action.declared`, scope `party` | ≥ 2 party humans, AI seat | arm `stall` |
| `action.commented` on an open party action | ≥ 2 party humans, AI seat | re-arm `stall` (`notBefore`, `stanceSeq`) |
| `action.committed` / `action.withdrawn` | a queued `stall` for that action | cancel it |
| presence `onChange` | turn mode, active human now absent, AI seat | arm `absence` |

Rows written by `ai:dm` never queue the npc-turn or companion follow-up here; their producer
queues it (resolve's `nextJob`, the floor job's own follow-up).

## The run

Code only. No `chat()`. Writes only through `gate.submit` as `ai:dm`.

1. Seat human: finish `skipped`.
2. `absence`: if turn mode, the holder equals `input.holder`, and the holder is absent from
   `presentUsers`, submit `floor end` for the current turn. Then queue the follow-up for the
   new holder exactly as R8 does for a human row. Else `noop`.
3. `stall`: if the action is open, `stanceSeq` is still the latest stance seq on it, the
   quorum is unmet and nobody objects, submit `action.commit { override: "stall" }`. Else
   `noop`.
4. A refusal finishes the job `done` with outcome `refused`.

## Reconcile

At worker start, after `reconcileTurnJobs`: arm `absence` for each turn-mode session whose
holder is an absent human, and `stall` for each open multi-human party action with no queued
`stall`, under an AI seat.

## Resolve (resolve.md) — one "turn moved" guard

The turn-advance group compares the fresh projection with the turn at assemble
(`{ round, activeCombatantId }`):

- the active combatant left the order (spec 048): skip `turn.advance`; settle; set the mode;
- the turn moved otherwise (a floor batch): skip the advance, settling and the mode row;
- the floor is held by the DM: skip the group.

`activeActorFor` and the settling rule come from `@the-stacks/session-model`.

## Constants

`FLOOR_ABSENCE_WAIT_MS = 30_000`, `FLOOR_STALL_WINDOW_MS = 120_000`, injectable through
`createDmEnqueuer` and the worker deps, as `quietMs`/`maxWaitMs` are for react.

**Amendment (TASK-0188).** Amended 2026-11-02 (decision-0028 §8; operator ruling 2026-11-02: "All (a), amend"). The `stall` check covers direct party
declares only. An `action.accept` batch holds `action.committed`, so it never arms a stall. No
floor rule changes.
