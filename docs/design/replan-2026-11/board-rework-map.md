# Board rework map

**Replan 2026-11, Synthesis.** Date 2026-11-07. Applied at checkpoint **CP-3** ([plan-of-action.md](plan-of-action.md) §7), on branch `replan-2026-11` only, through the `backlog` CLI.
**Covers:** all 135 open cards in [research/board-inventory-a.md](research/board-inventory-a.md) (76) and [research/board-inventory-b.md](research/board-inventory-b.md) (59).
**Milestones:** `r-1` R1 Fast Table, `r-2` R2 Living Codex, `r-3` R3 Human Table, `r-4` R4 Notebook, `r-5` R5 The Board, `r-6` R6 Generators, `r-7` R7 Campaign Memory, `r-8` R8 Release 1.0, `later` (deferred, trigger-gated).
**Workstreams:** labels from plan-of-action §3 (`ws:intent`, `ws:space`, …).

## Actions

| Action | Meaning | CLI effect |
|---|---|---|
| keep | Card stands as written. | Set milestone and workstream label. |
| rewrite | Outcome stands; description and acceptance criteria change to the new contracts. | Edit description and AC; set milestone. |
| merge-into-X | Scope moves into card X. | Append a note on X citing this card; archive this card with "merged into X". |
| re-home | Card stands; only its milestone or workstream changes materially. | Set milestone and label. |
| close-stale | Evidence or time made it moot. | Archive with the reason. |
| close-superseded | A new contract or decision removes the need. | Archive with "superseded by X". |
| defer | Valid, not on the V1 path. | Milestone `later`; keep or add a trigger line. |

## 1. Every open card

