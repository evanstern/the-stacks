---
title: The Stacks Resolution Today
aliases: []
tags: [resolution, project]
type: note
created: 2026-10-26
updated: 2026-10-26
related: [[Resolution-and-Outcome]]
---

# The Stacks Resolution Today

_Neutral summary of how the-stacks AI Dungeon Master resolves actions and narrates results today: the components and contracts that carry resolution, the doctrine that bears on it, the gaps on record and the operator ruling on TASK-0113. Taken from the project inventory pass (A3), limited to what bears on the nine sub-questions. No verdicts._

## Pin

Code, spec and doctrine citations hold at commit `dd2e5eb1e284614e4a3f6dc145bb7388502bd9e9` and at `e91c994023b9e3587518c2c67b98a0ad26be30c8` (one commit later; the diff touches only the TASK-0115 card). Branch `claude/agitated-goldberg-bff213`. The worktree head when this note was assembled was `f32776f`, later still; only the TASK-0115 card changed in the commits the inventory recorded.

Paths are repo-relative to the repo root `/Users/evanstern/projects/the-stacks/.claude/worktrees/agitated-goldberg-bff213`. `doctrine.ts` is `apps/server/src/dm/doctrine/doctrine.ts`. Paths under `pipeline/`, `nodes/` and `prompts/` are under `apps/server/src/dm/`.

Enforcement labels used below: PROMPT (text sent to a model), AUDIT-DET (pure code check in `nodes/audit.ts`), AUDIT-LLM (`dm.audit` model call), CODE (schema, legality table, engine, gate).

## Components that carry resolution

Pipeline order (fixed): assemble, director, interpret, adjudicate (conditional), resolve, narrate, audit (`pipeline/context.ts:25-33`; runner `pipeline/runner.ts:71`).

| Component | Role in resolution | Model decides | Code decides | Key files |
| --- | --- | --- | --- | --- |
| 5e engine (`@the-stacks/dnd5e-engine`) | Pure `execute(state, command, rng)` returning events or a refusal. Owns dice, nat 20 crit and nat 1 miss, AC and DC compare, resistances, damage, HP, life-state, death saves, conditions, initiative, rests, spell slots | nothing | every number | `packages/dnd5e-engine/src/execute.ts`; `src/schema/commands.ts` (`attack.roll` :95, `check.roll` :104); `src/schema/events.ts` (`attack.resolved` :85, `check.resolved` :98); R8 ruling in `docs/wiki/dnd5e-engine.md` |
| interpret (`dm.interpret`) | Reads each committed action into intent (talk, move, check, save, attack, spell, help, rest, other), an `uncertain` flag, `needsAdjudication` with `rulesQuestion`, a `clarify` question, and 0-6 steps (none, check, attack, effect, roll) | intent, uncertain flag, steps, d20 expression including the modifier, `dc`, `targetAc`, effects, clarify text | closed lists (skills, conditions, damage types, abilities) from engine enums; `dc` bounded 1-40 and `targetAc` 1-40; `rulesQuestion` required when `needsAdjudication` | `nodes/interpret.ts:13`; `nodes/schemas.ts:120-189`; `prompts/interpret.ts:21-59` (dm.interpret-v2); `prompts/step-grammar.ts:10-27` |
| adjudicate (`dm.adjudicate`) | Runs only when a reading sets `needsAdjudication`; retrieves library rules text; returns a one-line ruling, citations, 1-6 steps | ruling, steps, which citations | verifies library quotes against passages sent; SRD id lookup; unverified citations dropped and counted; `improvised` means no citation verified | `nodes/adjudicate.ts:22-51,55,77`; `nodes/schemas.ts:251-270`; `prompts/adjudicate.ts:15-21,45-49` |
| resolve | No model. The only DM node that writes; submits through the gate as `ai:dm`. Picks each next step from engine events alone (roll, read `check.resolved` or `attack.resolved`, then effects). Action outcome is `applied`, `refused`, `no-effect` or `awaiting-dm` | nothing | all | `nodes/resolve.ts:31-79,776,833`; `specs/031-dm-runtime/contracts/resolve.md:30-78` |
| Narration facts builder and dice-line renderer | Builds `NarrationFacts` from ledger rows the gate appended, never from a model; renders every number as code-written dice lines | nothing | all | `facts.ts:21-119,150,297,401,514`; `prompts/narrate.ts:56-114` |
| narrate (`dm.narrate`) | Writes prose of at most 1200 characters, with no digits, retelling the facts; code appends dice lines | prose | digit ban via audit; dice lines via renderer | `nodes/narrate.ts:28,71,95`; RULES `prompts/narrate.ts:20-33`; version dm.narrate-v3 `:18` |
| audit (`dm.audit`) and regenerate loop | Deterministic checks first; one `dm.audit` call only if they pass; at most 3 narrate attempts, then the fallback | audit model reports issues (ledger-mismatch, invented-mechanics, player-agency, doctrine, other) | which kinds block; party-name filter on player-agency | `nodes/audit.ts:39,41-67,73-143,190-301,303-461`; `prompts/audit.ts:9-44` |
| Director (`dm.director`) | Pacing node: beat resolve versus hold, table mode, tracker advances, scene end, pacing (tension, spotlight), private `goalNote` for the narrator | all six decisions | legality table | `nodes/director.ts:104-227`; `prompts/director.ts:19-38` |
| Doctrine module | 24 Rule/Wrong/Right pairs, each tagged with the nodes that render it, placed in the node system prompt under a 900-token cap | n/a | selection by node tag | `doctrine.ts:14-20,31-225`; `prompts/common.ts:15-26,33-46` |

