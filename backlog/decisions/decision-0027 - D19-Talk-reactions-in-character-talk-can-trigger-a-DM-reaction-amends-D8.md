---
id: decision-0027
title: 'D19 Talk reactions: in-character talk can trigger a DM reaction (amends D8)'
date: '2026-10-30 05:19'
status: proposed
---
## Context

decision-0016 (D8) says talk "never changes state" and "never triggers a DM turn". It lets the
narrator chime in as talk "for example when mentioned", but no code builds a chime-in.
`apps/server/src/dm/enqueue.ts` queues DM work only on `action.committed`, an `ai:dm` proposal
decision, a human comment on a companion's open action, and floor events. A `talk` row matches
none of them.

Evidence: two-browser alpha run 2, item 1 (`docs/playtests/2026-10-28-two-browser-alpha.md`,
session `166b8e59`). Brother Odo asked Wenna Marsh "who's missing from this house?". Tamsin spoke
a line in character. No NPC answered and nothing in the scene changed. The operator expects
every action to be able to cause a reaction, and that reaction to cause further reactions, with
AI-only back-and-forth capped so the PCs drive the scene (TASK-0180).

Bounds this record keeps:

- decision-0025 (D17) rule 2.7: talk is flavour. A talk reaction may voice intent, offers and
  threats. It may not enact a change or assert a state the snapshot does not hold.
- decision-0025 rule 2.5: encounter start passes, because initiative is a roll.
- decision-0026 (D18) point 3: player-facing generators read the `PlayerSeedView` only.
- decision-0026 point 1: player-facing text states a DM-only item only after a reveal fact.
- decision-0026 Consequences: persuasion is a declared action. Only a committed action reaches
  the action pipeline (decision-0016).

**Status: proposed.** The operator rules OQ-1 to OQ-16 in `specs/065-talk-triggers/spec.md`.
The text below is written against each OQ's recommendation (a). A different ruling changes the
section that names that OQ.

## Decision

### 1. Amendment to decision-0016

After this record, the talk bullet of decision-0016 reads:

> **Talk:** in-character or out-of-character chatter. Never reaches the action pipeline. An
> in-character post can draw a **talk reaction** (decision-0027): the AI DM reads it for
> triggers and decides the next beat, which is an NPC reply, a scene beat, an encounter start,
> or nothing. Talk cannot roll or move anything, except that an encounter start rolls
> initiative.

The action lifecycle, the commit authority table and the concurrency rule are unchanged.

### 2. Which posts are read

A post is read when every condition holds:

1. It is a `talk` row with channel `ic` and visibility `public`. OOC talk, `dm` talk and
   whispers are never read.
2. Its author is a human player or an AI companion. Rows by `ai:dm` are never read.
3. The DM seat is the AI DM (OQ-13). A human DM voices the world without help.
4. The table is in free mode (OQ-12). In turn mode, talk reaches the next beat's narrate through
   the transcript tail only.
5. The chain cap (section 5) is not reached.

### 3. Triggers (OQ-1, OQ-2)

Code reads each post against the actor snapshot and the seed, and names the triggers it can
detect. The model names the rest and decides what all of them mean.

| Trigger | Meaning | Named by |
|---|---|---|
| `addressed` | The post speaks to a present actor by name, alias or role ("Wenna", "innkeeper"). | Code: snapshot aliases and seed role words; the model may correct `addressed` to `mentioned` |
| `mentioned` | The post names or refers to a present actor who is not spoken to. | Code: the same match |
| `overheard` | A present NPC who is neither addressed nor mentioned hears the post. Earshot is the whole scene until position is tracked (TASK-0139). | Code: every present, non-party NPC, minus the addressed and mentioned |
| `narrator` | The post asks the world or the DM something ("Does anyone answer?"). | The model |
| `hostile` | The post threatens, insults or provokes a present actor. | The model |

Code skips the model call when the scene holds no present non-party NPC and the post asks nothing
(OQ-16). A human post that addresses only AI companions queues a companion `prompt` job for them,
with no DM model call (OQ-11).

