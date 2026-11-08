# Wish list — end goals → features → capabilities → foundations

**Replan 2026-11, Synthesis.** Date 2026-11-06. Author: opus implementer (operator-authorized tier).
**Inputs:** [brief.md](brief.md), `research/*.md`, [../vision.md](../vision.md), [../architecture.md](../architecture.md), [../milestones.md](../milestones.md).
**Companions:** [target-architecture.md](target-architecture.md), [plan-of-action.md](plan-of-action.md), [decisions-for-ratification.md](decisions-for-ratification.md), [board-rework-map.md](board-rework-map.md).

This file works strictly backward. Each end goal names the features that make it true. Each feature names the capabilities it needs. Each capability rests on one or more foundations. Nothing appears here that no goal asks for.

## 0. Stance check

The orchestrator's stance holds against the evidence. Two refinements:

1. **The audit adds a sixth gap the stance folds into F3:** there is no campaign, table or session record at all (`routes/tables.ts` scans events). F3 below includes those records explicitly.
2. **Latency, not cost, is the binding constraint** (decisions digest §5: $2.55–$4.73 per run; median turn 28–39 s; players leave at 30 s, table-ux §1). F2 and F5 are therefore the first foundations to build, ahead of F3, even though F3 unlocks more goals. Both start in R1; F2/F5 carry the first demo.

## 1. End goals

| Goal | Statement (brief) | Done when |
|---|---|---|
| **G1** | A player sits down alone; an AI DM runs a full campaign start to finish. | A solo player plays a short campaign from premise to conclusion across 3+ sessions, with recaps, without operator intervention. |
| **G2** | A top-notch human table: human or AI DM, multiplayer. | Three humans play one adventure twice, once with the AI DM and once with a human DM using the console; both runs pass the playtest auditor. |
| **G3** | UX is first-class: talking to DM, players and NPCs; combat; text play and VTT play. | A full combat round of 4 PCs and 4 monsters takes under 60 s of wall time, in text and on the board, with mechanics shown in under 1 s. |
| **G4** | Campaign creation: generators, notebook, editors; human DM and AI co-author. | A human DM and the AI build a 5-location adventure together in the notebook, and the AI DM plays it with no hand-authored seed. |

## 2. Foundations

Five missing foundations (F) and seven kept assets (K). Every feature lists which it needs.

| Id | Foundation | One line | Status today (audit) |
|---|---|---|---|
| **F1** | Spatial model | Zones first (named regions, adjacency, range bands); grid squares later as a finer resolution of the same model. Positions live in engine state. | Absent (audit §3.1) |
| **F2** | Intent vocabulary + planner | One typed Intent set for typed text, buttons, sheet, map, AI DM and human DM. A deterministic planner turns an Intent into engine commands. Mechanics resolve in code in under 1 s. | Absent; only `action.declare {text}` (audit §3.2) |
| **F3** | Campaign/codex data model | Generic entity + typed payload, typed links, field/block visibility, reveal-as-event, versions with provenance, authored by human or AI. Campaign, table and session records. | Absent; four JSON seeds (audit §3.3) |
| **F4** | Memory and continuity | Typed state for what changes play (knowledge, attitude); retrieval over journal and chronicle for recall; projection snapshots. | 20-line tail; full replays (audit §3.4) |
| **F5** | Narration around facts | Code renders every fact row (dice, damage, life state, State line). The model writes prose slots around a fact sheet. Audit shrinks to a leak and contradiction check. | Free prose, then lexical + model audit (inventory B §2) |
| K1 | Event log + per-viewer visibility | Keep. | Sound (audit §2) |
| K2 | Pure 5e engine | Keep; extend with F1. | Sound |
| K3 | Proposal gate / autonomy dial | Keep; extend to prep-time proposals. | Sound |
| K4 | Shared `project()` fold | Keep; add snapshots (F4). | Sound |
| K5 | AI gateway + cost ledger | Keep; add structured output mode. | Sound; brittle JSON (0203) |
| K6 | Jobs queue | Keep. | Sound |
| K7 | Library retrieval | Keep; reuse for notebook search. | Sound |

## 3. Tiers