### Engine-owned versus model-supplied

- The engine owns: dice and RNG; nat 20 crit and nat 1 miss; total versus AC or DC; resistance, immunity and vulnerability; crit damage doubling; HP and temp HP; life-state; death saves; conditions applied or removed; initiative and turn order; rests; spell-slot bookkeeping (`docs/wiki/dnd5e-engine.md`, Entry point and R8 ruling; `packages/dnd5e-engine/src/schema/commands.ts`).
- The model supplies as data (interpret and adjudicate): the d20 expression including its modifier, the `dc`, the `targetAc`, roll mode, auto-fail reason, defenses and damage dice (`prompts/step-grammar.ts:22`; `specs/033-director-robustness/contracts/rules-terms.md:28`). Recorded gap: TASK-0104.
- Spells: no spell id exists in any output schema; `intent: spell` plays as model-written check, attack and effect steps (`rules-terms.md:27`; TASK-0105).
- Closed lists enforced by code: conditions (`nodes/schemas.ts:35-54`), skills (`:56-79`), abilities (`:24-33`), damage types (`prompts/step-grammar.ts:25`), SRD citations and library quotes (`nodes/adjudicate.ts:55,77`).

## Contracts that carry resolution

| Contract | Producer to consumer | Shape and fields | Cite |
| --- | --- | --- | --- |
| `InterpretReading`, `Step`, `Effect` | interpret and adjudicate to resolve | Steps carry mechanics inputs only, with no total or verdict field. Check step: kind, ability, skill, `expression`, mode, `dc`, autoFail, onSuccess, onFailure. Attack step: attackerId, targetId, `expression`, mode, `targetAc`, onHit. Effects: damage, heal, condition | `nodes/schemas.ts:95-189` |
| `FactRoll`, `FactChange`, `FactEvent`, `FactOutcome` | facts builder | Roll: name, reason, expression, shown, total, against (AC or DC, value), outcome, autoFail, target. Roll outcome values: hit, miss, critical-hit, success, failure. Change: hp (damage or heal, amount, damageType, before, after), life-state (before, after), condition (applied or removed). Event: encounter-started, encounter-ended, turn-advanced, combatant-joined, combatant-left | `facts.ts:21-70` |
| `NarrationFacts` | facts builder to narrate, audit, fallback | trigger; actions[] (actionId, characterName, text, outcome applied, refused or no-effect, refusalCode, rolls, outcomes, changes); npcTurn; director (pacing, goalNote, sceneEnded); modeChange; presentNpcs (name, voice, want, detail); rulings; clarify; party (characterId, name, controller human or ai-companion); npcNames; events; setting (locationName, openingFraming) | `facts.ts:90-119` |
| `Ruling` | adjudicate to resolve, narrate | actionId, ruling, improvised, citations | `nodes/adjudicate.ts:39-51` |
| `AuditIssue`, `RecordedIssue`, `AuditAttempt`, `AuditRecord` | audit to submitNarration | issue (kind, detail); recorded adds `blocking`; attempt; record (attempts, final passed, passed-after-regenerate or fallback, flagged, shippedProseSha256) | `nodes/audit.ts:50-53,69-71,145-164` |

## Definitions stated in project text

