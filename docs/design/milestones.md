# the-stacks — Milestones

**Status:** ratified 2026-09-21 (design session, operator + Claude) — shape and order approved as proposed.
**Revised 2026-10-25** (re-centre session; decision-0009 to decision-0021, session record
doc-0004): the ladder after M1 is replaced. M0 and M1 stay as history. The 2026-09-21 ladder
(M2 Codex, M3 Sheets & Systems, M4 The Table, M5 Maps & Media, M6 Assisted Table = V1,
M7–M9 automaton) is superseded by decision-0009 and is kept at the end of this file for the
record.
**Companions:** [vision.md](vision.md), [architecture.md](architecture.md)
**Cadence assumption:** aggressive push — near-daily operator involvement,
parallel sweep lanes, a milestone lands every 2–4 weeks.

**Re-baselined 2026-09-28** at M0 close: M0 landed 2026-09-23, three weeks ahead of target.
**Re-baselined 2026-10-25** for the new ladder: M2 starts 2026-10-27; each later target
follows from the one before it at the stated duration.

Each milestone is a demoable state, maps to a backlog milestone (`m-N`) and a set of board
TASKs (one PR each), and ends with a re-grounding pass. Dates are targets, not promises.
Each entry below gives a **demo** statement, the **scope**, and the **entry gate**.

| Milestone | Board | Duration | Target |
|---|---|---|---|
| M0 Skeleton | — | 2 wk | delivered 2026-09-23 |
| M1 The Library | m-1 | 3 wk | 2026-10-20 (open: TASK-0031, TASK-0038, TASK-0039) |
| M2 First Scene | m-2 | 4 wk | 2026-11-24 |
| M3 The Table (multiplayer) | m-3 | 3 wk | 2026-12-15 |
| M4 The Codex | m-4 | 3 wk | 2027-01-05 |
| M5 Imported Mechanics | m-5 | 2 wk | 2027-01-19 |
| M6 Maps and the Table View | m-6 | 4 wk | 2027-02-16 |
| M7 The Dial = V1 | m-7 | 3 wk | 2027-03-09 |
| M8 Memory and Pacing | m-8 | 3 wk | 2027-03-30 |
| M9 Solo Campaign | m-9 | sketch | re-planned at V1 |

## M0 — Skeleton (2 wk, delivered 2026-09-23)

Walking skeleton proving every seam: monorepo, compose stack (app + db),
session auth (operator + invited players), one REST route, one WebSocket
echo into a Postgres event log and back out, CI (lint, typecheck, test,
build, boundary check). **Demo:** two browsers sign in; a message from one
appears in the other via the event log. Delivered three weeks early; see [m0-skeleton-sweep-runbook.md](m0-skeleton-sweep-runbook.md).

## M1 — The Library (3 wk, target 2026-10-20)

Ingestion + grounded Q&A. D&D Beyond HTML parser, generic HTML/MD fallback,
chunking, embeddings, hybrid retrieval, citations with source anchors, chat
UI with streaming answers, retrieval eval fixtures in CI. **Demo:** import
your PHB export, ask "how does grappling work," get a cited answer you can
click through to the source passage.

Open at the 2026-10-25 revision: TASK-0031 (human acceptance walkthrough), TASK-0038
(library management UI), TASK-0039 (chat sessions). They stay in M1 and may run in parallel
with M2.

## M2 — First Scene (4 wk, target 2026-11-24)

*decision-0009, decision-0014.* An AI-run vertical slice on our stack.

**Demo:** one human player plus AI companions play a scene — exploration, a social beat and
a fight — to its end. The engine rolls every die; the narration never contradicts the
ledger; the playtest auditor's report is attached.

**Scope:**