| id | action | new milestone / workstream | reason |
|---|---|---|---|
| 0031 | close-stale | — | M1 closed in practice; retrieval demo superseded by the table. |
| 0035 | defer | later / ws:platform | Trigger: a self-hoster's embedding model is not 1024-dim. |
| 0037 | keep | r-1 / ws:platform | Dev runbook names the wrong directory. |
| 0038 | defer | later / ws:platform | Library management; no goal needs it before 1.0. Trigger: second imported book. |
| 0039 | defer | later / ws:platform | Rules-chat history; `ask_dm` covers the table. Trigger: operator asks. |
| 0053 | rewrite | r-3 / ws:dm-console | R3 demo: same adventure, AI DM then human DM in the console, sheet and channels in use. |
| 0054 | close-superseded | — | P-18: no LangGraph. |
| 0056 | rewrite | r-2 / ws:codex | `@stacks/codex-model` per P-10; absorbs 0202. Frozen at CP-6. |
| 0057 | keep | r-2 / ws:codex | Storage, versions, typed links, CRUD API. |
| 0058 | rewrite | r-2 / ws:codex | PC as codex entity over the engine; absorbs 0241 (pronouns). |
| 0059 | rewrite | r-4 / ws:notebook | Becomes the notebook shell: tree, entity page, `@` links, backlinks, search. |
| 0060 | rewrite | r-2 / ws:codex | `compile()` replaces seeds; delete seed files and loader; absorbs 0107, 0108. |
| 0061 | rewrite | r-6 / ws:generators | NPC generator on the N-28 framework. |
| 0062 | rewrite | r-6 / ws:generators | Encounter generator on N-28; 2024 DMG budget; prepared encounter is the combat record. |
| 0063 | rewrite | r-4 / ws:notebook | R4 demo: co-authored 5-location adventure played by the AI DM. |
| 0064 | defer | later / ws:engine | P-21. Trigger: SRD monster list blocks a generator or playtest. |
| 0065 | defer | later / ws:engine | P-21. Same trigger. |
| 0066 | defer | later / ws:engine | P-21. Same trigger. |
| 0067 | defer | later / ws:engine | P-21. Same trigger. |
| 0068 | rewrite | r-5 / ws:board | `map` entity + MapPlan contract mapped onto zones; the map-planner agent moves to N-29. |
| 0069 | keep | r-5 / ws:board | Deterministic tile renderer, CC0 pack. |
| 0070 | rewrite | r-5 / ws:board | Board V1 per P-03/P-05: grid, tokens, draft gestures, ruler, room fog; absorbs 0239. |
| 0071 | keep | r-6 / ws:board | AI DM drives tokens and fog through DM-control Intents. |
| 0072 | defer | later / ws:board | P-07 trigger; review at CP-15. |
| 0073 | keep | r-8 / ws:board | UVTT export. |
| 0074 | keep | r-8 / ws:notebook | Obsidian vault export. |
| 0075 | defer | later / ws:notebook | Portraits; no goal needs them for 1.0. |
| 0076 | rewrite | r-5 / ws:board | R5 demo: cave fight on board and in text at once. |
| 0077 | keep | r-3 / ws:dm-console | Per-kind autonomy settings. |
| 0078 | rewrite | r-3 / ws:dm-console | Proposal rows inbox (Accept / Edit inline / Reject / Narrate my own). Design round at CP-8. |
| 0079 | keep | r-6 / ws:generators | Generators callable mid-session. |
| 0080 | keep | r-8 / ws:platform | Self-host docs and quickstart. |
| 0081 | re-home | r-4 / ws:platform | Backup, restore, migrations needed once campaigns hold authored content. |
| 0082 | keep | r-8 / ws:platform | Tag, README, demo video. |
| 0083 | rewrite | r-7 / ws:memory | Campaign summaries as projections inside a token budget, over N-15 snapshots. |
| 0084 | rewrite | r-7 / ws:memory | Session continuity: recap, carry-over, chronicle write-back drafts; absorbs 0109. |
| 0085 | keep | r-7 / ws:memory | Director pacing over open threads. |
| 0086 | keep | r-7 / ws:memory | R7 demo. |
| 0087 | close-superseded | — | This replan re-plans M9. |
| 0088 | keep | r-7 / ws:generators | Campaign from a premise, chaining generators. |
| 0089 | keep | r-7 / ws:dm-console | Assisted fallback on low confidence. |
| 0090 | keep | r-8 / ws:tooling | Multi-session auditor. |
| 0091 | keep | r-8 / ws:memory | Solo campaign end-to-end demo; 1.0 playtest gate. |
| 0092 | re-home | r-6 / ws:engine | Magic items feed the loot generator. |
| 0093 | re-home | r-3 / ws:engine | Species, backgrounds, feats gate character creation (N-18). |
| 0094 | defer | later / ws:engine | Glossary; trigger: a "why" expansion needs a missing entry. Absorbs 0137. |
| 0097 | keep | r-3 / ws:table-ux | Narrow-screen About/Settings. |
| 0098 | keep | r-1 / ws:platform | Unmigrated DB on env:up. |
| 0101 | keep | r-1 / ws:platform | Hosted dev parity for R1 latency playtest. |
| 0103 | keep | r-3 / ws:platform | Password recovery for strangers. |
| 0107 | merge-into-0060 | r-2 | `compile()` DM view feeds DM-side nodes. |
| 0108 | merge-into-0060 | r-2 | Names come from entities in the compiled context. |
| 0109 | merge-into-0084 | r-7 | Chronicle keys entries on entity ids. |
| 0111 | close-superseded | — | N-07: digits are code-rendered; no digit audit. |
| 0120 | keep | r-7 / ws:memory | Research: exploration, awareness, time. |
| 0121 | keep | r-3 / ws:table-ux | Research: table contract; feeds N-21. |
| 0122 | keep | r-3 / ws:engine | Research: running combat (morale, tactics). |
| 0124 | keep | r-6 / ws:generators | Research: encounter/adventure design. |
| 0125 | keep | r-7 / ws:memory | Research: tone and horror doctrine. |
| 0126 | keep | r-6 / ws:generators | Research: rewards and house rules; feeds N-30. |
| 0129 | close-superseded | — | N-16 channels (`@dm`, `((`). |
| 0130 | rewrite | r-1 / ws:narration | Doctrine pass against the planner and fact sheet, not the audit. |
| 0131 | close-superseded | — | N-16 channels. |
| 0132 | merge-into-0247 | r-1 | Progress indicator between fact rows and narration. |
| 0133 | merge-into-0247 | r-1 | Roll rows render before prose. |
| 0136 | defer | later / ws:platform | Trigger: multi-process deployment. |
| 0137 | merge-into-0094 | later | Same glossary scope. |
| 0138 | keep | r-1 / ws:tooling | Integration suite skips without DB. |
| 0139 | merge-into-N-05 | r-1 | Positions and range are the zone model. |
| 0144 | close-superseded | — | N-07 retires the prose claim gate. |
| 0145 | close-superseded | — | N-02: legality lives in the planner. |
| 0146 | close-superseded | — | N-07: audit shrinks to leak/contradiction over the fact sheet. |
| 0147 | close-superseded | — | N-02: planner owns batch legality. |
| 0148 | rewrite | r-2 / ws:codex | Info ids become codex clue/secret ids; `info.revealed` generalised per P-10. |
| 0149 | keep | r-2 / ws:memory | NPC attitude as typed state. |
| 0150 | keep | r-3 / ws:engine | Influence as an engine shape. |
| 0151 | rewrite | r-6 / ws:notebook | Quest entity with clue graph and Three Clue lint. |
| 0152 | keep | r-2 / ws:narration | NPC doctrine pass. |
| 0153 | merge-into-N-15 | r-2 | Exact S0 comes from snapshots. |
| 0155 | defer | later / ws:tooling | Trigger stays: debug page load time. |
| 0156 | close-superseded | — | N-02 removes the resolve-order path. |
| 0160 | defer | later / ws:tooling | Trigger stays: second flake. |
| 0162 | merge-into-0247 | r-1 | Composer keeps draft until echo. |
| 0166 | merge-into-N-19 | r-3 | Improvise a scene in the console. |
| 0169 | merge-into-0247 | r-1 | Roll rows name check and mode. |
| 0172 | keep | r-2 / ws:memory | Knowledge ledger. |
| 0173 | keep | r-2 / ws:memory | NPCs learn what they are told. |
| 0174 | close-superseded | — | N-07 retires the lexical claim gate. |
| 0178 | keep | r-3 / ws:dm-console | Seat return settles pending proposals. |
| 0179 | keep | r-3 / ws:dm-console | Seat an absent account as DM. |
| 0183 | close-superseded | — | N-02: one Intent, one plan. |
| 0186 | keep | r-1 / ws:tooling | Playtest-run skill; absorbs 0196, 0235. |
| 0187 | merge-into-0247 | r-1 | Column width. |
| 0190 | merge-into-0247 | r-1 | Dialogue rows. |
| 0196 | merge-into-0186 | r-1 | Cost estimate. |
| 0197 | merge-into-N-08 | r-1 | Truncation observability. |
| 0198 | merge-into-N-14 | r-2 | Table list reads session records. |
| 0199 | rewrite | r-1 / ws:table-ux | Quiet ring for exploration only (P-04), on the Intent `declared` state; amend spec 066. |
| 0200 | close-superseded | — | 0245: roll lines are code rows; no fallback path. |
| 0201 | merge-into-N-06 | r-1 | Objects are zone features and targets. |
| 0202 | merge-into-0056 | r-2 | Starting conditions are NPC/encounter payload. |
| 0203 | merge-into-N-08 | r-1 | Structured output; keep log shapes as fixtures. |
| 0215 | keep | r-1 / ws:engine | Surprise at encounter start. |
| 0216 | close-superseded | — | N-07: arrivals are facts on the fact sheet. |
| 0217 | keep | r-3 / ws:engine | Hide as engine state. |
| 0218 | merge-into-N-11 | r-1 | OA offer is the reaction row. |
| 0219 | keep | r-3 / ws:engine | Spell reactions through the reaction row. |
| 0220 | close-superseded | — | N-02: no held cut plans. |
| 0221 | close-superseded | — | N-07. |
| 0222 | keep | r-1 / ws:engine | Auto-fail saves, auto-crit. |
| 0223 | keep | r-1 / ws:engine | Engine owns roll steps and amounts. |
| 0224 | keep | r-1 / ws:engine | Monster DCs from stat blocks. |
| 0225 | keep | r-3 / ws:engine | Class-feature damage over PC sheets. |
| 0226 | keep | r-3 / ws:engine | Bless, Guidance. |
| 0227 | keep | r-3 / ws:engine | Area spells; now depends on N-05. |
| 0228 | keep | r-3 / ws:engine | Repeat saves. |
| 0229 | keep | r-3 / ws:engine | Roll riders. |
| 0230 | keep | r-3 / ws:engine | Monster spellcasting. |
| 0231 | keep | r-1 / ws:tooling | Wiki notes over size budget. |
| 0232 | defer | later / ws:engine | Group checks; low value. Trigger: table-rules settings UI. |
| 0233 | close-superseded | — | N-07. |
| 0235 | merge-into-0186 | r-1 | Playtest skill scenarios. |
| 0239 | merge-into-0070 | r-5 | Click-to-draft board. |
| 0241 | merge-into-0058 | r-2 | Pronouns on the PC entity. |
| 0243 | merge-into-0247 | r-1 | Show both d20s. |
| 0245 | rewrite | r-1 / ws:narration | Fact sheet, code-rendered fact rows and State line, four-part template. |
| 0247 | rewrite | r-1 / ws:table-ux | Stream and composer emit Intent pills; absorbs 0132, 0133, 0162, 0169, 0187, 0190, 0243; amend spec 091. |
| 0248 | merge-into-N-10 | r-1 | Turn ownership is one rule in combat mode. |
| 0249 | close-stale | — | B2 playtest ruled "keep defaults". |
| 0252 | merge-into-N-12 | r-1 | Life state chips. |
| 0253 | merge-into-N-09 | r-1 | Encounter resume. |
| 0254 | merge-into-N-09 | r-1 | Fled combatant leaves the order. |
| 0255 | close-superseded | — | 0245: the death is a code fact row. |
| 0256 | merge-into-N-08 | r-1 | Interpret truncation. |
| 0257 | close-superseded | — | 0245: a no-roll check renders a code fact row. |

