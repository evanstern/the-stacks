# Decisions digest — for the 2026-11 replan

Sources: backlog/decisions (decision-1, 0002-0028), backlog/docs doc-0001..0004, docs/design/{vision,milestones,architecture,playtest-scenarios}.md, design rounds (chat-ui, mud-ux, one-chat-stream), docs/playtests/*. Read 2026-11-06 on branch replan-2026-11. Read-only; no source file was edited.

Brief end goals used below: G1 solo AI-DM campaign; G2 top-notch human/multiplayer table (co-equal); G3 first-class UX (DM/player/NPC talk, combat, text and VTT); G4 campaign creation (generators, notebook, editors; human and AI co-author).

Note: decisions 0002-0006 are empty stubs in backlog/decisions (status "proposed"); their real content is in doc-0001/doc-0002 (ratified 2026-09-28). Decision-0027's body says "Status: proposed" though frontmatter says accepted.

## 1. Decision table

| id | title | date | choice (one line) | fit | why |
|---|---|---|---|---|---|
| decision-1 | v2 foundational design | 2026-09-22 | TS end to end, one Node proc (Hono+WS), Postgres 17 for everything, 2 containers; system-agnostic core; old ladder | revisit (items 2, 3 already superseded; item 1 stack open) | Stack served M0-M3, but SPA+PixiJS and "one process" need re-checking against VTT (G3) and multi-table scale (G2). |
| 0002 | M1 embedding provider/dim | 2026-09-29 | OpenAI-compatible embeddings, dim 1024, model+dim stored per row (doc-0001) | keep | Config-level, reversible; serves rules/codex retrieval. |
| 0003 | M1 parser fixture licensing | 2026-09-29 | Synthetic/SRD fixtures in CI; real exports local-only | keep | Legal hygiene; independent of plan. |
| 0004 | M1 answer streaming | 2026-09-29 | SSE from HTTP route for library Q&A, not WS | keep | Fine; revisit only if rules lookups become in-session events. |
| 0005 | M1 ingestion job execution | 2026-09-29 | Postgres jobs table, SKIP LOCKED, in-process worker; split on a measurement | keep | DM turn jobs reuse it. Re-measure if the stack/hosting model changes. |
| 0006 | Runtime envs | 2026-09-29 | Per-worktree compose stacks, hosted dev on vm-104, CD from main | keep (dev tooling) | Engineering process, not product. Public-hosting step (Cloudflare tunnel) is unplanned and matters for G2. |
| 0007 | AI gateway provider-agnostic | 2026-09-29 | Named providers/purposes in config; no vendor SDK; fetch adapters | keep | Core to G1/G4 (cost, model per purpose). Playtests show provider quirks (`<think>` prefixes, token budgets), so gateway hardening is needed, not replacement. |
| 0008 | Frontend: RR8 framework SSR, Tailwind v4, shadcn | 2026-09-30 | RR8 SSR default, client-only for realtime/canvas; Sheet not Dialog | revisit | SSR buys little for an authenticated app; a VTT/canvas-heavy UI (G3) may favour a SPA-first or separate-app shape. The no-modals part is a keeper. |
| 0009 | D1 First Scene next, AI-run first | 2026-10-25 | AI-run vertical slice before the Codex | revisit | Proved the engine/DM loop. It left human-DM and campaign-creation (G2, G4) behind; G2 is now co-equal. |
| 0010 | D2 5e only | 2026-10-25 | Drop system-agnostic core and Fate module; keep a `dnd5e` engine package boundary | keep | Matches goals; keeps the pure-engine boundary. |
| 0011 | D3 BYO books, DDB HTML import | 2026-10-25 | DDB HTML exports are the supported import | keep | Feeds G4 content; low cost. |
| 0012 | D4 SRD 5.2.1 baseline + extraction | 2026-10-25 | Ship SRD 5.2.1 (CC-BY) structured data; extract from imports in M5 | keep | Required for generators and engine; M5 timing is revisit-able. |
| 0013 | D5 VTT: server owns state; own table + adapters | 2026-10-25 | Event log is truth; minimal own table view; one live adapter (Foundry or Owlbear) chosen in M6; Obsidian export | revisit | Server-owns-state is right. "Minimal own table, adapter later" is thin for G3 "VTT play first-class"; operator wants a build-vs-embed-vs-adapter study. Verdict on FGU/Atlas/Foundry/Owlbear is partly unverified. |
| 0014 | D6 Solo+companions first; multi-actor protocol | 2026-10-25 | One human + AI companions first, multi-actor from day 1 | keep | Companions are real actors; supports both G1 and G2. |
| 0015 | D7 proposal gate / autonomy dial | 2026-10-25 | Every LLM output is a typed proposal; policy auto/ask/suggest per kind | keep | The unifying mechanism for G1, G2 (human DM) and G4 (AI co-author). Extend it to prep-time proposals. |
| 0016 | D8 Talk vs action, table modes | 2026-10-25 | Talk never changes state; actions have a lifecycle; commit authority by mode | superseded in part by 0027/0028; revisit | Core idea (typed world-changing actions) holds. The player-visible UX was replaced twice. |
| 0017 | D9 runtime: log, gate+engine, DM runtime, gateway | 2026-10-25 | 4 layers; pipeline assemble-director-interpret-adjudicate-resolve-narrate-audit; ordering is anti-cheat | keep | The best-validated decision (engine honest across 3 playtests). Cost/latency (28-39 s median turn, audit regenerates) is the open weakness. |
| 0018 | D10 Director own node | 2026-10-25 | Pacing node owns scene goal, clocks, mode switches | keep | Needed for G1 campaign pacing. Playtests show it overreaching (pre-deciding dice, 0237), so constrain not remove. |
| 0019 | D11 No LangGraph now | 2026-10-25 | Plain async nodes; revisit when second agent graph lands (M4 NPC-smith) | revisit | The trigger is exactly G4 (generators/prep agents). Decide it as part of the new architecture. |
| 0020 | D12 No unplanned "for now" | 2026-10-25 | Card every deferral; milestones carded up front | keep, but amend | Principle is sound. "Card all milestones up front" produced a board of 253 tasks vs ~50 planned; replan can keep the principle and tier the detail. |
| 0021 | D13 Ideas from tabletop-dm | 2026-10-25 | Script owns numbers; roll ledger; log is truth; secret clocks; doctrine pairs; scripted-dice tests; compact lookups | keep | Foundational and validated. |
| 0022 | D14 Resolution doctrine | 2026-10-27 | Capability not decision; stakes before dice; no stakes no roll; numbers from sheet; house-rule settings; flavour intensity | keep | Verified working in playtests (stakes/bands/opposition/Help). Make settings a first-class table-rules UI (G2). |
| 0023 | D15 Reject parked combat rules | 2026-10-27 | Reject Grit and fight budgeting on 1-fight evidence | keep (re-entry via combat research, TASK-0122) | Thin evidence; combat UX is the larger open issue. |
| 0024 | D16 Presence | 2026-10-27 | Opt-in `presence` frame + logged `presence.recorded` marker at decision points; one process | keep | Needed for G2. Multi-process revisit (TASK-0136) matters if the stack changes. |
| 0025 | D17 Actor-state rule gate | 2026-10-27 | All model output passes code gates over tracked actors; plot moves only via recorded facts/opposition dice | keep, tune | Prevents invented outcomes. Playtests: many fallbacks and refusals (audit regenerate/fallback on ~57% of combat turns in run B), so expect gate-over-strictness work. |
| 0026 | D18 NPC/information doctrine | 2026-10-27 | NPC attitude per PC; info moves via reveal facts; DM-only seed view; Influence DC | keep | Needed for G3 NPC conversation and G4 NPC editor (data shape). |
| 0027 | D19 Talk reactions | 2026-10-30 | IC talk can trigger DM reaction (none/reply/scene/escalate), chain cap 2 | keep | Matches "talk to NPCs". |
| 0028 | D20 One chat stream | 2026-11-02 | Players just talk; DM reads after a 10 s quiet ring; DM asks 👍 confirm per action; `@dm` read-only | revisit | Valuable UX, but every deed costs >=10 s plus a model call; poor fit for fast human tables (G2) and combat. Keep as one mode (AI-DM text play), not the only input model. |
| (no id) | chat-ui decision.md (TASK-0028) | 2026-09-29 | Reference-desk layout, Daylight palette, slide-out panel component, no modals | keep | Palette, panel component and no-modals rule are standing. |
| (no id) | mud-ux decision.md (TASK-0236) | 2026-11-04 | "Margin" layout + slide-out interactive map, click-to-draft | revisit | Chosen before VTT research. G3 now asks for real VTT play; this is a text-first layout with a map accessory. |

## 2. UI/UX history

### chat-ui rounds (TASK-0028, 2026-09-29; Library/Ask, not the table)
- Round 1: A Reference desk (chosen, restyled), B Marginalia (inline citation unfold; rejected: pushes conversation apart), C Console (dense/log-style; rejected: reads as a tool, citations in a modal).
- Round 2: A restyled; Daylight palette (teal #0f6f63 light / #4fd1c0 dark) chosen over Nightshift (violet, dark-first).
- Round 3: P slide-out Sources panel chosen over D (chips + `@` dropdown).
- Standing outputs: role-aware collapsing sidebar (operator: Ask/Library/Table; player: Table only; bottom tab bar on mobile), reusable slide-out panel on shadcn `Sheet`, cookies for UI state, no CDN/webfonts, WCAG AA.

### one-chat-stream rounds (TASK-0188, 2026-11-01/02)
- Trigger (alpha run 3): sign-off had no teeth; Talk/Action split forced players to pick a mode before speaking.
- Round 1: A "Every line is a move" (rejected: every line costs a DM turn), B "DM reads the room" (private chip; rejected), C "Say or Do" with 8 s hold window (chosen, then reworked).
- Round 2: A "Just talk" chosen; B "Talk, or flag a deed" rejected (brings back choice before speaking, needs TalkV1 change).
- Result (decision-0028): one composer, speaker chip, `@` autocomplete, `((` or `/ooc` for out-of-character, quiet-ring countdown, DM confirm row with 👍 / Not quite, interrupt strip, human-DM "Confirm as action..." control.
- Operator quotes: "I'm conflicted -- I feel like I'd rather have #1 be 'after 8s the DM asks explicitly for a 👍'"; "C, Say or Do"; "A, just talk"; "All (a), amend".

### mud-ux rounds (TASK-0236, 2026-11-04)
- Options: A Scroll (rejected: map has nowhere to live), B Margin (chosen), C Split (only click-to-draft kept), D Board (rejected: Foundry-like, drops NL-first and screen-reader parity; kept as the "too far" bound).
- Chosen: text stream owns the width; slim right margin with party HP/AC, turn order, conditions; map in the slide-out panel; click token/way drafts a line in the composer (never sends itself); one-line input with history, `@`/`/` autocomplete, Tab completion, clickable nouns, filter chips, expandable roll rows, status strip, MUD room blocks.
- Operator's words: "a slide-out map + the ability to interact with it."
- Rejected from research: verb-noun command grammar, player triggers/aliases/gags, draggable panes, cloud-synced layouts.
- OQ rulings: authored map geometry with event-driven token positions; keep filter chips; rules detail by per-row expansion first; click-to-draft goes to the composer.

### Operator UI preferences (verbatim where short)
- "Never use `<dialog>`, `showModal`, or a centred overlay with a backdrop. They work badly on mobile, and designing UX around them is painful." Slide-out panels, inline expansion, autocomplete dropdowns; confirmations inline (memory: ui-no-modals).
- Daylight palette in both modes; "Round 1's styling ... too dull"; Sources button "must look openable".
- Natural-language first; screen-reader parity; works at 1280 px and 390 px; Brave for browser work.
- Playtest, finding on state visibility: "there's no way to easily tell what's dead or alive or where any character is in relation to another (the latter will come with the VTT)". The operator expects a VTT as the answer to positions.
- Proposed structure for every DM reply: "[repeat the command] ... [world building/description] ... [optional questions] ... [lastly, the new state]" (TASK-0245).
- Operator wants "party list" showing controller, class, level, HP, initiative, active turn (alpha run 2 finding 5).
- Rules stance: "we should be able to attack anyone regardless of combatant state" (reversed a spec rule); "Yes, allow a flinch".

## 3. Milestone plan as written, and progress

Written (milestones.md, re-baselined 2026-10-25): M0 Skeleton (delivered 2026-09-23, 3 wk early); M1 Library (target 10-20; 16/19 done, 3 cards left open); M2 First Scene (4 wk, target 11-24); M3 Table multiplayer (3 wk, 12-15); M4 Codex (4 wk, 2027-01-12); M5 Imported Mechanics (2 wk, 01-26); M6 Maps and Table View (5 wk, 03-02); M7 The Dial = V1 (3 wk, 03-23); M8 Memory and Pacing (3 wk, 04-13); M9 Solo Campaign (sketch, replan at V1).

Progress at 2026-11-06 (from board and git):
- M0 done. M2 done and archived (TASK-0048 Done; demo around 2026-10-27/28 vs target 11-24, so about 4 weeks early).
- M3: 72/131 cards done. It was planned as 6 cards / 3 weeks; it grew about 20x through playtest fixes and doctrine decisions (D14-D20, runbooks A, B, B2). Target 12-15 is probably still reachable for the table, but the scope is no longer the plan's scope.
- M4-M9: 0 of 45 cards done (11, 7, 10, 6, 4, 7). Zero progress on the Codex, maps, table view, generators.
- Board totals: 253 tasks listed; 135 To Do; 2 In Progress (TASK-0186, TASK-0203).
- Git: ~2,600 commits since 2026-09-21; heaviest days 10-26/27, 11-02 (sweeps).
- Observation: ~6 weeks in, all effort has gone into one scene of AI-DM narration quality and its gates. Campaign tooling (G4), VTT, character sheets, human-DM tooling have no code.

## 4. Gaps: what the plan never addresses

Against G1-G4 the current plan has no design for:
- **VTT interaction design.** M6 is a PixiJS grid/tokens/fog plus one adapter; nothing on movement, targeting, measuring, drag/drop, initiative tracker UI, DM-vs-player views, per-viewer fog, or whether to embed an existing VTT. Positions/range are explicitly deferred (TASK-0139, 0239).
- **Campaign creation and prep tools.** M4 has an NPC-smith and an encounter builder and a codex browser. Nothing on storyline/plot structure, session prep, dungeon authoring, loot/item editors, a campaign wizard (M9 "campaign start from a premise" is a sketch card), or co-authoring workflow between human and AI.
- **Generators (donjon-style).** No random tables, dungeon/town/NPC/loot/treasure generators, no campaign-integrated generation beyond "mid-session generation" (TASK-0079).
- **Campaign notebook.** Only an Obsidian export (M6). No in-app notebook, session logs for the human, handouts, journals, player-visible vs DM-only notes.
- **Character sheet UI.** "PC sheets over the engine" is one M4 card (TASK-0058). No character creation/levelling flow, sheet view, inventory, spell management, or import of existing characters.
- **Combat UX.** Combat text/ledger exists; no tactical display, no turn-order/targeting UI, no reaction/opportunity prompts, no life-state display (TASK-0252 added after the 11-06 playtest). Combat is still the weakest part: runbook B combat first-attempt audit pass 43%, B2 71%.
- **NPC conversation UX.** Talk reactions (D19) and attitude (D18) exist as mechanics. No NPC portrait/dialogue panel, relationship view, conversation history per NPC, or social-encounter UI.
- **Human-DM tooling.** M7 "Assisted-DM panel" is one card: no DM screen, screen of secrets/clocks, NPC/monster roster, proposals inbox design, or human-DM play of the same table.
- **Player onboarding, accounts, invites, hosting for strangers** (G2): only invite/redeem and a tailnet-only dev host; the public hosting step has no decision.
- **Long-form memory/continuity** is M8, after V1; G1 depends on it earlier than the plan allows.
- **Cost budget as design input**: median turn 28-39 s and $0.05-0.16/turn, but cost limits are not a plan constraint.

## 5. Playtest lessons (alpha runs 2-3, runbooks A, B, B2; 2026-10-28 to 11-06)

- The engine and ledger are trustworthy: deterministic auditor passed runs 3 and B; opposition DCs, Help, slots, stakes and bands verified live. Dice never get invented. This validates D9/D14/D17.
- **Narration/audit fight dominates the cost and latency.** Combat first-attempt audit pass: 43% (run B) then 71% (B2). Many fallbacks ship terse lines ("X moves next"). Median turn 39 s (B), 28 s (B2); max 89-102 s. Spend per run is small ($2.55, $4.73, $3.30) so cost is not the constraint; latency and feel are.
- **Model-call robustness**: `<think></think>` prefixes, max-token truncation (1200 tokens) caused a showstopper in alpha run 2; schema failures on 17/224 calls (B), 3/141 (B2) after fixes. Provider variance is a standing risk for G1.
- **Silent waits hurt**: 2 min 15 s turn with no indicator; floor passes with no reason; "Outcome: no-effect" on every action card. Players need progress, state and reason visible.
- **State visibility is missing**: no life state, no positions; the operator attacked a dead goblin. The operator ties positions to the VTT.
- **Compound declarations** and Director overreach (reveals or stage changes before dice, undeclared Stealth) needed repeated fixes (0182, 0205, 0237).
- **Companion autonomy** in free mode (Odo acts every beat) and out-of-turn actions (0244) confuse tables.
- **Hard cases keep appearing in combat**: freeing a captive, non-combatant targets, pulling NPCs into the order, ending then resuming a fight (0253), fled combatants keeping turns (0254).
- **Positive**: talk reactions, persuasion/flight/morale as presence changes, 30 s absence and 120 s stall tests, opening scenes naming the party, session return via "Your tables".
- **Process**: each runbook now ships a scenario and a hosted playtest with a ceiling ($50 then $100); the operator has repeatedly called the cost estimates "wildly over compensating" (real weekly spend is low). Playtest evidence cards drive nearly all board growth.