| Card | Deliverable | Depends on |
|---|---|---|
| TASK-0042 | Pure 5e engine package: dice, seeded RNG, HP, conditions, initiative, death saves, rests, slots, refusal codes | TASK-0041 |
| TASK-0043 | SRD 5.2.1 baseline data with CC-BY-4.0 attribution, loader, compact lookup records | TASK-0041 |
| TASK-0044 | Session model: talk, action lifecycle, table modes, party, encounter, secret trackers, roll ledger, projections | TASK-0042 |
| TASK-0045 | Proposal gate: auto/ask/suggest per kind, commit authority by mode, refuse before write | TASK-0044 |
| TASK-0046 | DM runtime: turn jobs, pipeline nodes, Director, companions, doctrine prompts, scene seed | TASK-0045, TASK-0043 |
| TASK-0047 | Play route: composer, commit control, mode indicator, ledger, DM approvals (no modals) | TASK-0045 (starts on fixtures) |
| TASK-0048 | Scripted-dice playtest harness, auditor agent, milestone demo | TASK-0046, TASK-0047 |

Lanes: TASK-0042 and TASK-0043 run in parallel; TASK-0047 can start on fixtures beside
TASK-0044/0045.

**Not in scope** (each is carded or placed): codex entities (M4 — the scene runs from a
hand-authored scene seed); several humans (M3); maps (M6); extracted import mechanics (M5).

**Entry gate:** TASK-0041 merged (this revision and constitution 2.0.0).

## M3 — The Table, multiplayer (3 wk, target 2026-12-15)

*decision-0014, decision-0016, decision-0015.* Several humans at one table.

**Demo:** three humans play one scene twice — once with the AI DM (`auto`), once with a human
DM approving AI proposals (`ask`). Both pass the playtest auditor.

**Scope:**

| Card | Deliverable | Depends on |
|---|---|---|
| TASK-0049 | Group sign-off for party-scope actions | TASK-0048 |
| TASK-0050 | Turn-mode floor passing between players | TASK-0048 |
| TASK-0051 | Presence: who is at the table (decision record first; ws-protocol omits presence by design) | TASK-0048 |
| TASK-0052 | Narrator chime-in rules for talk with several humans | TASK-0048 |
| TASK-0053 | Multi-human demo with an AI DM and with an assisted human DM | TASK-0049–0052 |
| TASK-0055 | Revisit: parked tabletop-dm combat rules, decided from TASK-0048 evidence | TASK-0048 |

**Entry gate:** M2 demo passed (TASK-0048 Done).

## M4 — The Codex (3 wk, target 2027-01-05)

