---
title: The Stacks Doctrine Today
aliases: []
tags: [dm-craft, project]
type: note
created: 2026-10-26
updated: 2026-10-26
related: [[DM-Craft-Map]]
---

# The Stacks Doctrine Today

_Neutral summary of the the-stacks AI Dungeon Master: its components, the doctrine it states, the gaps on record, and the operator ruling on TASK-0113. Taken from the project inventory pass (A3). No verdicts. Ids (C, P, N, A, S, X, K, G) are used by the [[Coverage-Matrix|Coverage Matrix]]._

## Pin

Code, spec and doctrine citations hold at commit `dd2e5eb1e284614e4a3f6dc145bb7388502bd9e9` and at `e91c994023b9e3587518c2c67b98a0ad26be30c8` (see the Commit pin section).

Repo root for all paths: `/Users/evanstern/projects/the-stacks/.claude/worktrees/agitated-goldberg-bff213`.
Paths are repo-relative. `doctrine.ts` = `apps/server/src/dm/doctrine/doctrine.ts`.
No verdicts. "Enforced by" values: PROMPT (text sent to a model), AUDIT-DET (pure code check in `nodes/audit.ts`), AUDIT-LLM (`dm.audit` model call), CODE (schema, legality table, engine, gate), NONE-FOUND.

## Components

Pipeline order (fixed): assemble, director, interpret, adjudicate (conditional), resolve, narrate, audit (`pipeline/context.ts:25-33`; runner `pipeline/runner.ts:71`). Every node is `(TurnContext) => NodeResult` (`pipeline/context.ts:135-137`). Seven LLM purposes (`purposes.ts:7-15`); each call names exactly one. Decision-0017 lines 18-40 give the four-layer split; layers 1 and 2 hold no LLM. All `pipeline/`, `nodes/`, `prompts/` paths below are under `apps/server/src/dm/` unless a full path is given.