| Term | Definition as stated | file:line |
| --- | --- | --- |
| Player agency (`player-agency`) | Prose decides what a party member says, feels or chooses beyond their declared action. Carrying out the declared action is allowed. AI companions count as party. The audit issue blocks only when its detail names a party member | `prompts/audit.ts:29`; `specs/034-narration-quality/contracts/audit-criteria.md:21-59`; `nodes/audit.ts:97-143` |
| No rules effect (`no-effect`) | Nothing was rolled and no game state changed; the attempt still happens in the story; never grant a hit, wound, condition, death or hidden discovery without a fact | `prompts/narrate.ts:27,68-70`; `specs/034-narration-quality/research.md:95-105` |
| Party member versus world character | Party is every `facts.party` entry, human or AI companion; all others are the world | `audit-criteria.md:32-35`; `prompts/narrate.ts:117-129` |
| Blocking versus advisory issue | Deterministic checks all block. For `dm.audit`, ledger-mismatch and invented-mechanics block; player-agency blocks if and only if it names a party member; doctrine and other are advisory | `audit-criteria.md:8-19`; `nodes/audit.ts:73-80` |
| Ordering is the anti-cheat | Dice resolve before narration; the narrator receives results as facts | decision-0017:42-43 |

## Stated rules that bear on resolution

### Narrate-v3 rules (`prompts/narrate.ts`, dm.narrate-v3)

| ID | Rule (paraphrase) | Line | Enforced by |
| --- | --- | --- | --- |
| N4 | Never contradict a fact: a hit lands, a miss misses, a failure fails; do not invent rolls | 24 | PROMPT; AUDIT-DET K3-K5; AUDIT-LLM ledger-mismatch and invented-mechanics (blocking) |
| N5 | Party members, AI companions included, are player characters. Never decide what one says, feels or chooses. The narration may show a party member carrying out a declared action in plain words and nothing more. Never invent a companion's speech or state | 25 | PROMPT; AUDIT-LLM player-agency, blocking if the detail names a party member |
| N7 | No rules effect means nothing was rolled. The attempt still happens; show what the world does. Never grant a hit, wound, condition, death or hidden discovery without a fact | 27 | PROMPT; facts render no-effect text (`prompts/narrate.ts:68-70`); AUDIT-LLM |
| N8 | When a foe's attack misses, its grab fails, or a party member succeeds on a save against it, describe only what the foe did. The party member stays unchanged and unmoved, with no wound, no dodge and no twisting free. No wound on a party member without a damage fact | 28 | PROMPT only; code adds no detection (`specs/034-narration-quality/contracts/narration-facts.md:108`); AUDIT-LLM may flag it as invented-mechanics |

### Doctrine pairs (`doctrine.ts`, line is the `id:` line)

| ID | Pair id | Rule (paraphrase) | Line | Nodes tagged | Enforced by |
| --- | --- | --- | --- | --- | --- |
| P6 | hero-is-theirs | Never decide the hero's words, feelings or moves | 73 | narrate, audit, companion | PROMPT (N5, S9); AUDIT-LLM player-agency (A1), blocking only when detail names a party member (`nodes/audit.ts:123-143`) |
| P7 | world-not-hero | Narrate what the world did to the attempt, not the hero's inner state | 81 | narrate, audit | PROMPT; AUDIT-LLM (A1) |
| P8 | blame-the-situation | A failed roll is the world's doing, not the hero's incompetence | 89 | narrate | PROMPT only |
| P9 | roll-when-uncertain | Roll only when the outcome is uncertain and failure is interesting | 97 | interpret, director | PROMPT (also `prompts/interpret.ts:56`); CODE: a `none` step exists; no check that `uncertain` matches a roll |
| P10 | fail-forward | A failure creates a new problem and never stalls the scene | 105 | narrate, interpret | PROMPT only; not tagged for director or audit; no deterministic check |
| P11 | trying-costs | Trying costs something: time, noise, a tracker segment | 113 | director, interpret | PROMPT; CODE only through tracker deltas (legalizeDirector) |
| P12 | ask-when-unclear | When intent is unclear, ask one short question | 121 | interpret | PROMPT (`prompts/interpret.ts:56`); CODE: `clarify` max 200 characters (`nodes/schemas.ts:177`), resolve marks it no-effect (`resolve.md:50`); AUDIT-DET K8 |
| P13 | yes-and | Treat a creative plan as an opportunity; set a DC rather than refuse | 129 | interpret, director | PROMPT; adjudicate route via `needsAdjudication` for inventive actions (`prompts/interpret.ts:56`) |
| P19 | dice-stand | Never change a result; soften hard outcomes through the story, at a cost | 178 | director, narrate | PROMPT; structural support X2 (facts are true and fixed) |
| P24 | brief-rulings | Rule in one line, then return to the scene | 218 | narrate, interpret | PROMPT; the adjudicate ruling is one line (`prompts/adjudicate.ts:19`); resolve writes a dm journal entry per ruling (`resolve.md:35-36`) |