| Tier | Meaning | Milestones (plan-of-action.md) |
|---|---|---|
| **MVP** | All four goals demonstrable at minimal depth: text play with zones, codex-driven scenes, a human-DM console. | R1–R4 |
| **V1** | Release 1.0: the board, generators, long-campaign memory, self-host release. | R5–R8 |
| **Later** | After 1.0. Carded as deferred with a trigger. | — |

## 4. Features by surface

### 4.1 Table — text play

| Id | Feature | Tier | Goals | Foundations |
|---|---|---|---|---|
| W-101 | One stream with room blocks, clickable ways and nouns, filter chips (All · Story · Rolls · Table talk · Whispers). | MVP | G1 G2 G3 | K1 K4 F5 |
| W-102 | Composer with speaker/channel chip, `@` and `/` autocomplete, Tab completion, history. | MVP | G3 | F2 |
| W-103 | Intent pills: any button, sheet or map click drafts an editable pill in the composer; Enter commits. | MVP | G3 | F2 |
| W-104 | Mechanical result in under 1 s; narration streams after and never blocks the next action. | MVP | G1 G2 G3 | F2 F5 |
| W-105 | Code-rendered State line after every DM reply: whose move, what changed. | MVP | G1 G3 | F5 |
| W-106 | Exploration quiet ring: players just talk; the DM reads the table after a quiet window and asks 👍 per deed. | MVP | G1 G2 | F2 |
| W-107 | "Why" expansion on every ruling: rule cited, DC, engine primitive. | MVP | G2 G3 | F5 K7 |
| W-108 | Zone chips in the margin: who is where, click drafts a move. | MVP | G3 | F1 F2 |
| W-109 | Party margin: controller, class, level, HP word + bar, AC, conditions, life state. | MVP | G2 G3 | K4 |
| W-110 | Screen-reader parity: `role="log"`, assertive region for own turn and reactions, word + colour for HP. | MVP | G3 | F5 |
| W-111 | Narrow screens (390 px): bottom-sheet panels, mini-strip above composer. | MVP | G3 | — |
| W-112 | Solo-only "retry narration" (flavour only; never re-rolls). | V1 | G1 | F5 |
| W-113 | Bookmarks in the stream; jump to bookmark. | Later | G1 G2 | K1 |

### 4.2 Board — VTT play

| Id | Feature | Tier | Goals | Foundations |
|---|---|---|---|---|
| W-201 | Zone map view: rooms and occupants without coordinates, from the same scene state. | MVP | G3 | F1 |
| W-202 | Board as a peer surface: docked at ≥1440 px, slide-out below; square grid, pan/zoom, tokens. | V1 | G2 G3 | F1 F2 K4 |
| W-203 | Click token → draft target; drag token → ghost path with feet counter and OA warnings → draft move. | V1 | G3 | F1 F2 |
| W-204 | Ruler (SRD 5.2.1 grid movement). | V1 | G3 | F1 |
| W-205 | Room-based fog, filtered per viewer on the server. | V1 | G2 G3 | F1 K1 |
| W-206 | Server-side wall line of sight and per-token vision; dim/dark light for Darkvision. | V1 | G3 | F1 |
| W-207 | AoE templates with engine-computed hits. | V1 | G3 | F1 F2 K2 |
| W-208 | Speech bubble over the speaker's token; stream keeps the text. | V1 | G3 | F2 |
| W-209 | Universal VTT (UVTT) export. | V1 | G2 G4 | F1 |
| W-210 | One live adapter (Foundry first), trigger-gated. | Later | G2 | F1 F2 K1 |
| W-211 | Hex grids, elevation, drawing tools, animated effects. | Later | G3 | F1 |

### 4.3 Character sheet