### Counts

| Action | Count |
|---|---|
| keep | 48 |
| rewrite | 20 |
| merge-into-X | 29 |
| re-home | 3 |
| close-stale | 2 |
| close-superseded | 19 |
| defer | 14 |
| **Total** | **135** |

## 2. New cards

Thirty-two deliverable cards (N-01…N-32) and eight epics (EP-1…EP-8). Each deliverable is sized for one PR. Per P-16, R1 and R2 cards carry full acceptance criteria; R3–R8 criteria are refined at their milestone's planning.

### Epics

| Id | Title | Milestone | Children |
|---|---|---|---|
| EP-1 | R1 Fast Table | r-1 | N-01–N-13, 0037, 0098, 0101, 0130, 0138, 0186, 0199, 0215, 0222–0224, 0231, 0245, 0247 |
| EP-2 | R2 Living Codex | r-2 | N-14, N-15, 0056–0058, 0060, 0148, 0149, 0152, 0172, 0173 |
| EP-3 | R3 Human Table | r-3 | N-16–N-21, 0053, 0077, 0078, 0093, 0097, 0103, 0121, 0122, 0150, 0178, 0179, 0217, 0219, 0225–0230 |
| EP-4 | R4 Notebook | r-4 | N-22–N-25, 0059, 0063, 0081 |
| EP-5 | R5 The Board | r-5 | N-26, N-27, 0068–0070, 0076 |
| EP-6 | R6 Generators | r-6 | N-28–N-30, 0061, 0062, 0071, 0079, 0092, 0124, 0126, 0151 |
| EP-7 | R7 Campaign Memory | r-7 | N-31, 0083–0086, 0088, 0089, 0120, 0125 |
| EP-8 | R8 Release 1.0 | r-8 | N-32, 0073, 0074, 0080, 0082, 0090, 0091 |