| # | Component | Role | Model decides | Code decides | Key files |
|---|---|---|---|---|---|
| C1 | Session event log | Only source of truth; scene, party, encounter, journal are projections (decision-0017:20-21) | nothing | all | `packages/session-model/src/catalog.ts:70-92` (catalog: talk, narration, action.declared/commented/committed/resolved, table-mode.changed, scene.changed, party.member.changed, tracker.changed (dm-only :79), journal.entry.added, proposal.created/approved/rejected (dm-only), dm.seat.changed, gate.policy.changed, plus engine mechanics events); `docs/wiki/event-log.md` |
| C2 | Proposal gate | Every write is a typed proposal; policy auto/ask/suggest per kind; commit authority by table mode; refuse-before-write (decision-0015:15-27; decision-0016:24-33) | nothing | policy, permission, commit authority, atomic append | `apps/server/src/gate/gate.ts`; `packages/session-model/src/gate/policy.ts:12-24` (DEFAULT_POLICIES: ask for talk, action.comment, action.commit, mechanics, narration, table-mode, party, tracker; auto for action.resolve, journal; suggest for scene; AI seat = auto for all kinds); 12 proposal kinds (`docs/wiki/proposal-gate.md`) |
| C3 | 5e engine (`@the-stacks/dnd5e-engine`) | Pure `execute(state, command, rng) -> events or refusal`; owns dice, crit/miss rule, AC/DC compare, resistances, damage, HP, life-state, death saves, conditions, initiative/turns, rests, spell slots | nothing | every number | `packages/dnd5e-engine/src/execute.ts`; `src/commands/` (attacks, combatants, conditions, encounter, hit-points, life, rests, roll, spell-slots); `src/schema/commands.ts` (20 command types, e.g. `attack.roll` :95, `check.roll` :104, `damage.apply` :126, `rest.long` :221); `src/schema/events.ts` (`attack.resolved` :85, `check.resolved` :98, `hp.changed` :137, `life-state.changed` :152, `condition.applied` :169, `encounter.started` :211); R8 ruling in `docs/wiki/dnd5e-engine.md` section "R8 ruling" (engine owns attack/save/check arithmetic; model supplies expression, mode, AC/DC, defenses, auto-fail reason as data; engine does not derive auto-fail from conditions) |
| C4 | SRD data (`@the-stacks/srd`) | 903 validated SRD 5.2.1 records, id/name lookup, ~120-token compact form | nothing | lookup | `packages/srd/src/*`; `nodes/assemble.ts:18` (MAX_SRD_RECORDS = 8), `:199` selectSrd; decision-0012 |
| C5 | Scene seed + PlayerSeedView | Hand-authored scene (goal with success/failure, location, beats with clues and optional checks, NPCs with identity/portrayal/hooks, characters with abilityMods/saves/skills/attacks/spells, encounters with trigger and morale, trackers with advanceWhen, opening framing); stand-in for codex (decision-0009) | nothing | validation; DM-only vs player-facing field split | `seed/schema.ts:35-47` (Portrayal voice/want/detail/appearance; Hooks knows/secrets/relationships), `:48-58` (SeedNpc), `:60-94` (SeedCharacter), `:96-183` (SceneSeedSchema); `seed/views.ts:1-94` (PlayerSeedView, `playerFacingSeed`, `dmOnlySeedText`); `apps/server/seeds/greyhollow-ford.json`; field-class table `specs/034-narration-quality/contracts/player-facing-context.md:15-31` |
| C6 | assemble | No LLM. Freezes the beat (committed unresolved actions in seq order), folds the DM projection, selects seed material and SRD records, derives the NPC turn, transcript tail | nothing | all | `nodes/assemble.ts:22-52` (BeatItem, AssembleOutput), `:263` assemble, `:17-20` (TRANSCRIPT_TAIL 20, MAX_SRD_RECORDS 8, REJECTION_LIMIT 2) |
| C7 | Director (`dm.director`) | Pacing node: beat resolve vs hold for companions; table mode free/turn; tracker advances (-3..3); scene end (goal-met / retreat / failed); `pacing` (tension low/rising/high, spotlight, seed beat id); private `goalNote` for narrator; companion prompts | all six decisions | legality table (see below); text cap 300 chars; overrides recorded | `nodes/director.ts:104-227` legalizeDirector (hold `:158-175`, table mode `:176-193`, trackers `:194-`), `:89` normalizeDirector, `:229` director; schema `nodes/schemas.ts:196-249`; prompt `prompts/director.ts:19-38` (dm.director-v2); contract `specs/031-dm-runtime/contracts/director.md:47-56`; decision-0018:15-22 |
| C8 | interpret (`dm.interpret`) | Reads each committed action into `intent` (talk/move/check/save/attack/spell/help/rest/other), `uncertain`, `needsAdjudication` + `rulesQuestion`, `clarify` question, and 0-6 steps (none/check/attack/effect/roll) | intent, uncertain flag, steps, d20 expression including the modifier, `dc`, `targetAc`, effects, clarify text | closed lists (skills, conditions, damage types, abilities) derived from engine enums; bounds `dc` 1-40, `targetAc` 1-40; `rulesQuestion` required when `needsAdjudication` | `nodes/interpret.ts:13`; schema `nodes/schemas.ts:120-189` (StepSchema :120-157, reading :160-189); prompt `prompts/interpret.ts:21-59` (dm.interpret-v2); step grammar `prompts/step-grammar.ts:10-27` |
| C9 | adjudicate (`dm.adjudicate`) | Runs only when a reading sets `needsAdjudication`; retrieves library rules text; returns a one-line ruling, citations, 1-6 steps | ruling, steps, which citations | verifies library quotes against passages sent; SRD id lookup; unverified citations dropped and counted; `improvised` = no citation verified; relevance floor `minSimilarity` | `nodes/adjudicate.ts:22-51` (VerifiedCitation, Ruling), `:55` verifyLibrary, `:77` adjudicate; schema `nodes/schemas.ts:251-270`; prompt `prompts/adjudicate.ts:15-21,45-49` (dm.adjudicate-v2); `docs/wiki/retrieval.md` |
| C10 | resolve | No LLM; the only DM node that writes; submits via `gate.submit` as `ai:dm`: Director group, ruling group (dm journal entries), action groups in commit-seq order, NPC group, turn-advance group. Picks each next step from engine events alone (roll, read `check.resolved`/`attack.resolved`, then effects) | nothing | all; a gate refusal becomes a recorded result; `CONFLICT` retried twice (200 ms, 800 ms :29); action outcome `applied` / `refused` / `no-effect` / `awaiting-dm` | `nodes/resolve.ts:31-79` (Submission, ActionOutcome, ResolveOutput), `:564` directorGroup, `:776` resolveAction, `:833` resolve, `:1055` submitNarration; contract `specs/031-dm-runtime/contracts/resolve.md:30-78` (outcome rules :50-65: clarify or `none` step gives `no-effect`; first mechanics step refused by engine gives `refused`) |
| C11 | Narration facts builder + dice-line renderer | Builds `NarrationFacts` from the ledger rows the gate appended (never from a model); renders every number as code-written dice lines | nothing | all | `facts.ts:21-119` (types), `:150` collectFacts, `:297` renderDiceLines, `:401` buildNarrationFacts, `:514` nothingToNarrate; `prompts/narrate.ts:56-114` (factEntries, describeChange render facts as prompt text) |
| C12 | narrate (`dm.narrate`) | Writes <= 1200-char digit-free prose retelling the facts; code appends dice lines (`composeText`) | prose | digit ban via audit; dice lines via renderer | `nodes/narrate.ts:28` (MAX_PROSE_CHARS 1200), `:71` narrateAttempt, `:95` narrate; RULES `prompts/narrate.ts:20-33`; version `:18` (dm.narrate-v3); import closure holds no engine value or RNG (`nodes/narrate.ts:20-26`) |
| C13 | audit (`dm.audit`) + regenerate loop | Pure `deterministicChecks`; one `dm.audit` call only if they pass; pass/fail derived in code; at most 3 narrate attempts, then fallback | audit model reports issues (ledger-mismatch, invented-mechanics, player-agency, doctrine, other) | which kinds block; party-name filter on player-agency; model `verdict` recorded, not used | `nodes/audit.ts:39` (MAX_NARRATION_ATTEMPTS = 3), `:41-67` (kinds, AuditModelOutput), `:73-143` (blocking set, party-name filter), `:190-301` (deterministicChecks), `:303-461` (loop); prompt `prompts/audit.ts:9-44` (dm.audit-v2); word lists `audit-words.ts:1-70`; contracts `specs/031-dm-runtime/contracts/audit.md`, `specs/034-narration-quality/contracts/audit-criteria.md` |
| C14 | Factual fallback | Deterministic in-fiction prose shipped after 3 failed attempts, a failed audit call or a failed regeneration; never sent to `dm.audit`; plus a `dm`-visibility journal flag | nothing | all | `fallback.ts:156` factualSummary, `:39` SYSTEM_WORDS, `:43` spellDigits; `nodes/audit.ts:341-361`; contract `specs/034-narration-quality/contracts/fallback-summary.md` |
| C15 | Companion job (`dm.companion`) | AI party members say / comment / declare through the same gate path as a human; output `say`, `comment` (approve/object/comment), `act` + `commit`; in turn mode the active companion must act (null act becomes "holds position and watches for an opening") | what to say, comment, attempt | skipped if dead or unconscious; `character` scope only; forced commit in turn mode; refusals recorded | `companion.ts:25-38` (CompanionOutput), `:41` HOLD_ACT_TEXT, `:96` runCompanionJob; prompt `prompts/companion.ts:17-32` (dm.companion-v2); contract `specs/031-dm-runtime/contracts/companions.md:7-54`; decision-0014 |
| C16 | Chronicle job (`dm.chronicle`) | Off the hot path after narration: up to 3 journal entries (public or dm), submitted as `journal` proposals; idempotent when nothing new | entry text, visibility, sourceActionIds | idempotence bound by last `chron-` entry; roster naming | `chronicle.ts:23-35` (ChronicleOutput), `:79` runChronicleJob; prompt `prompts/chronicle.ts:11-18` (dm.chronicle-v2) |
| C17 | Turn jobs, worker, runner | Postgres `jobs` queue, kinds turn / companion / chronicle; triggers commit / approval / npc-turn / scene-start / manual / reconcile; claim, lease, fencing; checkpoints director/interpret/adjudicate output; a held beat queues a companion job then a force-resolved turn | nothing | all | `jobs.ts:31-59`, `worker.ts:95`, `enqueue.ts:32`, `pipeline/runner.ts:26-223`; `docs/wiki/dm-turn-jobs.md`; decision-0016:35-37 |
| C18 | AI gateway + DM purposes | Seven purposes with default token caps (director 600, interpret 800, adjudicate 800, narrate 500, audit 300, chronicle 600, companion 400); model choice lives in config | n/a | n/a | `purposes.ts:7-45`; `pipeline/call.ts:157` callJson (max two attempts; second carries schema issues), `:231` callText; `docs/wiki/ai-gateway.md`; TASK-0106 notes: dm.narrate maxTokens raised 500 to 1500 in `.env` by operator approval |
| C19 | Doctrine module | 24 Rule/Wrong/Right pairs, each tagged with the nodes that render it; `renderDoctrine(node)` is placed in the node's system prompt under a 900-token cap (`CAPS.doctrine`) | n/a | selection by node tag | `doctrine.ts:14-20` (DoctrineNode), `:31-225` (DOCTRINE), `:228-237`; `prompts/common.ts:15-26` (CAPS), `:33-46` capEntries; attribution `doctrine/NOTICE.md:1-30` (MIT, tabletop-dm commit fe2c29b, Copyright (c) 2026 Brad Bush); contract `specs/031-dm-runtime/contracts/doctrine.md` |
| C20 | /dm routes | Operator-only: start scene (202 jobId), manual turn, list turns with audit record (never prompt text) | n/a | n/a | `apps/server/src/routes/dm.ts:118,189,197` |
| C21 | Playtest harness + playtest auditor (TASK-0048) | Scripted-dice playtest; an auditor agent checks transcript vs ledger and doctrine pair ids; finding kinds seen: player-agency, doctrine, dm-audit-flag, ledger-contradiction, hidden-info-leak, other | auditor model judgments | scripted dice and seat | NOT in this worktree's tree (`git ls-tree` shows no playtest source); card `backlog/tasks/task-0048 ...md` (To Do here); evidence reports in `specs/033-director-robustness/evidence/` and `specs/034-narration-quality/evidence/verify-*/report.md` (e.g. `verify-20261026T192319Z-.../report.md` F1 cites doctrine id `hero-is-theirs`) |