| Id | Feature | Tier | Goals | Foundations |
|---|---|---|---|---|
| W-301 | Sheet drawer as an action surface: every rollable number drafts an Intent; composer stays visible. | MVP | G2 G3 | F2 K2 K4 |
| W-302 | Tabs: Actions (Action/Bonus/Reaction filter), Spells (slot pips, castable now), Inventory, Features, Notes. | MVP | G3 | K2 F3 |
| W-303 | Character creation from SRD 5.2.1 (species, background, class, ability scores, level 1–3). | MVP | G1 G2 | F3 K2 |
| W-304 | PC as a codex entity: pronouns, bonds, character secrets, engine-computed mechanics. | MVP | G1 G2 G4 | F3 K2 |
| W-305 | Inline level-up flow (HP → features → choices → spells → review); AI may suggest, player chooses. | V1 | G1 G2 | F3 K2 |
| W-306 | Inventory actions (Use/Give/Drop/Equip) as Intents. | MVP | G3 | F2 |
| W-307 | Import an existing character (DDB HTML). | Later | G2 | F3 |

### 4.4 Combat

| Id | Feature | Tier | Goals | Foundations |
|---|---|---|---|---|
| W-401 | Explicit turns in combat; turn banner with round and economy pips (Action, Bonus, Move, Reaction). | MVP | G2 G3 | F2 K2 |
| W-402 | Action bar filtered to what is legal now. | MVP | G3 | F2 |
| W-403 | `@` targeting sorted by distance with HP word and AC if known. | MVP | G3 | F1 F2 |
| W-404 | One intent, one card: attack, hit/miss and damage in one collapsed row. | MVP | G3 | F2 F5 |
| W-405 | Roll-request row addressed to the right roller; auto-roll toggle. | MVP | G2 G3 | F2 |
| W-406 | Reaction policy per reaction (Ask/Auto/Off); inline reaction row with extendable countdown (OA, Shield). | MVP | G2 G3 | F2 K2 |
| W-407 | Life state and condition chips with remaining duration; death-save slots. | MVP | G3 | K2 K4 |
| W-408 | Encounter lifecycle: start, join, flee, end, resume; surprise. | MVP | G1 G2 | K2 F1 |
| W-409 | Off-turn pre-declare as a pending pill. | V1 | G2 G3 | F2 |
| W-410 | Monster turns batch into one block plus one narration paragraph. | MVP | G1 G3 | F5 |
| W-411 | Zone-based AoE in text with target-count caps. | MVP | G3 | F1 K2 |
| W-412 | Engine owns every number: roll steps, effect amounts, monster DCs, class-feature damage. | MVP | G1 | K2 |

### 4.5 Communication

| Id | Feature | Tier | Goals | Foundations |
|---|---|---|---|---|
| W-501 | Six channels: in-character, address NPC (`@Mara`), emote (`/me`), ask DM (`@dm`, `((`), table talk (`/p`), whisper (`/w`). | MVP | G2 G3 | F2 K1 |
| W-502 | Table talk is a hard server-side filter: NPCs and narrator never see it. | MVP | G2 | K1 |
| W-503 | "Talking to" memory on the channel chip. | MVP | G3 | F2 |
| W-504 | NPC card slide-out from any `@mention`: portrait, attitude toward you, what you know. | MVP | G3 G4 | F3 F4 |
| W-505 | Per-NPC conversation history. | V1 | G1 G3 | F4 |
| W-506 | Session zero: content limits, safety tools, spotlight preferences. | MVP | G2 | F3 |

### 4.6 Notebook / codex

| Id | Feature | Tier | Goals | Foundations |
|---|---|---|---|---|
| W-601 | Notebook tree by kind and by containment; entity page; slide-out linked entities. | MVP | G4 | F3 |
| W-602 | `@` links, automatic backlinks, full-text search. | MVP | G4 | F3 K7 |
| W-603 | Per-block visibility (`dm`, `party`, `<pc>[]`); "View as player". | MVP | G2 G4 | F3 K1 |
| W-604 | Reveal as an event from the notebook or the table. | MVP | G1 G2 G4 | F3 K1 |
| W-605 | Schema-driven editors for npc, location, encounter, item, clue, quest; readiness lint gates "ready for play". | MVP | G4 | F3 |
| W-606 | Version history with author (`human`/`ai:<purpose>`) and generator provenance; diff and restore. | MVP | G4 | F3 |
| W-607 | Quest/storyline entity with clue graph and Three Clue coverage lint. | V1 | G1 G4 | F3 |
| W-608 | Vector search over notebook prose, visibility-filtered. | V1 | G1 G4 | F3 K7 |
| W-609 | Obsidian vault export. | V1 | G4 | F3 |
| W-610 | Relations graph explorer; faction clocks; timeline. | Later | G4 | F3 |