## Gaps on record that bear on resolution

| # | Gap | Where recorded | Status |
| --- | --- | --- | --- |
| G1 | Operator ruling on TASK-0113: narrate-v3 E3 and the audit-v2 player-agency definition are stricter than the operator's intent; involuntary effects derivable from the ledger should be allowed; player-agency should block only volitional acts. Evidence: F1 scene-start hero move, F6 dodge on a recorded miss, F7 companion treated as a hero by the playtest auditor, seq 130 invented near-miss | `backlog/tasks/task-0113 ...md` (To Do, Low, m-3), ACs #1-#3; `specs/034-narration-quality/evidence/verify-20261026T192319Z-greyhollow-ford-provider/classification.md:43-49` | open |
| G3 | Model-chosen modifiers, DCs and target AC: interpret and adjudicate emit a free `expression`, numeric `dc` and `targetAc`; the engine does not derive them from stats or an SRD DC table | TASK-0104 (To Do, Medium, m-3); `rules-terms.md:28`; `prompts/step-grammar.ts:22`; `nodes/schemas.ts:131,143` | open |
| G13 | Player-agency audit residual: issues naming a party member only in passing still block (4 of 13); closing-question complaints filed as player-agency still block (3 of 13); the first-named-character alternative rule was not adopted | `audit-criteria.md:70-73`; `research.md:311-333` (R7.2); TASK-0106 notes | recorded, not fixed |
| G14 | narrate-v3 E3 is prompt-only with no code detection; adherence not measured on a captured run | `narration-facts.md:108-115`; TASK-0113 AC #2 | open |
| G16 | R3: one invented near-miss with no miss fact (seq 130) | classification.md R3; TASK-0113 Evidence | open, folded into TASK-0113 |
| G17 | Narrator chime-in to table talk not implemented (decision-0016 allows it); trigger and rate rules carded | TASK-0052 (m-3, depends on TASK-0048) | open |
| G22 | Pairs and rules whose only enforcement in the files read is prompt text: P8, P10, P14 (beyond data fields), P15, P16, P17, P19, P20, P22, P23, N8, N10 | cross-check of the Enforced by columns | observation from the inventory, not a card |

## Topics with no stated rule found in the files read

The inventory searched `doctrine.ts`, all `prompts/*.ts`, decisions 0012-0021, specs 031, 033 and 034 contracts, and the DM sections of `docs/design/architecture.md`. It found no stated rule for: combat pacing beyond mode switching and tracker use; death-save narration beyond K4; rest and healing narration; travel, time and resources; NPC knowledge limits or lying; downtime; skill-challenge structure; contested checks between a PC and an NPC; group checks; circumstance-granted advantage (interpret may set `mode`, but no rule says when); passive scores; stealth and surprise; morale beyond seed `morale` text and the Director's `goalNote` signal (`director.md:90-93`); retry of a failed check beyond P11; what a roll may decide involuntarily for a player character (see G1).

## TASK-0113 operator ruling, verbatim

Source: `backlog/tasks/task-0113 ...md`, Implementation Notes.

> OPERATOR RULING 2026-10-26 (during the M2 demo), in the operator's words: 'It makes perfect sense for the DM to narrate the reaction of a character in combat *after* being hit, or missing, etc. As long as that description is not something that takes away *choices* from the player. Saying "You get hit by a big club and it staggers you back a step" is fine if the roll makes sense (critical hit, for example) -- the player has no agency there, it happened, they got staggered back a step. Or even "You are surprised by this and it shows on your face" -- that's another one that a roll could decide, it's reflexive. But, you don't want "You see your long long love and run to meet her" -- that's a decision for the player and it is not something a DM roll could account for. ... Actions occur -> Evaluate for potential roll-able side-effects (reactions, reflexes, etc) -> Narration suggestion -> Evaluation (do not take away agency) -> loop until accepted'.
>
> Consequences, stated by the orchestrator: (1) TASK-0106's narrate-v3 rule E3 ('unchanged and unmoved: no wound, no dodge') and audit-v2's player-agency definition are stricter than the ruling and must be revised. (2) Proposed shape: code derives the allowed involuntary effects from the ledger (critical hit, damage share of max HP, a failed save's effect) as facts for both the narrator and the auditor. player-agency blocks only volitional acts (movement with intent, speech, decisions, chosen emotional responses). The existing narrate, audit and regenerate loop (3 attempts) stays. (3) Scope this card as a spec (doctrine change), not a patch.

## Grounding

- [[_grounding]] — method, sources and gaps
- [[Resolution-and-Outcome]]