Each epic's description states the milestone demo and exit criteria from plan-of-action §5. Epics get no PR.

### R1 — Fast Table

**N-01 — Intent contract package** · ws:intent · r-1 · deps: CP-1
Create `packages/intent` with the Intent schema, commit states and every core kind from target-architecture §2. Each kind has a Zod params schema and a text form. Slash grammar parses to Intents and back. This contract freezes at CP-4; every surface lane builds on it.
- AC1: Every kind in target-architecture §2 has a params schema and a fixture.
- AC2: `parse(toText(i))` round-trips for every fixture.
- AC3: A decision record freezes the schema with `INTENT_SCHEMA_VERSION = 1`.
- AC4: Boundary lint forbids imports from apps into the package.

**N-02 — Deterministic planner** · ws:intent · r-1 · deps: N-01, N-05
Create `packages/planner` with `plan(state, space, intent)` returning commands, a refusal, or a ruling request. Port the deterministic half of `dm/nodes/resolve.ts` and `dm/gates/plan-gate.ts`. Cover checks, saves, contests, attacks, the six engine spells, dash, dodge, disengage, help, hide, move and resource kinds.
- AC1: The planner makes no model call and no I/O (boundary lint).
- AC2: Golden tests cover each supported kind, each refusal code and each ruling request.
- AC3: Legality checks from TASK-0145 and TASK-0147 pass as planner tests.
- AC4: `resolve.ts` loses the ported code paths.