### 4.7 Generators

| Id | Feature | Tier | Goals | Foundations |
|---|---|---|---|---|
| W-701 | Generator desk: donjon-style standalone page whose output lands as a notebook draft. | V1 | G4 | F3 K3 |
| W-702 | Hybrid pipeline: context read → seeded code skeleton → LLM flesh → code validate → draft proposal. | V1 | G4 | F3 K3 K5 |
| W-703 | Reroll one field, reroll skeleton (new seed), lock fields. | V1 | G4 | F3 |
| W-704 | NPC generator. | V1 | G1 G4 | F3 |
| W-705 | Encounter generator (2024 DMG budget over SRD monsters); prepared encounter is the combat record. | V1 | G1 G4 | F3 K2 |
| W-706 | Treasure and loot generator (SRD tables, magic items). | V1 | G4 | F3 K2 |
| W-707 | Dungeon generator: room graph → layout → MapPlan, five-room template. | V1 | G1 G4 | F1 F3 |
| W-708 | Generators callable mid-session from the table and the DM console. | V1 | G1 G2 | F3 K3 |
| W-709 | Settlement, tavern, rumour generators; user-authored random tables. | Later | G4 | F3 |
| W-710 | Portraits through the image-provider seam. | Later | G4 | F3 |

### 4.8 Human-DM console

| Id | Feature | Tier | Goals | Foundations |
|---|---|---|---|---|
| W-801 | DM view with proposal rows: Accept / Edit inline / Reject / Narrate my own. | MVP | G2 | K3 F2 |
| W-802 | DM notes slide-out (working context): scene facts, NPC goals, clocks; editable by a human DM, read-only summary for players. | MVP | G2 G3 | F3 F4 |
| W-803 | DM-control Intents: narrate, speak as NPC (`/as`), request roll, set DC, apply damage/condition, start/end combat, reveal, pause. | MVP | G2 | F2 |
| W-804 | Per-kind autonomy policy settings (auto/ask/suggest). | MVP | G2 | K3 |
| W-805 | Seat any table member as DM, present or not; return seat to AI settles pending proposals. | MVP | G2 | K3 |
| W-806 | Improvise a scene with no prepared content. | MVP | G2 | F3 |
| W-807 | At-table quick panel: current location, NPCs present, encounter statblocks inline, unrevealed secrets, one-click reveal. | V1 | G2 G4 | F3 |
| W-808 | Secret DM rolls. | MVP | G2 | F2 K1 |

### 4.9 AI DM

| Id | Feature | Tier | Goals | Foundations |
|---|---|---|---|---|
| W-901 | AI DM emits the same Intents as a human DM, through the same gate. | MVP | G1 G2 | F2 K3 |
| W-902 | AI DM plays from codex entities compiled by graph neighbourhood; no hand-authored seed. | MVP | G1 G4 | F3 |
| W-903 | NPC knowledge, met-ledger and attitude as typed state; NPCs learn what they are told or shown. | MVP | G1 G3 | F3 F4 |
| W-904 | Interpret free text into Intents; ask a clarify question when ambiguous. | MVP | G1 G3 | F2 |
| W-905 | Structured model output per purpose; truncation and invalid JSON are observable and rare. | MVP | G1 | K5 |
| W-906 | AI DM drives tokens, fog and reveals on the board. | V1 | G1 G3 | F1 F2 |
| W-907 | Director pacing over open threads, clocks and scene goals. | V1 | G1 | F3 F4 |
| W-908 | Assisted fallback: AI shifts toward `ask` when out of depth. | V1 | G1 G2 | K3 |
| W-909 | Long-campaign recall: journal and chronicle retrieval within a token budget. | V1 | G1 | F4 |

### 4.10 Campaign lifecycle (create → play → recap)

