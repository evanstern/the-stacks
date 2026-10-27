---
title: The Stacks NPCs and Information Today
aliases: []
tags: [project, doctrine]
type: note
created: 2026-10-26
updated: 2026-10-26
related: [[NPCs-Social-and-Information]]
---

# The Stacks NPCs and Information Today

_How the-stacks stores and uses NPC data, social resolution and information at commit `b933a95` (main). Project facts only: file and line cites, stated doctrine, and gaps. No verdicts. The wider inventory (components C1-C21, doctrine ids, gaps G1-G24) is in the DM-Craft-Map branch; ids below refer to it as inventoried there, but this note re-verified each cite against the tree._

## Where an NPC lives

- Scene seed NPC: `identity` (role, `srdMonsterId`, `combatant`), `portrayal` (voice, want, detail, appearance, each up to 300 characters), `hooks` (`knows`, `secrets`, `relationships`, each list up to 8 entries) (`apps/server/src/dm/seed/schema.ts:35-47`, `:48-`). The seed is the stand-in for codex entities (decision-0009; comment at `schema.ts:9-13`).
- `relationships` holds typed edges to other entity ids (`schema.ts:42-46`); no prompt found reads it.
- No attitude, disposition, mood, loyalty or standing field exists in the seed schema, the session model or the engine. A search of `packages/` and `apps/` TypeScript for "attitude" and "disposition" returned only an unrelated test file.
- Beats carry `npcIds` and `clues` (each clue: text plus an optional check of ability, skill and DC) (`schema.ts:125-139`). The shipped seed uses clue checks such as `cha/persuasion DC 12` on Wenna's safe-path clue and `wis/insight DC 11` on her fear for Pell (`apps/server/seeds/greyhollow-ford.json`, beat `the-keeper`).
- No code outside the seed schema, loader validation and the DM-only text helper reads beat `clues` (`apps/server/src/dm/seed/load.ts:66-97` validates `npcIds`; `views.ts:89` lists clue text for tests). No prompt consumes clue text or its check.

## Who reads which NPC data

- Present NPCs: `assemble` collects the NPC ids of every beat in the seed as `presentNpcIds`, not only the active beat (`apps/server/src/dm/nodes/assemble.ts:264-274`). Narrate uses the active beat's `npcIds` when the Director names a beat, else the full list (`apps/server/src/dm/nodes/narrate.ts:113-116`).
- Director, Interpret: `seedEntries` renders each present NPC's id, name, role, voice and want (`apps/server/src/dm/prompts/common.ts:64-90`).
- Narrate: `facts.presentNpcs` carries id, name, voice, want and detail from `PlayerSeedView` (`apps/server/src/dm/facts.ts:100-106`, `:456-`). Appearance is in the view but not in the narration facts.
- `hooks.knows`, `hooks.secrets`, `hooks.relationships`: read by no prompt. `dmOnlySeedText` and the playtest auditor read them for leak tests (`apps/server/src/dm/seed/views.ts:77-`; `apps/server/src/playtest/auditor/checks.ts:285-289`). See [[DM-Side-Reading-of-NPC-Secrets]].
- NPC turns in `assemble` are monster turns derived from the encounter and the engine's combatant state (`assemble.ts:138-`, `:267`); they carry combatant and SRD monster ids, not conversation.

## How social actions resolve

- A player's talk to an NPC is talk, which never changes state and never triggers a DM turn (X4; decision-0016:17-19). A player's declared action to persuade is an action; the Interpret node reads it and chooses a step.
- The step grammar's `check` step lets the model choose `ability`, `skill` (a closed list), `expression` (including the modifier), `mode`, `dc`, and `onSuccess`/`onFailure` effects. A narrative outcome such as learning something is narration, not an effect (S8; `apps/server/src/dm/prompts/step-grammar.ts:10-27`; `apps/server/src/dm/nodes/schemas.ts:128-135`). The engine rolls and compares.
- The model chooses the DC; no DC table or attitude input exists in the grammar or the engine (gap G3, TASK-0104). The Influence action and Conversation Reaction table are not in the repo's rules extracts (the SRD Playing the Game text is not in `packages/srd/`; see DM-Craft-Map `SRD-5.2.1-Rules-Pass`).
- Stated doctrine pairs: `npc-voice` (P14: every named NPC has a voice, a want and one concrete detail; nodes narrate and companion; `doctrine.ts:137`); `villains-believe` (P16; director, narrate; `doctrine.ts:153`); `one-clue` (P22, topic Mystery: "Reveal the hidden truth slowly", right example "At most one real clue per beat"; node director; `doctrine.ts:202`); N6 (every other character is world: give them words, moves, reactions).
- Rule X12: DM-only seed text never reaches a player-facing prompt (narrate, companion, chronicle); the authoring rule says a player-facing field never states or implies a DM-only fact (`specs/034-narration-quality/contracts/player-facing-context.md`).
- P14, P16 and P22 are enforced by prompt text only, with data fields as support (gap G22 in DM-Craft-Map).
- Inventory statement: no stated rule exists for NPC knowledge limits or lying, contested checks PC versus NPC, or skill-challenge structure (DM-Craft-Map `The-Stacks-Doctrine-Today`, "no stated rule found" list).

## Evidence from runs

- TASK-0106 (spec 034): 6 hidden-info-leak fails in a captured run, mostly companion Odo stating the DM-only motive that the bell wards off the river-things; Snag's motive moved from `portrayal.want` to `hooks.secrets` (`specs/034-narration-quality/research.md:211,234`; card TASK-0106).
- Narration audit labels in spec 034 research include NPC, DECL, CONFUSED for the auditor treating an NPC or the world as player-controlled (`research.md:54,68,72`).

## Gaps stated or found

- G6: Director cannot read NPC secrets (TASK-0107).
- No persistent NPC state beyond the seed: nothing in the event log or projections records that an NPC's attitude changed, that the party learned a secret, or which clues were delivered. Tracker segments are the only DM-hidden state (X10).
- No consumer of beat `clues`.
- No lie or knowledge-limit rule. No contested-check step kind (DM-Craft-Map).
- `presentNpcIds` lists every NPC in the seed rather than only the NPCs in the active beat.

## Grounding

- [[_grounding]]