**N-03 — Gate accepts Intents** · ws:intent · r-1 · deps: N-01, N-02
Add the `intent` request kind to `gate/proposals.ts`. The gate checks seat, turn and policy, calls the planner, runs the engine and appends. `action.declare` becomes the `declared` envelope of an `attempt` Intent. DM-control Intents require the DM seat.
- AC1: A confirmed `attack` Intent from a player appends engine events with no model call.
- AC2: A `needs_ruling` result enqueues a ruling job (AI seat) or a proposal row (human seat).
- AC3: Existing `action.declare` clients keep working through the envelope.

**N-04 — Interpret emits Intents** · ws:intent · r-1 · deps: N-01, N-03
Change `dm.interpret` to output Intents through structured output. Slash-form text bypasses the model. Ambiguous text returns a clarify question.
- AC1: Slash commands produce Intents with zero model calls.
- AC2: Interpret output validates against the Intent schema on attempt 1 in ≥ 99% of the playtest corpus.
- AC3: A compound declaration yields one Intent per stage, each planned in turn.

**N-05 — Space package and zones in the engine** · ws:space · r-1 · deps: CP-1
Create `packages/space` with zones, edges, range bands, and reach checks. Add `placement` to engine combatants and a `move` command. Absorbs TASK-0139.
- AC1: Engine `move` refuses blocked edges and over-speed moves.
- AC2: Reach and range checks use bands without a grid.
- AC3: Golden-dice tests cover OA triggers from leaving an engaged band.
- AC4: The package has no renderer or React dependency.

**N-06 — Spatial events and per-viewer projection** · ws:space · r-1 · deps: N-05
Add `space.defined`, `actor.placed`, `actor.moved`, `zone.revealed` to the catalog. Fold them into a per-viewer space projection. Add space facts (zone, distance band, reach) to the AI turn context. Scenes declare zones and objects as zone features. Absorbs TASK-0201.
- AC1: A player projection never contains an unrevealed zone or hidden placement.
- AC2: The AI context lists each actor's zone and who is in reach.
- AC3: A door or post is a valid Intent target.

**N-07 — Narration as prose slots; retire the audit loop** · ws:narration · r-1 · deps: 0245, N-08
The narrator fills restate, describe and ask slots from the fact sheet. Delete regenerate-then-fallback. Replace the audit with a code leak check (unrevealed ids) and a contradiction check against facts. A failed check appends a correction row and never blocks play.
- AC1: No narration path regenerates for audit reasons.
- AC2: Narration writes no digits; fact rows carry every number.
- AC3: The R1 playtest shows zero fallback lines.
- AC4: `dm/claims.ts` lexical gate is deleted.

**N-08 — Structured output in the gateway** · ws:narration · r-1 · deps: CP-1
Add a structured-output mode (tool call or JSON schema) per purpose in `apps/server/src/ai`. Log truncation separately from invalid JSON. Absorbs TASK-0203, 0256, 0197.
- AC1: Each DM purpose declares its output schema in config.
- AC2: Attempt-1 schema failures are under 1% over the R1 playtest.
- AC3: The playtest watch shows a `truncated=` count.
- AC4: The vm-104 log shapes from TASK-0203 are regression fixtures.

**N-09 — Encounter state machine** · ws:engine · r-1 · deps: N-05
Make the encounter a live engine state: start, join, leave, flee, end and resume. Absorbs TASK-0253, 0254.
- AC1: A fight ended by truce resumes with a fresh turn order when broken.
- AC2: A fled combatant leaves the order and its zone.
- AC3: Joining mid-fight rolls initiative for the newcomer only.

**N-10 — Combat turn UX** · ws:table-ux · r-1 · deps: N-01, N-09
Show the turn banner with round and economy pips. Show the action bar filtered to what is legal now. In combat, the active player's Enter commits the Intent (P-04). Off-turn Intents from humans are refused with a reason. Absorbs TASK-0248.
- AC1: Pips drain as Intents resolve.
- AC2: The action bar shows only legal actions for the active actor.
- AC3: An off-turn human action is refused with a visible reason.