| Id | Feature | Tier | Goals | Foundations |
|---|---|---|---|---|
| W-1001 | Campaign, table and session as first-class records; "Your campaigns" list. | MVP | G1 G2 | F3 |
| W-1002 | Session prep template (Lazy DM eight steps), slots linked to notebook entities, AI fills on request. | V1 | G2 G4 | F3 |
| W-1003 | Chronicle write-back: after a session, proposed notebook updates land as drafts. | V1 | G1 G4 | F3 F4 K3 |
| W-1004 | Session-start recap; threads, clocks and attitudes carry over. | V1 | G1 G2 | F4 |
| W-1005 | Campaign from a premise: chain generators into a playable start. | V1 | G1 G4 | F3 |
| W-1006 | Campaign conclusion: epilogue and archived chronicle. | V1 | G1 | F4 |

### 4.11 Platform, onboarding, hosting

| Id | Feature | Tier | Goals | Foundations |
|---|---|---|---|---|
| W-1101 | Invite link → account → create or pick a character → lobby → table. | MVP | G2 | F3 |
| W-1102 | Password recovery without shell access. | MVP | G2 | — |
| W-1103 | Backup, restore and upgrade migrations per campaign. | MVP | G1 G2 G4 | F3 |
| W-1104 | Self-host quickstart: clean clone to first scene by public docs; documented public-access recipe. | V1 | G2 | — |
| W-1105 | Published `dnd5e-engine` and `srd` packages. | V1 | — (project) | K2 |
| W-1106 | Imported mechanics from DDB exports (layered over SRD). | Later | G4 | K2 K7 |

## 5. Capabilities

A capability is a system ability several features share. Each maps to foundations.

| Id | Capability | Features served | Foundations |
|---|---|---|---|
| C-01 | Typed Intent with commit states (`draft`, `declared`, `confirmed`) and a text form | W-102–106, W-301, W-401–406, W-501, W-801–803, W-901 | F2 |
| C-02 | Deterministic planner: Intent → engine commands \| refusal \| needs-ruling | W-104, W-401–404, W-412, W-901 | F2 K2 |
| C-03 | Zone state in the engine: membership, adjacency, range bands, reach | W-108, W-201, W-403, W-411 | F1 K2 |
| C-04 | Grid resolution over zones: squares, walls, doors, LOS, light | W-202–207 | F1 |
| C-05 | Per-viewer projection of spatial and codex state | W-205, W-603, W-604 | K1 K4 F1 F3 |
| C-06 | Fact sheet + fact rows rendered by code | W-104, W-105, W-404, W-410 | F5 |
| C-07 | Prose slots constrained by a fact sheet; leak/contradiction check | W-104, W-112 | F5 K5 |
| C-08 | Entity store: base + typed payload, versions, links, containment, visibility | W-304, W-601–607 | F3 |
| C-09 | Compile codex neighbourhood into a scene context | W-802, W-902, W-807 | F3 |
| C-10 | Knowledge ledger and attitude as typed state | W-504, W-903 | F3 F4 |
| C-11 | Prep-time proposals (generator and chronicle drafts) through the gate | W-702, W-1003 | K3 F3 |
| C-12 | Projection snapshots at seq N | all play surfaces at campaign length | F4 K4 |
| C-13 | Retrieval over chronicle, journal and notebook prose | W-608, W-909, W-1004 | F4 K7 |
| C-14 | Campaign/table/session records | W-1001, W-1101, W-1103 | F3 |
| C-15 | Structured output mode in the gateway | W-905, W-702 | K5 |
| C-16 | Encounter state machine | W-408, W-401 | K2 |

## 6. Coverage check

| Goal | MVP features | V1 features | Uncovered today (board inventories) |
|---|---|---|---|
| G1 | W-104, W-105, W-303, W-410, W-412, W-902–905, W-1001 | W-907–909, W-1003–1006 | memory, campaign start, conclusion |
| G2 | W-501–506, W-801–808, W-1101–1103 | W-807, W-1104 | DM console, onboarding, channels |
| G3 | W-101–111, W-301–306, W-401–411, W-201 | W-202–209, W-305, W-409 | sheet UI, combat UX, VTT |
| G4 | W-303, W-304, W-601–606 | W-607–609, W-701–708, W-1002, W-1005 | generators, notebook, editors |

Every goal has an MVP slice in R1–R4. Every "uncovered" column item gets a new card in [board-rework-map.md](board-rework-map.md).
