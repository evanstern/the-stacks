---
name: dm-talk-triggers
description: The AI DM's table read (TASK-0180, specs/065; reworked by TASK-0199, specs/066, decision-0030) - the `readablePosts` rules, the 10 s window that moves with each post, `interruptRead`, code triggers, the one `react` call (`dm.react-v4`) with `confirm` and `answer`, code items for declared Intents, the `action.suggest` ship, `ask_dm`, the chain cap, companion prompts and reclaim.
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
  - apps/server/dm-scripts/greyhollow-confirm.json
verified_against: b811b90d03f6e4769956e6db4f8a3cd7fce790df
---

# DM talk triggers

Before TASK-0180 the DM answered only a commit. A public in-character `talk` post got no reply
(playtest run 2). This path lets the world react. It amends decision-0016 (decision-0027, D19).
Contract amendments: `specs/031-dm-runtime/contracts/turn-jobs.md`, `nodes.md`, `node-seam.md`,
`purposes.md`. Queue mechanics: [[dm-turn-jobs]]. Pipeline: [[dm-runtime]].

## Enqueue (rule 6)

`readablePosts` (`@the-stacks/session-model`, `read.ts`) lists what the AI DM reads; it is empty under
a human DM seat. Rule 1: a human or `ai:companion:*` speech Intent (`say`, `say_to`, `emote`) in
free mode. Rule 2: a `declared` human Intent in free mode whose kind is not speech, meta, session or
DM and that no action already links. Rule 3: a human `ask_dm` Intent, in any mode. Rule 4: a legacy
companion `talk` row with no Intent. `isReadable` (`talk-triggers.ts`) delegates to it. `capReached(p, 2)` counts
`ai:dm` narration rows since the last human row; a reached cap queues nothing.

For each batch of rows with a readable post, `talkReactions` first calls `interruptRead`
(`jobs.ts`): it ends a running `talk` turn that has shipped nothing (no submission, no narration),
sets `result.talk.outcome = "interrupted"` and rotates `claim_token`, so the worker's next fenced
write fails. It then calls `enqueueTalkTurn` with `postTs` and `windowMs`: one queued `talk` turn
per session, `notBefore = post ts + windowMs`, moved by every later post, with no cap. `readWindowMs`
is 10 s (`READ_QUIET_MS`); an `ask_dm` post in turn mode waits 0 s. `createDmEnqueuer` takes
`readWindowMs` in place of the old quiet and max-wait options. Any other queued turn absorbs the post. A later `enqueueTurn`
converts a queued `talk` turn to its own trigger. A rule 1 post that addresses only AI companions
queues a `prompt` companion job (`companionOnly`). `reconcileTurnJobs` does not repair a lost `talk`
turn. `createDmEnqueuer` takes `loadSeed` for role words. Rule 9 queues an `intent` turn for a
direct settled Intent ([[dm-turn-jobs]]).

## The talk path

The runner calls `runTalkTurn` where an empty beat returned `empty-beat`. A non-empty beat runs the
full pipeline. The worker records the presence marker with purpose `read` for a `talk` turn ([[presence]]).

1. `readPosts`: `readablePosts` after the latest DM read output (`isDmReadOutput`: an `ai:dm`
   narration, an `action.suggested` row or an `ai:dm` `ooc` talk row), up to `triggerSeq`.
2. `codeTriggers`: per present, living NPC or companion, `addressed` (name or alias leads the post
   or precedes a comma or `?`), `mentioned` (name, alias or seed role word), else `overheard`.
3. `codeItemsOf` turns each rule 2 post into one confirm item in code, restamped
   `<suggestionId>.i<n>`, `source: "ai"`, `commit: "declared"` (suggestion id `sug-<jobId>`, four
   at most). `needsModel` is true when a human-authored post is not rule 2. With no model need and
   no code item the outcome is `none`.
4. One `react` call (`ReactOutput`: `none`, `reply`, `scene`, `escalate`, `confirm`; fields `confirm`
   and `answer`), checkpointed in `TurnCheckpoint.react`. Model confirm items are `{ characterId, text,
   body }`; code stamps each with `stampIntent`, and drops one for a non-human, absent or downed
   character or a text the check flags. The turn pipeline's interpret output is `InterpretResult` (spec 104); the talk path does not read it.
5. Code checks: `checkNarration` (spec 103, TASK-0272) over the reply as the describe slot
   ([[dm-narration-quality]]): a leak drops the sentence and files a `dm` correction; a reply left empty records `none`. The same check cleans an `answer`. No second model call.
6. `escalate` runs resolve's opening move through a synthetic Director output when
   `legalEscalation` holds (free mode, no running encounter, encounter not yet run: `encounterRan`, spec 088); else `scene`.
7. Ship, each row fenced and keyed for reclaim through `shipReadRows`: an `ask_dm` answer as an
   `ooc` `talk` row visible only to the asker (`answer:1`), then one `action.suggest` row holding the
   items (`confirm:1`, `readSeq` the latest read post). `SUGGESTION_STALE` from the gate ends the
   read as `interrupted`. A `reply`, `scene` or `escalate` then ships one narration row with no action ids. A `reply` carries no State line; an `escalate` that opened a fight appends `State: The fight begins. It is <name>'s turn.` (spec 098 OQ-4). The worker stores `jobs.result.talk`
   (`posts`, `codeTriggers`, `modelTriggers`, `outcome`, `confirmItems`, `answered`, `reason`), queues the companion `prompt`
   job (none at the cap), a chronicle job, and after an escalation the first `npc-turn`.

## Reclaim

A landed narration is never shipped twice, and a landed `answer:1` or `confirm:1` row is not
shipped twice. A reclaimed escalation reads its posts as free mode
once the opening move landed (commit c2e6d785), because the mode is already `turn`. An interrupted
read writes nothing.

`dm.react-v4` uses purpose `dm.narrate` ([[dm-runtime]]); no new purpose or migration.