**N-11 — Reactions and roll requests** · ws:table-ux · r-1 · deps: N-03, N-10
Add a reaction policy per reaction (Ask/Auto/Off). Show an inline reaction row to its owner only, with an extendable countdown. Show roll-request rows addressed to the right roller. Absorbs TASK-0218.
- AC1: An OA trigger pauses the turn and shows the row to that player only.
- AC2: Timeout defaults to "let it go"; the timer extends per user.
- AC3: Only the addressed player can answer a roll request.

**N-12 — Targeting, life state and zone chips** · ws:table-ux · r-1 · deps: N-06
`@` targeting lists in-range targets by distance with an HP word. Margin shows life state, conditions with duration, death-save slots, and zone chips that draft moves. Absorbs TASK-0252.
- AC1: Dead, down and stable are visible as words and colour.
- AC2: Clicking a zone chip drafts a `move` pill.
- AC3: Targets out of reach are marked, not hidden.

**N-13 — R1 playtest scenario and latency metrics** · ws:tooling · r-1 · deps: N-07, N-10
Write the R1 combat scenario (four PCs, four goblins, zones). Add latency metrics to the auditor: Intent-to-fact-row p95, first narration token p50, round wall time.
- AC1: The auditor reports the three latency metrics.
- AC2: The scenario runs hosted under the playtest-run skill.

### R2 — Living Codex

**N-14 — Campaign, table and session records** · ws:codex · r-2 · deps: 0056
Add `campaigns`, `tables`, `sessions` tables. A session covers a seq range. `routes/tables.ts` reads the records. Absorbs TASK-0198.
- AC1: "Your campaigns" lists campaigns and their tables without scanning events.
- AC2: Closing a session records its seq range.
- AC3: Existing tables migrate into records.

**N-15 — Projection snapshots** · ws:memory · r-2 · deps: N-14
Checkpoint `SessionProjections` every N events and at session close. Gate, ws subscribe and the browser load from the latest snapshot. Absorbs TASK-0153.
- AC1: Gate load time is flat across a 5 000-event session.
- AC2: Snapshot + tail fold equals a full fold (property test).
- AC3: The pre-turn snapshot is exact across a reclaimed turn.

### R3 — Human Table

**N-16 — Communication channels** · ws:table-ux · r-3 · deps: N-01
Ship six channels: in-character, address NPC, emote, ask DM, table talk, whisper. Table talk and whispers are filtered on the server. The channel chip keeps "talking to" memory.
- AC1: Table talk never reaches the narrator or NPC context (test).
- AC2: A whisper reaches only its recipients.

**N-17 — Sheet drawer** · ws:sheet · r-3 · deps: N-01, 0058, CP-8
Build the sheet drawer as an action surface with Actions, Spells, Inventory, Features, Notes tabs. Every rollable number drafts an Intent pill. The composer stays visible. Design round first (CP-8).
- AC1: Clicking a weapon drafts an `attack` pill with weapon filled.
- AC2: Works at 1280 px and as a bottom sheet at 390 px.

**N-18 — Character creation** · ws:sheet · r-3 · deps: 0058, 0093
Create a PC from SRD 5.2.1: species, background, class, ability scores, levels 1–3. Inline steps, no modal.
- AC1: A new player creates a valid level-1 PC in under 10 minutes.
- AC2: The PC is a codex entity with engine-computed mechanics.

**N-19 — DM console** · ws:dm-console · r-3 · deps: N-03, 0060, CP-8
Build the human-DM view: DM-control Intents (narrate, speak as NPC, request roll, set DC, apply damage/condition, start/end combat, reveal), DM notes slide-out over the compiled scene, secret rolls, and improvising a scene with no prepared content. Absorbs TASK-0166.
- AC1: A human DM runs a full combat using only console controls.
- AC2: DM notes show the compiled scene context.

**N-20 — Player onboarding** · ws:platform · r-3 · deps: N-14, N-18
Invite link → account → create or pick a character → lobby → table.
- AC1: A new player reaches a seated character with no operator help.