Component count: 21 (C1-C21). LLM-holding: C7, C8, C9, C12, C13 (via `dm.audit`), C15, C16, and the out-of-tree auditor C21. Engine, gate, log, assemble, resolve, facts builder, fallback hold no model.

Director legality table (CODE, `nodes/director.ts:104-227`; `director.md:47-56`): hold legal only in free mode, not on a forced job, with every named companion an AI companion in the party having no committed action this beat; `turn` legal only from free mode and for a seed encounter not yet run; `free` legal only from turn mode; tracker advance dropped if the tracker does not exist; scene `end` needs a scene; `companionPrompts` legal only in free mode for AI companions; scene-start keeps pacing only (`:122-155`).

### Data contracts carrying facts between components

| Contract | Producer -> consumer | Shape / fields | Cite |
|---|---|---|---|
| `LedgerRow` (roll / outcome / change) | gate and engine events -> facts builder, auditors | `roll`: seq, actor, visibility, reason, batchId, index, actionId, `roll: DiceRolledEvent`; `outcome`: AttackResolved / CheckResolved / RestCompleted; `change`: type, subject, before, after, batchId, index, actionId | `packages/session-model/src/projections/types.ts:143-` ; `projections/ledger.ts` |
| Engine events | engine -> log -> ledger | markers: dice.rolled, attack.resolved, check.resolved, rest.completed; state changes: hp.changed, life-state.changed, death-saves.changed, condition.applied/changed/removed, hit-dice.changed, spell-slots.changed, encounter.started/changed/ended, turn.advanced, combatant.added/removed | `packages/dnd5e-engine/src/schema/events.ts:61-234`; marker split `packages/session-model/src/catalog.ts:47-52` |
| `SessionProjections` (DM view) | log -> assemble, companion | scene, tableMode, party, encounter, journal, transcript, actions, ledger, trackers (dm only), engine, gate, proposals | `packages/session-model/src/projections/types.ts:209-`; `docs/wiki/session-model.md` |
| `BeatItem` / `AssembleOutput` | assemble -> all nodes | actionId, committedSeq, actor, characterId, scope (character/party), text, status; plus npcTurn, presentNpcIds, activeEncounterId, srdRecords, transcriptTail, priorSteps, rejections | `nodes/assemble.ts:22-52` |
| `DirectorOutput` / `DirectorNodeOutput` | director -> interpret, resolve, narrate | beat, tableMode, trackers, scene, pacing, goalNote, companionPrompts, plus `overrides` | `nodes/schemas.ts:196-249`; `nodes/director.ts:17-33` |
| `InterpretReading` / `Step` / `Effect` | interpret, adjudicate -> resolve | steps carry mechanics inputs only (no total or verdict field); check step: kind, ability, skill, `expression`, mode, `dc`, autoFail, onSuccess/onFailure; attack step: attackerId, targetId, `expression`, mode, `targetAc`, onHit; effects: damage / heal / condition | `nodes/schemas.ts:95-189` |
| `Ruling` | adjudicate -> resolve, narrate | actionId, ruling, improvised, citations | `nodes/adjudicate.ts:39-51` |
| `Submission` / `ResolveOutput` | resolve -> narrate, checkpoint | stepRef `<jobId>#<n>`, key, kind, result, refusal, batchId, proposalId, outcome; actionResults with outcome; appendedRows | `nodes/resolve.ts:31-79` |
| `NarrationFacts` | facts builder -> narrate, audit, fallback | trigger; actions[] (actionId, characterName, text, outcome applied/refused/no-effect, refusalCode, rolls, outcomes, changes); npcTurn; director {pacing, goalNote, sceneEnded}; modeChange; presentNpcs {name, voice, want, detail}; rulings; clarify; party {characterId, name, controller human/ai-companion}; npcNames; events; setting {locationName, openingFraming} | `facts.ts:90-119` |
| `FactRoll` / `FactChange` / `FactEvent` / `FactOutcome` | facts builder | roll: name, reason, expression, shown, total, against {AC/DC, value}, outcome (hit / miss / critical-hit / success / failure), autoFail, target; change: hp (damage/heal, amount, damageType, before, after), life-state (before, after), condition (applied/removed); event: encounter-started / encounter-ended / turn-advanced / combatant-joined / combatant-left | `facts.ts:21-70` |
| `PlayerSeedView` | seed -> narrate, companion (chronicle takes roster only) | title, goalStatement, location, openingFraming, npcs (name, role, voice, want, detail, appearance), characters (identity, portrayal, knows, relationships) | `seed/views.ts:1-23`; `player-facing-context.md:37-60` |
| `AuditIssue` / `RecordedIssue` / `AuditAttempt` / `AuditRecord` | audit -> `submitNarration`, `jobs.result`, /dm turns route | issue {kind, detail}; recorded adds `blocking`; attempt {attempt, words, deterministic, llm, proseSha256}; record {attempts, final passed / passed-after-regenerate / fallback, flagged, shippedProseSha256} | `nodes/audit.ts:50-53,69-71,145-164` |
| `CompanionOutput`, `ChronicleOutput` | companion and chronicle models -> gate | see C15, C16 | `companion.ts:25-38`; `chronicle.ts:23-35` |
| `TurnCheckpoint`, `TurnFailureResult` | runner -> `jobs.result` | checkpointed director/interpret/adjudicate output, submissions, lastSeq; failed-turn record with bounded model-output excerpts | `jobs.ts:82-116`; `docs/wiki/dm-failure-and-gates.md` |