### 4. From triggers to the next beat (OQ-3 to OQ-9)

One model call reads the unread posts, their triggers, the `fiction` snapshot view, the
`PlayerSeedView` and the transcript tail. It returns exactly one outcome:

| Outcome | What ships | State change |
|---|---|---|
| `none` | Nothing. The job result records the reason. | None |
| `reply` | One present NPC answers in its seed voice, as a `narration` row by `ai:dm`. | None |
| `scene` | A short world beat (a door bangs, a dog barks, someone turns away), as a `narration` row. | None |
| `escalate` | A seed encounter starts (monsters join, initiative rolls, table mode becomes `turn`), then a `narration` row. | Encounter start only |

Rules for every outcome:

1. The text passes code checks before it ships: the output claim gate (`checkClaims`), the
   DM-only seed text check and the digit check. A refused text is regenerated once. A second
   refusal ships nothing and records `none`.
2. A reply never states a DM-only item. An NPC asked about something it knows only in DM-only
   data answers in character without stating it. A player gets the substance by declaring an
   action (Persuasion, Insight). TASK-0148 (reveal facts) may widen this later.
3. No outcome advances a tracker, ends a scene, or changes scene presence or attitude
   (decision-0025 rule 2.2).
4. When a DM beat is already queued, that beat absorbs the post. Its narrate sees the post in
   the transcript tail (OQ-14).

### 5. Chains, the cap, and the floor (OQ-10)

1. A reaction can draw further reactions. A `reply` or `scene` may name present AI companions to
   prompt. Each prompted companion's `say` is a post under section 2 and is read in turn.
2. **Cap:** a post is read only while fewer than **2** `narration` rows by `ai:dm` follow the
   latest human-authored row. A human-authored row is any row whose actor is a human user.
3. The reaction that reaches the cap names no companion to prompt. Its prompt tells the model to
   end on a beat that leaves the next move to the PCs.
4. **The floor returns** to the PCs whenever no AI job is queued: at the cap, or after a `none`,
   a `scene`, or a `reply` that prompts no companion. Nothing waits on an AI after that. The next
   human-authored row resets the count.

### 6. When a reaction moves the table into turn mode (OQ-9)

A reaction yields `escalate` only when every condition holds:

1. The reaction is violence, or action fast enough that the order of acts matters (a grab, a
   bolt for the door, a drawn blade).
2. The seed holds an encounter for it that has not started and has not ended. Code checks this
   with the rule the Director's `turn` decision uses (`encounterToStart`).
3. The table is in free mode.

Code applies the start as the resolve opening move (decision-0025 §4, group 1), with no action
group. Initiative is a roll, so rule 2.5 passes it. From there the existing turn flow runs: an
NPC turn or a companion turn queues by initiative. A fast or violent reaction with no legal seed
encounter yields `scene` and the table stays in free mode.

### 7. Relation to TASK-0052 (OQ-15)

TASK-0052 (narrator chime-in with several humans) is covered here: stated triggers (its AC #1),
no dice and no state change outside section 6 (AC #3), and the trigger recorded on the job result
(AC #4). The chain cap replaces its per-minute rate limit (AC #2).

## Consequences

- `enqueue.ts` queues a turn job with trigger `talk` for a read post, after a quiet window that
  coalesces several lines (OQ-4). The turn runs a short path with one model call (OQ-3).
- The reaction call uses the existing `dm.narrate` purpose with its own prompt version
  `dm.react-v1` (OQ-5). The hosted AI config needs no change.
- Frozen contracts are unchanged: `docs/wiki/ws-protocol.md` frame shapes,
  `specs/029-proposal-gate/contracts/` and `specs/030-play-route/contracts/proposal-seam.md`.
  The 031 DM-runtime contracts are amended additively. No migration.
- TASK-0172 and TASK-0173 later widen what a reply may state and what an NPC learns from talk.
  TASK-0149 attitude moves only through its own facts. A talk reaction never moves it.
- TASK-0144 (claim gate on companion `say`) gates the companion half of a chain.
- Implementation cards follow the operator's ruling (TASK-0180 AC #6).