Campaign content plane. Campaign CRUD; entity types NPC / PC / location / encounter / item
with content contracts (identity in the engine's record shapes, portrayal, hooks); typed
links; portrayal-completeness lint; codex browser UI; PC sheets over the engine. The DM
runtime's `assemble` reads codex neighbours, replacing the M2 scene seed. Campaign-prep
agents: the NPC-smith, then the encounter builder.

**Demo:** create a campaign, ask for "a corrupt harbormaster with a debt," get a complete,
linked, editable NPC; the AI DM then runs a scene in which he appears and plays him in voice.

**Gate on the first agent task:** the milestone's first agent task (the NPC-smith) does not
start until **TASK-0054 (Revisit LangGraph adoption)** is decided. Landing a second agent
graph is that card's trigger (decision-0019), so the NPC-smith card depends on TASK-0054.

**Entry gate:** M3 demo passed (TASK-0053 Done). Cards authored at M3 close (decision-0020).

## M5 — Imported Mechanics (2 wk, target 2027-01-19)

*decision-0012.* Extract stat blocks and spells from the operator's D&D Beyond imports into
the engine's structured records, layered over the SRD 5.2.1 baseline. Extracted records
cite their source passage and stay in the operator's volume.

**Demo:** import a book with a monster not in the SRD; the engine runs it in a fight; its stat
block cites the imported page.

**Entry gate:** M4 demo passed. Cards authored at M4 close.

## M6 — Maps and the Table View (4 wk, target 2027-02-16)

*decision-0013.* Map-planner agent → MapPlan JSON → deterministic tile renderer; the in-app
PixiJS table view (grid, tokens, fog, walls blocking reveal) as session events; the first
live VTT adapter (Foundry or Owlbear, chosen by decision record at milestone start); UVTT
export; codex export to an Obsidian vault; portraits through the image-provider seam.

**Demo:** "a smugglers' cave, 30×40" → playable map in the session; the AI DM moves monster
tokens and reveals fog; the same session shows in the chosen external VTT; the campaign
exports to an Obsidian vault; an NPC gets a portrait.

**Entry gate:** M5 demo passed. Cards authored at M5 close.

## M7 — The Dial = V1 (3 wk, target 2027-03-09)

*Re-derived from decision-0009 and decision-0015.* V1 ships **both ends of the autonomy
dial** on one pipeline: an AI-run table and an AI-assisted human DM. Assisted-DM polish: the
approval panel at full strength, per-kind policy settings in the UI, rules lookups and NPC
improvisation as proposals in context, mid-session generation of NPCs, encounters and maps.
Self-host polish: docs, compose quickstart, backup/restore, versioned migrations.

**Release:** tagged V1, public README, demo video showing the same scene run by the AI and by
a human DM with AI assistance.

**Entry gate:** M6 demo passed. Cards authored at M6 close.

## M8 — Memory and Pacing (3 wk, target 2027-03-30)

Campaign memory as summarization projections of the event log; scene framing; the Director
grows into session-to-session pacing (decision-0018); continuity across sessions.

**Demo:** a second session opens with the AI DM recapping the first accurately, from the log.

**Entry gate:** V1 tagged. Cards authored at M7 close.

## M9 — Solo Campaign (sketch; re-planned at V1)

The end goal: a full solo campaign, start to finish, run by the AI DM with AI companions.
The assisted table remains available as the fallback when the AI is out of its depth.

**Entry gate:** M8 demo passed. Re-planned at V1 by decision record.

## Why this order after M3

- **The Codex comes first** because the AI DM is its hardest customer: M2 runs from a
  hand-authored scene seed, and every gap the playtests expose (what an NPC record must hold
  for the narrator to play it) becomes a codex requirement. It also delivers operator goal 2
  (campaign management) and carries the LangGraph revisit.
- **Imported mechanics come next** because they are small, depend only on the library (M1)
  and the engine (M2), and remove the SRD-only limit on what the AI DM can run before maps
  multiply the content in play.
- **Maps, the table view and adapters follow** because they project state that by then
  exists: codex locations to export, monsters to place, a log for an adapter to follow. The
  Obsidian vault export needs the Codex.
- **V1 then polishes both ends of the dial** rather than building the assisted table from
  scratch: `ask` and `suggest` already exist from M2 and are proven with humans in M3.
- **Memory and pacing, then the solo campaign,** stay post-V1: they need long play histories
  that only a released V1 produces.

## Standing risks

| Risk | Mitigation |
|---|---|
| AI DM quality disappoints in the First Scene | Doctrine as right/wrong pairs; audit node; scripted playtests with an auditor agent (TASK-0048) give evidence, not impressions. |
| Narration contradicts the dice | Ordering is the anti-cheat: resolve before narrate; `audit` regenerates and flags (A11). |
| Engine scope creep (every spell as code) | The engine owns primitives only; effects resolve by cited adjudication (A10). |
| Map gen quality disappoints | Structured-first keeps maps *correct*; style is iterable. UVTT export gives value even if our renderer lags. |
| Event-log schema churn | Events are versioned from day one; projections tolerate unknown types. |
| D&D Beyond export format shifts | Parser is fixture-tested; fixtures captured from real exports; generic HTML fallback always works. |
| SRD attribution drift | A test guards the attribution file (TASK-0043). |
| Aggressive cadence slips | Milestones are demo-gated, not date-gated; dates re-baselined at each milestone close. |

## Superseded: the 2026-09-21 ladder (record only)

Superseded 2026-10-25 by decision-0009 (order), decision-0010 (no Fate module),
decision-0013 (table view and adapters) and decision-0015 (V1 = the dial).

- M2 The Codex → now M4.
- M3 Sheets & Systems (5e module + Fate Condensed conformance module) → dissolved: the engine
  lands in M2, sheets in M4, Fate dropped.
- M4 The Table (realtime play, DM + two players) → split: First Scene (M2) and The Table,
  multiplayer (M3).
- M5 Maps & Media → now M6, with the table view and adapters.
- M6 The Assisted Table = V1 → now M7, The Dial = V1.
- M7 Solo scene / M8 Memory & pacing / M9 Solo campaign → solo scene became M2; memory and
  pacing M8; solo campaign M9.