### Engine-owned vs model-supplied (as the code stands)

- Engine owns (CODE): dice and RNG; nat 20 crit and nat 1 miss; total vs AC/DC; per-component resistance/immunity/vulnerability; crit damage doubling; HP and temp HP; life-state; death saves; conditions apply/remove; initiative and turn order; short/long rest; spell-slot bookkeeping (`docs/wiki/dnd5e-engine.md` "Entry point", "R8 ruling"; `packages/dnd5e-engine/src/schema/commands.ts`).
- Model supplies as data (interpret / adjudicate): the d20 expression including its modifier, the `dc`, the `targetAc`, roll mode, auto-fail reason, defenses, damage dice (`prompts/step-grammar.ts:22` "The expression carries the modifier you choose"; `specs/033-director-robustness/contracts/rules-terms.md:28`). Recorded gap: TASK-0104.
- Spells: no spell id in any output schema; `intent: "spell"` plays as model-written check, attack and effect steps (`rules-terms.md:27`; TASK-0105).
- Closed lists enforced by code: conditions (`nodes/schemas.ts:35-54`), skills (`:56-79`), abilities (`:24-33`), damage types (imported; `prompts/step-grammar.ts:25`), SRD citations and library quotes (`nodes/adjudicate.ts:55,77`).

## Doctrine as stated

Layers of stated doctrine:
- L-A: 24 pairs in `doctrine.ts`, rendered per node into system prompts (IDs P1-P24, file order).
- L-B: narrate-v3 RULES, `prompts/narrate.ts:20-33` (IDs N1-N12).
- L-C: audit-v2 statements, `prompts/audit.ts:27-33` (IDs A1-A5).
- L-D: other node system-prompt rules (IDs S1-S13).
- L-E: structural rules from decisions and specs (IDs X1-X20).
- L-F: deterministic audit checks, `nodes/audit.ts:190-301` (IDs K1-K9). These restate L-A/L-B rules as code.

A pair renders only to nodes in its `nodes:` field. Cap: `CAPS.doctrine` = 900 tokens, cut by whole entries from the end (`prompts/common.ts:15-26,33-46`; each builder calls `capEntries(renderDoctrine(node)..., CAPS.doctrine, "end")`).

### L-A. The 24 doctrine pairs (line = `id:` line in `doctrine.ts`)

| ID | Pair id | Rule (paraphrase) | Line | Nodes tagged | Enforced by |
|---|---|---|---|---|---|
| P1 | short-turns | Each turn about 100 words; never past 150 | 33 | narrate, audit | PROMPT (N2); AUDIT-DET K6 at 220 words (`audit-words.ts:66`; `audit.md:39` "doctrine target 100, ceiling 150, tolerance"); A4 tells `dm.audit` not to report length |
| P2 | end-on-demand | End on something that demands a response; wrong example "The hall is quiet. What do you do?" | 41 | narrate, audit | PROMPT (N12); AUDIT-LLM advisory `doctrine`; AUDIT-DET K7/K8 cover only the either-or ending and the clarify `?` |
| P3 | no-menus | Never hand the player a list or an either-or | 49 | narrate, audit, companion | PROMPT (N9, N12); AUDIT-DET K7 (bullet or number line; closing "A or B?") |
| P4 | stop-at-choice | Stop where the player must decide; do not narrate the hero through the door | 57 | narrate, audit | PROMPT; AUDIT-LLM advisory; overlaps P6/N5 |
| P5 | plain-prose | Story in plain prose; numbers on their own lines | 65 | narrate, audit | PROMPT (N2, N3); AUDIT-DET K2 (digits), K7 (list line); dice lines by CODE renderer (`facts.ts:297`) |
| P6 | hero-is-theirs | Never decide the hero's words, feelings or moves | 73 | narrate, audit, companion | PROMPT (N5, S9); AUDIT-LLM `player-agency` (A1), blocking only when detail names a party member (`nodes/audit.ts:123-143`) |
| P7 | world-not-hero | Narrate what the world did to the attempt, not the hero's inner state | 81 | narrate, audit | PROMPT; AUDIT-LLM (A1) |
| P8 | blame-the-situation | A failed roll is the world's doing, not the hero's incompetence | 89 | narrate | PROMPT only |
| P9 | roll-when-uncertain | Roll only when the outcome is uncertain and failure is interesting | 97 | interpret, director | PROMPT (also `prompts/interpret.ts:56`); CODE: `none` step exists; no check that `uncertain` matches a roll |
| P10 | fail-forward | A failure creates a new problem; never stalls the scene | 105 | narrate, interpret | PROMPT only; not tagged for director or audit; no deterministic check |
| P11 | trying-costs | Trying costs something: time, noise, a tracker segment | 113 | director, interpret | PROMPT; CODE only through tracker deltas (legalizeDirector) |
| P12 | ask-when-unclear | When intent is unclear, ask one short question | 121 | interpret | PROMPT (`prompts/interpret.ts:56`); CODE: `clarify` max 200 chars (`nodes/schemas.ts:177`), resolve marks it `no-effect` (`resolve.md:50`); AUDIT-DET K8 |
| P13 | yes-and | Treat a creative plan as an opportunity; set a DC rather than refuse | 129 | interpret, director | PROMPT; adjudicate route via `needsAdjudication` for "inventive" actions (`prompts/interpret.ts:56`) |
| P14 | npc-voice | Every named NPC has a voice, a want and one concrete detail | 137 | narrate, companion | PROMPT; DATA: seed NPC portrayal (`seed/schema.ts:35-41`), facts `presentNpcs` (`facts.ts:100-106`) |
| P15 | companion-opinions | Companions hold opinions, sometimes disagree, about once per scene | 145 | companion | PROMPT (also S10) |
| P16 | villains-believe | Antagonists have reasons and believe them | 153 | director, narrate | PROMPT; DATA: hidden motives live in NPC `hooks.secrets`, which no prompt reads (TASK-0107) |
| P17 | one-sense | One vivid non-sight detail per scene | 162 | narrate | PROMPT only; seed `location.portrayal.senses` (`seed/schema.ts:115`) |
| P18 | world-moves | The world moves on its own; show consequences | 170 | director | PROMPT; CODE: tracker advances, `pacing.tension` |
| P19 | dice-stand | Never change a result; soften hard outcomes through the story, at a cost | 178 | director, narrate | PROMPT; structural support X2 (facts are true and fixed) |
| P20 | warn-before-lethal | Signal danger before a deadly choice | 186 | director, narrate | PROMPT only |
| P21 | numbers-from-state | Every number comes from game state, never memory; write no digits in prose | 194 | narrate, audit | PROMPT (N3); AUDIT-DET K2; CODE renderer |
| P22 | one-clue | Reveal the hidden truth slowly; at most one real clue per beat | 202 | director | PROMPT only; DATA: seed beat `clues` with optional check (`seed/schema.ts:125-`) |
| P23 | content-pg13 | Default content: adventure violence, brief gore, no sexual content, no detailed cruelty | 210 | narrate, audit, companion | PROMPT; AUDIT-LLM advisory; no deterministic check |
| P24 | brief-rulings | Rule in one line, then return to the scene | 218 | narrate, interpret | PROMPT; adjudicate `ruling` is one line (`prompts/adjudicate.ts:19`); resolve writes a dm journal entry per ruling (`resolve.md:35-36`) |

