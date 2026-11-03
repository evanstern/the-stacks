---
name: dm-talk-triggers
description: In-character talk draws a world reaction (TASK-0180, specs/065, decision-0027) - the readable-post rule, code triggers, the 3 s quiet window and coalesced `talk` turn, the model-skip rule, the one `react` call (`dm.react-v2`), code checks, escalation into an unstarted encounter, the two-reaction chain cap, companion prompts, and the reclaim rules.
kind: pipeline
sources:
  - apps/server/src/dm/talk-triggers.ts
  - apps/server/src/dm/talk-turn.ts
  - apps/server/src/dm/prompts/react.ts
  - apps/server/src/dm/enqueue.ts
  - apps/server/src/dm/jobs.ts
  - apps/server/src/dm/worker.ts
  - apps/server/src/dm/pipeline/runner.ts
  - apps/server/src/dm/pipeline/context.ts
  - apps/server/src/dm/nodes/schemas.ts
  - apps/server/dm-scripts/greyhollow-talk.json
verified_against: 9782af9dd01a8cb7cd5781c2c0c5e7df57b1c61b
---

# DM talk triggers

Before TASK-0180 the DM answered only a commit. A public in-character `talk` post got no reply
(playtest run 2). This path lets the world react. It amends decision-0016 (decision-0027, D19).
Contract amendments: `specs/031-dm-runtime/contracts/turn-jobs.md`, `nodes.md`, `node-seam.md`,
`purposes.md`. Queue mechanics: [[dm-turn-jobs]]. Pipeline: [[dm-runtime]].

## Enqueue (rule 7)

`isReadable` (`talk-triggers.ts`): channel `ic`, visibility `public`, actor a human or
`ai:companion:*`, an AI DM seat, table mode `free`. `capReached(p, 2)` counts `ai:dm` narration
rows since the last human row. A readable post under the cap calls `enqueueTalkTurn`: one queued
`talk` turn per session, `notBefore = least(now + 3 s, firstPostAt + 10 s)`. Any other queued turn
absorbs the post. A later `enqueueTurn` converts a queued `talk` turn to its own trigger and drops
the wait. A post that addresses only AI companions queues a `prompt` companion job instead
(`companionOnly`). The claim's `notBefore` gate covers kind `turn`. `reconcileTurnJobs` does not
repair a lost `talk` turn. `createDmEnqueuer` takes `loadSeed` for role words.

## The talk path

The runner calls `runTalkTurn` where an empty beat returned `empty-beat`. A non-empty beat runs the
full pipeline.

1. `readPosts`: readable `talk` rows after the last `ai:dm` narration, up to `triggerSeq`.
2. `codeTriggers`: per present, living NPC or companion, `addressed` (name or alias leads the post
   or precedes a comma or `?`), `mentioned` (name, alias or seed role word), else `overheard`.
3. `needsModel` is false when no non-party NPC is named and no post holds `?`: outcome `none`.
4. One `react` call (`ReactOutput`: `none`, `reply`, `scene`, `escalate`), checkpointed in
   `TurnCheckpoint.react`.
5. Code checks: `deterministicChecks` over facts with `trigger: "talk"` and no actions
   ([[dm-narration-quality]]), a DM-only seed text substring check and a present-speaker check.
   One regenerate; a second refusal records `none`.
6. `escalate` runs resolve's opening move through a synthetic Director output when
   `legalEscalation` holds (free mode, no running encounter, encounter unstarted); else `scene`.
7. `submitNarration` ships one row with no action ids. The worker stores `jobs.result.talk`
   (`posts`, `codeTriggers`, `modelTriggers`, `outcome`, `reason`), queues the companion `prompt`
   job (none at the cap), a chronicle job, and after an escalation the first `npc-turn`.

## Reclaim

A landed narration is never shipped twice. A reclaimed escalation reads its posts as free mode
once the opening move landed (commit c2e6d785), because the mode is already `turn`.

`dm.react-v2` uses purpose `dm.narrate` ([[dm-runtime]]); no new purpose or migration.