**N-21 — Session zero and safety tools** · ws:table-ux · r-3 · deps: N-14, 0121
Record content limits, lines and veils, and spotlight preferences per table. The narrator reads them as constraints. Players can pause the table from the composer.
- AC1: Content limits appear in the narrator's fact sheet.
- AC2: Any player can pause the table.

### R4 — Notebook

**N-22 — Schema-driven editors and readiness lint** · ws:notebook · r-4 · deps: 0059
Generate editors from codex-model schemas for npc, location, encounter, item, clue, quest. A readiness lint blocks "ready for play", never saving.
- AC1: Every MVP kind has an editor.
- AC2: An incomplete NPC saves but cannot be marked ready.

**N-23 — Block visibility and reveal from the notebook** · ws:notebook · r-4 · deps: 0059, 0148
Set visibility per block. "View as player" shows the reveal fold. One-click reveal appends `info.revealed`.
- AC1: View-as shows exactly the blocks revealed to that player.

**N-24 — Versions and curation** · ws:notebook · r-4 · deps: 0057
Show version history with author, source and status. Diff and restore. Accept a draft per field.
- AC1: Every AI version shows `ai:<purpose>` and its source.
- AC2: Restore creates a new version, never deletes one.

**N-25 — AI co-author drafts and session prep** · ws:notebook · r-4 · deps: N-22, N-24
Ask the AI to draft or fill any entity from a prompt; the result is a draft proposal through the gate. Add the session prep template (Lazy DM eight steps) linked to entities.
- AC1: An AI draft lands as `draft` and needs curation under `ask`.
- AC2: The prep template links each step to entities.

### R5 — The Board

**N-26 — Line of sight, vision and light** · ws:board · r-5 · deps: 0070
Compute wall LOS and per-token vision on the server. Add bright, dim and dark light for Darkvision.
- AC1: A player client never receives a token outside its vision.

**N-27 — AoE on the grid** · ws:board · r-5 · deps: 0070, 0227
Template follows the cursor; the engine computes hits by the P-06 convention; the click drafts the Intent with targets.
- AC1: Engine and board agree on hits in golden tests.

### R6 — Generators

**N-28 — Generator framework and desk** · ws:generators · r-6 · deps: N-25
Build the hybrid pipeline (context → seeded skeleton → LLM flesh → validate → draft), reroll and lock, provenance, and the standalone generator desk page.
- AC1: Rerolling with the same seed reproduces the skeleton.
- AC2: Validation rejects any model-written number.

**N-29 — Dungeon generator** · ws:generators · r-6 · deps: N-28, 0068
Room graph from the LLM, deterministic layout, MapPlan output, five-room template.
- AC1: The output plays on the board without manual edits.

**N-30 — Treasure and loot generator** · ws:generators · r-6 · deps: N-28, 0092
Roll SRD treasure tables into items and coin; link to encounters and locations.
- AC1: Every item resolves to an SRD or codex record.

### R7 — Campaign Memory

**N-31 — Retrieval over chronicle and notebook** · ws:memory · r-7 · deps: N-15, 0084
Index chronicle, journal and notebook prose with the library's hybrid retrieval, filtered by visibility before ranking. `assemble` and `ask_dm` read it within a token budget.
- AC1: A player never retrieves an unrevealed block.
- AC2: "Who was that innkeeper" answers from session 1 in session 3.

### R8 — Release 1.0

**N-32 — Publish engine and SRD packages** · ws:platform · r-8 · deps: N-05, 0225–0230
Publish `dnd5e-engine` and `srd` to npm with schema version, attribution and golden-dice conformance tests.
- AC1: A clean project installs both and runs the conformance suite.

## 3. Uncarded-gap coverage

| Gap (inventories, digest §4) | New or rewritten card |
|---|---|
| Typed intent | N-01–N-04 |
| Spatial model | N-05, N-06, N-26, N-27 |
| Narration fragility | 0245, N-07, N-08 |
| Campaign records, snapshots | N-14, N-15 |
| Combat UX | N-09–N-12 |
| Sheet UI, character creation | N-17, N-18 |
| Human-DM console | N-19, 0078, 0077 |
| Communication channels | N-16 |
| Onboarding, safety | N-20, N-21 |
| Notebook and editors | 0059, N-22–N-25 |
| Generators | N-28–N-30, 0061, 0062 |
| Long-campaign memory | N-31, 0083, 0084 |