### L-B. Narrate-v3 RULES (`prompts/narrate.ts`, PROMPT_VERSION `dm.narrate-v3` :18)

| ID | Rule (paraphrase) | Line | Enforced by |
|---|---|---|---|
| N1 | Facts are TRUE and decided by the engine; retell as story | 21 | PROMPT; X2 |
| N2 | Plain prose, ~100 words, max 150; no lists, headings, bold | 22 | PROMPT; AUDIT-DET K6 (220), K7 |
| N3 | Write NO digits; no totals, damage, HP, AC, difficulty; code appends dice lines | 23 | PROMPT; AUDIT-DET K2; CODE renderer |
| N4 | Never contradict a fact: a hit lands, a miss misses, a failure fails; do not invent rolls | 24 | PROMPT; AUDIT-DET K3-K5; AUDIT-LLM `ledger-mismatch` / `invented-mechanics` (blocking) |
| N5 | Party members (AI companions included) are player characters: never decide what one says, feels or chooses; may show a party member carrying out their declared action "in plain words, and nothing more"; never invent a companion's speech or state | 25 | PROMPT; AUDIT-LLM `player-agency` (A1), blocking if detail names a party member |
| N6 | Every other character is world: give them words, moves, reactions | 26 | PROMPT; A1 last sentence |
| N7 | "No rules effect" means nothing was rolled; the attempt still happens, show what the world does; never grant a hit, wound, condition, death or hidden discovery without a fact | 27 | PROMPT; facts render `no-effect` text (`prompts/narrate.ts:68-70`); AUDIT-LLM (A2) |
| N8 | (E3) When a foe's attack misses, its grab fails, or a party member succeeds on a save against it: describe only what the foe did; the party member "stays unchanged and unmoved: no wound, no dodge, no twisting free"; no wound on a party member without a damage fact | 28 | PROMPT only ("Code adds no detection", `specs/034-narration-quality/contracts/narration-facts.md:108`); AUDIT-LLM A2 may flag as `invented-mechanics` |
| N9 | Unclear intent: describe the moment, end with one short open question in the narrator's own words; never offer options | 29 | PROMPT; AUDIT-DET K8 |
| N10 | Cover every Event line | 30 | PROMPT only (K4 covers recorded death/down omission only) |
| N11 | Name a character dead or unconscious only when a fact says so; when a fact says so, say so | 31 | PROMPT; AUDIT-DET K4 |
| N12 | End on something that demands a response; no either-or ending | 32 | PROMPT; AUDIT-DET K7 |

### L-C. Audit-v2 statements (`prompts/audit.ts`, PROMPT_VERSION `dm.audit-v2` :9)

| ID | Statement | Line | Effect in code |
|---|---|---|---|
| A1 | `player-agency`: the prose decides what a PARTY member says, feels or chooses beyond their declared action; showing the declared action is allowed; words, moves and feelings of every other character are the world's, never `player-agency` | 29 | blocks only if issue detail names a party member: full name, characterId, or given name after a fixed title-word list (Brother, Sister, Father, Mother, Sir, Dame, Lord, Lady, Master, Mistress), whole-word, case-insensitive (`nodes/audit.ts:83-143`) |
| A2 | `invented-mechanics` / `ledger-mismatch`: prose grants a rules result no fact records (hit, wound, condition, death, success at an uncertain task, hidden discovery) or contradicts a fact; "no rules effect" = nothing rolled, attempt still happens, not a mismatch | 30 | blocking kinds (`nodes/audit.ts:74-78`) |
| A3 | When the facts ask a question, ending on that open question is correct | 31 | prompt only |
| A4 | Code checks length; do not report length | 32 | K6 |
| A5 | Craft concerns go under `doctrine`; advice, do not fail the narration | 33 | `doctrine` and `other` advisory (`nodes/audit.ts:73-80`; `audit-criteria.md:8-15`) |

### L-D. Other prompt-stated rules

| ID | Rule (paraphrase) | file:line | Node | Enforced by |
|---|---|---|---|---|
| S1 | Director decides pacing and structure for the next beat; never rolls or states a result; runs before dice | `prompts/director.ts:33` | director | PROMPT; pipeline order |
| S2 | Hold a beat only to give an AI companion a chance to speak first; otherwise resolve | `prompts/director.ts:34` | director | PROMPT + CODE (`nodes/director.ts:158-175`) |
| S3 | Move to turn mode only when a seed encounter's trigger has happened; return to free mode when an encounter is over | `prompts/director.ts:34` | director | PROMPT + CODE (`nodes/director.ts:176-193`) |
| S4 | End the scene only when the goal's success or failure condition is met or the party retreats | `prompts/director.ts:34` | director | PROMPT; CODE only requires a scene to exist |
| S5 | Advance a tracker only when its advance-when condition happened | `prompts/director.ts:34` | director | PROMPT; CODE checks tracker exists, delta -3..3 nonzero (`nodes/schemas.ts:217-232`) |
| S6 | `goalNote` is a private note for the narrator (<= 300 chars) | `prompts/director.ts:28`; `director.md:37` ("never shown verbatim") | director to narrate | PROMPT; narrate prompt prints "Private note: ${goalNote}" (`prompts/narrate.ts:173`); no code check against verbatim use |
| S7 | Interpret turns each declared action into mechanics inputs and never decides a result; one reading per beat item; monster turn reading has actionId null; roll only when uncertain and failure interesting; certain outcome = `none` step; `needsAdjudication` when rules unclear or action inventive; `clarify` when intent unclear | `prompts/interpret.ts:73,56` | interpret | PROMPT + CODE (`nodes/schemas.ts:180-188`) |
| S8 | Steps state mechanics inputs only; never a total, applied amount or success; a narrative outcome such as spotting, learning or noticing is narration, not an effect (leave onSuccess empty); closed condition / skill / damage-type lists | `prompts/step-grammar.ts:10-27` | interpret, adjudicate | PROMPT + CODE (enum gates; `rules-terms.md`) |
| S9 | Companion speaks and acts only for its own character; never for a human player's character; never states a dice result, total or success | `prompts/companion.ts:27` | companion | PROMPT + CODE (proposer is the companion; permission matrix) |
| S10 | Companion holds about one unprompted opinion per scene, sometimes disagrees; short, in voice | `prompts/companion.ts:28` | companion | PROMPT |
| S11 | Active companion in turn mode: "It is YOUR turn. You must act: set act with commit true" | `prompts/companion.ts:98` | companion | PROMPT + CODE (forced hold action `companion.ts:41`) |
| S12 | Adjudicate answers one rules question citing given text; never decides a result; a library quote must be verbatim; with no supporting text, rule from common sense and the ruling is marked improvised | `prompts/adjudicate.ts:46,20` | adjudicate | PROMPT + CODE (`verifyLibrary`, improvised flag) |
| S13 | Chronicle writes short factual entries, never states a dice total or invents events; one journal line at every scene change; names each new person and place once; facts the party has not learned go in a `dm` entry; at most three entries | `prompts/chronicle.ts:14-15` | chronicle | PROMPT + schema (max 3, visibility enum) |

### L-E. Structural and decision-level rules

| ID | Rule (paraphrase) | file:line | Enforced by |
|---|---|---|---|
| X1 | Script owns numbers, LLM owns story; refuse before write with specific codes | decision-0021:19-21; decision-0017:42-48 | CODE (engine, gate) |
| X2 | Ordering is the anti-cheat: dice resolve before narration; narrator receives results as facts; a fixed pipeline replaces "please do not invent rolls" prompting | decision-0017:42-48; `nodes/narrate.ts:20-26` | CODE (pipeline order, import-graph test) |
| X3 | Every LLM output is a typed proposal, never a direct write; policy auto / ask / suggest is the autonomy dial | decision-0015:15-26 | CODE (gate; write-boundary test; `throwingGate` for non-resolve nodes `pipeline/context.ts:150-160`) |
| X4 | Talk never changes state and never triggers a DM turn; the narrator may chime in as talk but cannot roll or move anything | decision-0016:17-19 | CODE (talk kind has no DM trigger); narrator chime-in code not found (no `chime` match in `apps/server/src`); TASK-0052 |
| X5 | Action lifecycle declared, discussed, committed, resolved; only a committed action reaches the pipeline; commit authority by table mode; party-scope actions need group sign-off | decision-0016:20-31 | CODE (`commitAuthority` in gate) |
| X6 | Nothing is cancelled: actions committed during a resolving turn queue into the next beat and resolve in log sequence order | decision-0016:35-37 | CODE (`jobs.ts` upsert; `resolve.md:38`) |
| X7 | The Director owns scene goal and end, secret trackers, free/turn mode switches and beat timing; not folded into interpret | decision-0018:15-22 | CODE (legality) + PROMPT |
| X8 | Companions are actors that declare and commit through the same gate as a human; First Scene seats one human plus AI companions | decision-0014:15-19 | CODE |
| X9 | Roll ledger: every roll logs a reason; every state change logs before and after | decision-0021:22 | CODE (engine events) |
| X10 | Secret trackers (named clocks hidden from players) are DM-only events | decision-0021:24; decision-0018:31; `catalog.ts:79` | CODE (visibility) |
| X11 | Rules with definitions must be deterministically defined and resolvable; the AI must not invent a condition without a gate rejecting it (operator requirement 2026-10-26, quoted in `rules-terms.md:8-10`) | `specs/033-director-robustness/contracts/rules-terms.md` | CODE (closed lists) for conditions, damage types, abilities, skills, SRD and library citations; not gated for spells, modifiers, DCs (G3, G4) |
| X12 | DM-only seed text never reaches a player-facing prompt (narrate, companion, chronicle); the Director still sees the full seed; authoring rule: a player-facing field never states or implies a DM-only fact | `player-facing-context.md:9-35`; `docs/wiki/dm-narration-quality.md` | CODE (PlayerSeedView) + test over assembled prompts (TASK-0106 AC #1) |
| X13 | A gate refusal never loops into a retry; it becomes a recorded result (except `CONFLICT`, retried twice) | `resolve.md:70-77`; `nodes/resolve.ts:29` | CODE |
| X14 | A mismatch never ships silently: regenerate up to 3 times, then ship the factual fallback and a dm journal flag | decision-0017:32-34; `audit.md:23`; `nodes/audit.ts:39,437` | CODE |
| X15 | Fallback prose is in-fiction, states every ledger change in the turn, holds no digit, system word or tracker name, passes `deterministicChecks` by construction | `docs/wiki/dm-narration-quality.md` section "Fallback"; `fallback.ts:39` | CODE (property test, TASK-0106 notes) |
| X16 | A dead or unconscious companion is skipped; companions declare only `character`-scope actions; in turn mode the active companion must act | `companions.md:19-20,45-49` | CODE |
| X17 | Doctrine adapted from tabletop-dm carries an MIT notice | `doctrine.ts:1-12`; `NOTICE.md`; decision-0021:44 | CODE (guard test `apps/server/test/dm/doctrine.test.ts`) |
| X18 | Parked, not adopted: Grit save house rule; fight budgeting with downed-target tables | decision-0021:30-31; TASK-0055 | none (no code) |
| X19 | Nodes are plain async functions; no LangGraph now, revisit on a named trigger | decision-0019; `docs/design/architecture.md` section "No LangGraph now"; TASK-0054 | CODE |
| X20 | Planning principle: no unplanned "for now" deferrals (a deferral needs a card) | decision-0020; applied at `rules-terms.md:30-32` | process |

### L-F. Deterministic audit checks (`nodes/audit.ts:190-301`), all blocking, all CODE

| ID | Check | Issue kind | Lines |
|---|---|---|---|
| K1 | Prose empty | doctrine | 199 |
| K2 | Any digit 0-9 in prose (detail does not quote the match; TASK-0111) | ledger-mismatch | 200-205 |
| K3 | Dice language (`audit-words.ts:7-8`) while the turn has no roll | invented-mechanics | 207-215 |
| K4 | Life-state: "dies / died / killed / slain / is dead / lies dead" with no death fact; "unconscious / knocked out / passes out / blacks out" with no down fact; or a recorded death or down that the prose omits | ledger-mismatch | 217-250 |
| K5 | Outcome words: for a single-outcome action, actor name followed within two words by the opposite word (lists `audit-words.ts:22-43`) | ledger-mismatch | 252-269 |
| K6 | Length over 220 words | doctrine | 271-274 |
| K7 | Option menu: list line, or closing "A or B?" (`audit-words.ts:62-64`) | doctrine | 275-285 |
| K8 | Clarify turn whose prose does not end with `?` | doctrine | 286-291 |
| K9 | Dice lines differ from the renderer's output (bug guard) | ledger-mismatch | 293-299 |

### Count

Stated rule entries by layer: 24 pairs (P) + 12 narrate rules (N) + 5 audit statements (A) + 13 other prompt rules (S) + 20 structural rules (X) + 9 deterministic checks (K) = 83. The N, A and K entries partly restate P entries (e.g. P3 = N9/N12 = K7; P6 = N5 = A1; P21 = N3 = K2). Distinct authored doctrine pairs: 24.

### Definitions stated in project text

| Term | Definition as stated | file:line |
|---|---|---|
| Player agency (`player-agency`) | Prose decides what a PARTY member says, feels or chooses beyond their declared action; carrying out the declared action is allowed; AI companions count as party; the audit issue blocks only when its detail names a party member | `prompts/audit.ts:29`; `audit-criteria.md:21-59`; `nodes/audit.ts:97-143` |
| No rules effect (`no-effect`) | Nothing was rolled and no game state changed; the attempt still happens in the story; never grant a hit, wound, condition, death or hidden discovery without a fact | `prompts/narrate.ts:27,68-70`; `specs/034-narration-quality/research.md:95-105` |
| On hold (clarify) | Intent unclear; nothing happened yet | `prompts/narrate.ts:65-67` |
| Party member vs world character | Party = every `facts.party` entry, human or AI companion; all others are "the world" | `audit-criteria.md:32-35`; `prompts/narrate.ts:117-129` |
| Blocking vs advisory issue | Deterministic: all block. `dm.audit`: ledger-mismatch, invented-mechanics block; player-agency blocks iff it names a party member; doctrine, other advisory | `audit-criteria.md:8-19`; `nodes/audit.ts:73-80` |
| Ordering is the anti-cheat | Dice resolve before narration; narrator receives results as facts | decision-0017:42-43 |
| Talk vs action | Talk never changes state or triggers a turn; action lifecycle declared / discussed / committed / resolved | decision-0016:15-22 |
| Secrets | Seed fields classed DM-only vs player-facing; chronicle puts facts the party has not learned in `dm` entries; trackers are DM-only events | `player-facing-context.md:15-35`; `prompts/chronicle.ts:15`; `catalog.ts:79` |
| Table modes | `free` (exploration, social) and `turn` (combat); Director switches; commit authority differs by mode | decision-0016:24-31; `nodes/director.ts:158-193` |
| Autonomy dial | policy auto / ask / suggest per proposal kind; AI seat = auto | decision-0015:15-23; `gate/policy.ts:12-24` |

### Topics with no stated rule found in the files read

Searched `doctrine.ts`, all `prompts/*.ts`, decisions 0012-0021, specs 031/033/034 contracts, `docs/design/architecture.md` DM sections. No stated rule found for: combat pacing beyond mode switching and tracker use; death-save narration beyond K4; rest and healing narration; travel, time, resources; NPC knowledge limits or lying; downtime; skill-challenge structure; contested checks PC vs NPC; group checks; circumstance-granted advantage (interpret may set `mode`, no rule says when); passive scores; stealth and surprise; morale beyond seed `morale` text and the Director's `goalNote` signal (`director.md:90-93`); retry of a failed check beyond P11; what a roll may decide involuntarily for a player character (see G1).

## Known gaps on record

| # | Gap | Where recorded | Status |
|---|---|---|---|
| G1 | Operator ruling on TASK-0113: narrate-v3 E3 and the audit-v2 player-agency definition are stricter than the operator's intent; involuntary effects derivable from the ledger should be allowed; player-agency should block only volitional acts (verbatim ruling below). Evidence: F1 scene-start hero move ("Tamsin Vale leads the way up from the bank"), F6 dodge on a recorded miss ("Tamsin twists just enough"), F7 companion Odo treated as a hero by the playtest auditor, seq 130 invented near-miss | `backlog/tasks/task-0113 ...md` (To Do, Low, m-3), ACs #1-#3; `specs/034-narration-quality/evidence/verify-20261026T192319Z-greyhollow-ford-provider/classification.md:43-49` | open |
| G2 | Playtest-auditor scope: whether `hero-is-theirs` applies to AI companions (F7); narrate and audit prompts treat companions as party | TASK-0113 AC #3; classification.md row F7 | open |
| G3 | Model-chosen modifiers, DCs and target AC: interpret and adjudicate emit a free `expression` (e.g. `1d20+3`), numeric `dc`, `targetAc`; the engine does not derive them from stats or an SRD DC table | TASK-0104 (To Do, Medium, m-3); `rules-terms.md:28`; `prompts/step-grammar.ts:22`; `nodes/schemas.ts:131,143` | open |
| G4 | Spells not gated: no spell id in any output schema; `intent: "spell"` plays as model-written steps | TASK-0105 (To Do, Medium, m-3, depends on TASK-0104); `rules-terms.md:27`; `docs/wiki/dm-failure-and-gates.md` | open |
| G5 | Parked combat rules undecided: Grit save, fight budgeting, downed-target table; to be judged from playtest evidence | decision-0021:30-31; TASK-0055 (To Do, Low, m-3, depends on TASK-0048) | open, trigger TASK-0048 |
| G6 | Director cannot read NPC secrets (Snag's motive moved to `hooks.secrets`; no prompt reads `hooks.secrets`); open question whether DM-side nodes read them via a DM-only view while `goalNote` cannot carry them to players | TASK-0107 (revisit, m-3, Low); `prompts/common.ts:64-90` (seedEntries has no secrets) | open, trigger on evidence |
| G7 | Director and interpret transcript lines render user ids, not character names (narrate and chronicle fixed) | TASK-0108 (revisit, m-3, Low) | open, trigger on evidence |
| G8 | Chronicle conflates distinct combatants ("a pot-helm goblin named Snag", journal row 176) | TASK-0109 (m-3, Medium) | open |
| G9 | An action whose own effect ends the encounter resolves `refused` afterward (rows 260-265); resolution order undocumented | TASK-0110 (m-3, Medium) | open |
| G10 | Digits check detail does not quote the match; source of digits in real-model prose unknown (3 of 4 non-seat fallbacks) | TASK-0111 (m-3, Medium); classification.md R1 | open |
| G11 | Scripted playtest seat declares actions for a downed (0 HP) hero; open question whether engine or gate should refuse an unconscious character's declared action before narration | TASK-0112 (m-3, Medium); classification.md R2 | open |
| G12 | A companion's declared-but-uncommitted action stalls the table; a human reaction does not re-run the companion; companion jobs run only after a DM turn ("prompt") or when a hold ends | TASK-0114 (m-3, High); `companion.ts`; `worker.ts:300` | open |
| G13 | Player-agency audit residual: issues naming a party member only in passing still block (4 of 13); closing-question complaints filed as `player-agency` still block (3 of 13); the "first-named character" alternative rule was not adopted | `audit-criteria.md:70-73`; `research.md:311-333` (R7.2); TASK-0106 notes ("Orchestrator rulings on the amendment's open points (1)") | recorded, not fixed |
| G14 | narrate-v3 E3 is prompt-only with no code detection; adherence not measured on a captured run | `narration-facts.md:108-115`; TASK-0113 AC #2 | open |
| G15 | Fallback-rate bar accepted at 20% (rerun 4/22 = 0.18) against the card's original 10% bar; hidden-info-leak 0, narration-caused ledger contradiction 0 | TASK-0106 notes "OPERATOR RULING 2026-10-26"; classification.md:9-15 | accepted by operator |
| G16 | R3: one invented near-miss with no miss fact (seq 130) | classification.md R3; TASK-0113 Evidence | open (folded into TASK-0113) |
| G17 | Narrator chime-in to table talk not implemented (decision-0016 allows it); trigger and rate rules carded | TASK-0052 (m-3, depends on TASK-0048) | open |
| G18 | Legacy uncatalogued WebSocket send path still exists | TASK-0099 (m-3) | open (not DM doctrine) |
| G19 | Codex not wired: assemble reads a seed, not codex neighbours; chronicle writes no codex updates | TASK-0060 (m-4); decision-0017:55-56 | planned |
| G20 | LangGraph revisit trigger: second agent graph, or dynamic routing among more than two branches or a cycle | decision-0019; TASK-0054; `docs/design/architecture.md` | planned |
| G21 | Doctrine thinness as a class: TASK-0115 states every M2 narration-quality problem traced to thin doctrine definitions (player agency, fail-forward, "no effect", what a roll may decide); research in progress, no doctrine or prompt change in its scope | `backlog/tasks/task-0115 ...md` Description (In Progress) | in progress |
| G22 | Pairs and rules whose only enforcement in the files read is prompt text: P8, P10, P14 (beyond data fields), P15, P16, P17, P19, P20, P22, P23, N8, N10 | cross-check of Section 2 "Enforced by" columns | observation from this inventory, not a card |
| G23 | Contract-versus-code wording drift: `doctrine.md:79` `villains-believe` right example names goblins and the bell; `doctrine.ts:157-158` names bandits and the lord's toll (034 amended it to remove a leak) | `specs/031-dm-runtime/contracts/doctrine.md:79` vs `doctrine.ts:153-160`; `player-facing-context.md:5` | resolved by 034 amendment |
| G24 | 031 `audit.md:63-64` says a `doctrine`/`other`-only fail still fails an attempt; superseded by 034 (advisory) | `audit.md:63-66` vs `audit-criteria.md:8-15` | superseded (Amended-by marker present) |

### TASK-0113 operator ruling, verbatim (`backlog/tasks/task-0113 ...md`, Implementation Notes)

> OPERATOR RULING 2026-10-26 (during the M2 demo), in the operator's words: 'It makes perfect sense for the DM to narrate the reaction of a character in combat *after* being hit, or missing, etc. As long as that description is not something that takes away *choices* from the player. Saying "You get hit by a big club and it staggers you back a step" is fine if the roll makes sense (critical hit, for example) -- the player has no agency there, it happened, they got staggered back a step. Or even "You are surprised by this and it shows on your face" -- that's another one that a roll could decide, it's reflexive. But, you don't want "You see your long long love and run to meet her" -- that's a decision for the player and it is not something a DM roll could account for. ... Actions occur -> Evaluate for potential roll-able side-effects (reactions, reflexes, etc) -> Narration suggestion -> Evaluation (do not take away agency) -> loop until accepted'.
>
> Consequences, stated by the orchestrator: (1) TASK-0106's narrate-v3 rule E3 ('unchanged and unmoved: no wound, no dodge') and audit-v2's player-agency definition are stricter than the ruling and must be revised. (2) Proposed shape: code derives the allowed involuntary effects from the ledger (critical hit, damage share of max HP, a failed save's effect) as facts for both the narrator and the auditor. player-agency blocks only volitional acts (movement with intent, speech, decisions, chosen emotional responses). The existing narrate, audit and regenerate loop (3 attempts) stays. (3) Scope this card as a spec (doctrine change), not a patch.

### Evidence classification on record (TASK-0106 / spec 034)

- Run 5 (`20261026T171359Z-greyhollow-ford-provider`): 23 of 39 narrated turns fell back; 184 audit issues classified: 68 auditor error, 27 narrator, 85 craft, 4 unverifiable. Selected causes: A1 party not named, A2 no-effect undefined, A3 clarify relayed as option menu, A4 LLM doctrine/other issues block (TASK-0106 notes; `specs/034-narration-quality/research.md:54-79,84-140`). Hand labels include NPC, DECL, NOEFFECT, MISFILED, CONFUSED for `player-agency` (`research.md:54`).
- Verify 1 (`20261026T183818Z`): fallback 12/34 (0.35); E1 narrate maxTokens cap, E2 `dm.audit` flags world NPCs as player-agency, E3 narrator wounds or moves the hero on a foe's failed attack (`research.md:293-340`).
- Verify 2 (`20261026T192319Z`): fallback 4/22 (0.18), 0 leaks, 0 narration-caused contradictions, 3 playtest-auditor player-agency fails (F1, F6, F7); causes R1 digits, R2 seat acts for a downed hero, R3 invented near-miss (`classification.md:9-49`).

## Commit pin

`git rev-parse HEAD` at start of read: `dd2e5eb1e284614e4a3f6dc145bb7388502bd9e9`.
`git rev-parse HEAD` at end of read: `e91c994023b9e3587518c2c67b98a0ad26be30c8` (one commit later, "Update task TASK-0115"; `git diff --stat dd2e5eb HEAD` touches only the TASK-0115 card, so all code, spec and doctrine citations above hold at both pins). Branch `claude/agitated-goldberg-bff213`. Wiki notes carry their own pins (`dm-runtime`, `dm-narration-quality` verified against `4af42bef...`; `dnd5e-engine` `c4249350...`; `proposal-gate` `49c7de2b...`); line citations were taken from the working files, not the wiki.

## Grounding

- [[_grounding]] — method and sources (project inventory pass)
- [[DM-Craft-Map]] — the branch entry
