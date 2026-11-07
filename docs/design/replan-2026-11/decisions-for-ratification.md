# Decisions for ratification

**Replan 2026-11, Synthesis.** Date 2026-11-07. Ratified at checkpoint **CP-1** ([plan-of-action.md](plan-of-action.md) §7).
**Reads with:** [research/decisions-digest.md](research/decisions-digest.md), [wishlist.md](wishlist.md), [target-architecture.md](target-architecture.md).

The operator was asleep during synthesis. Every open choice below is a recommendation, not a ruling. On ratification, each accepted P-nn becomes a decision record under `backlog/decisions/` (next free id) and the superseded records get a "superseded by" line.

## Summary

| Id | Question | Recommendation | Supersedes / amends | Ruling |
|---|---|---|---|---|
| P-01 | How do the four goals order? | Co-equal; ladder by shared foundations | supersedes 0009; vision "End goal ladder" | |
| P-02 | VTT posture (VTT decision 1) | Hybrid, build-led | refines 0013 | |
| P-03 | Map: accessory or peer surface? | Peer surface; zone view always, board docked at ≥1440 px | amends mud-ux "Margin" | |
| P-04 | Quiet ring everywhere? (table-UX item) | Exploration only; explicit turns in combat | amends 0028; retires 0016 residue | |
| P-05 | Board renderer (VTT decision 2) | PixiJS v8, client-only route | confirms A1 | |
| P-06 | Grid policy (VTT decision 4) | Square only; SRD 5.2.1 movement; token-method AoE | new | |
| P-07 | Adapter trigger (VTT decision 3) | Trigger-gated; Foundry first | amends 0013 (M6 adapter) | |
| P-08 | Typed Intent + deterministic planner | Adopt; one vocabulary for every surface and both DMs | amends 0017, 0016 | |
| P-09 | Spatial model | Zones first; grid is a finer resolution of one model; positions in the engine | new; closes TASK-0139 trigger | |
| P-10 | Codex model | Generic entity + typed payload, typed links, block visibility, reveal-as-event, versions with provenance | refines A3/A5, 0026 | |
| P-11 | Campaign, table and session records | Add first-class rows | amends decision-1 (implicit tables) | |
| P-12 | Narration: audit after, or render around facts? | Render around a fact sheet; retire the regenerate/fallback audit loop | amends 0017, 0025 | |
| P-13 | Memory model | Typed state for play facts; retrieval for recall; projection snapshots | amends 0026 (scope), M8 timing | |
| P-14 | Latency as a product requirement | Fact rows < 1 s p95; first narration token < 10 s p50 | new | |
| P-15 | Repo and package splits | Publish `dnd5e-engine` + `srd` at R8; no other split | amends 0010 boundary | |
| P-16 | Carding depth | Epics for all milestones; deliverable cards only for the next two | amends 0020 | |
| P-17 | Generators | Hybrid (code skeleton, LLM flesh, code validate); drafts through the gate as prep-time proposals | extends 0015 | |
| P-18 | LangGraph | Stay on plain async nodes; close the revisit | confirms 0019; closes TASK-0054 | |
| P-19 | Stack | Keep; add PixiJS only | confirms decision-1 item 1, 0008 | |
| P-20 | Milestone ladder | R1–R8 replace m-1…m-9 | supersedes milestones.md ladder | |
| P-21 | Imported mechanics (old M5) | Defer to Later | amends 0012 (M5 timing) | |

## Detail

### P-01 — Co-equal goals, foundations-first ladder

- **Question:** keep decision-0009's AI-run-first ladder, or re-order?
- **Options:** (a) keep AI-first; (b) put the human table first; (c) co-equal goals, sequence by shared foundations.
- **Recommendation:** (c).
- **Rationale:** six weeks of AI-first produced one scene of narration quality and zero code for codex, sheets, VTT, generators or human-DM tooling (digest §3). The brief makes G2 co-equal. Every goal rests on the same five foundations, so ordering by foundation serves all four at once.
- **Unblocks:** the R1–R8 ladder (P-20); the rework map.

### P-02 — VTT posture (VTT research decision 1)

- **Question:** build, embed, adapter only, or hybrid?
- **Options:** build (58/65), embed (27–31), adapter only (31), hybrid (59) (vtt-research §6).
- **Recommendation:** Hybrid, build-led. Own board as a projection of the log; UVTT export; one adapter trigger-gated (P-07).
- **Rationale:** no external VTT withholds hidden tokens from player clients; no embeddable VTT has a usable licence and a matching state model; AI-operability needs our own command vocabulary.
- **Unblocks:** TASK-0068–0070 rewrite, N-26, N-27.

### P-03 — Map as a peer surface

- **Question:** mud-ux ruled "Margin": text owns the width and the map is a slide-out accessory. Keep that?
- **Options:** (a) keep accessory; (b) board-first layout (mud-ux option D); (c) peer surface: the zone view is always available, the board docks at ≥1440 px and slides out below, text stays the record.
- **Recommendation:** (c). Keep the Margin layout, the stream, click-to-draft and text parity.
- **Rationale:** G3 asks for VTT play as first-class. The operator's playtest finding ("where any character is in relation to another… will come with the VTT") expects positions to be visible, not hidden in a drawer. Docking only at wide widths preserves the Margin design below 1440 px.
- **Unblocks:** TASK-0070 rewrite; CP-13 board design round.

### P-04 — Quiet ring for exploration only (table-UX item)

- **Question:** decision-0028 makes every deed wait for a 10 s quiet ring and a 👍. Keep it for all play?
- **Options:** (a) keep everywhere; (b) drop it; (c) exploration and social play keep the quiet ring; combat uses explicit turns and commits the active player's Intent on Enter; human-DM tables may turn the ring off.
- **Recommendation:** (c).
- **Rationale:** players leave at 30 s waits (table-ux §1). A ring plus a model call on every combat action cannot meet P-14. The ring stays valuable where players talk freely before acting.
- **Unblocks:** TASK-0199 rewrite (spec 066 amendment); N-10.

### P-05 — Board renderer (VTT research decision 2)

- **Options:** PixiJS v8; SVG for V1 (zero deps, best accessibility, rewrite risk at lighting).
- **Recommendation:** PixiJS v8 in a client-only route; all geometry in the renderer-free `@stacks/space` package so the renderer stays swappable.
- **Rationale:** fog compositing and lighting arrive in R5; SVG would be rewritten there. Text parity carries accessibility.
- **Unblocks:** TASK-0070.

### P-06 — Grid policy (VTT research decision 4)

- **Recommendation:** square grid only; SRD 5.2.1 movement (every square 1, difficult terrain 2, no corner cutting past walls); AoE by the token method (a square is hit if the template covers any part of it), documented in `@stacks/space`. Zone mode uses target-count caps.
- **Rationale:** no 5e rule needs hexes; one documented convention lets the engine, not the renderer, decide who is hit.
- **Unblocks:** N-27, TASK-0227.

### P-07 — Adapter trigger (VTT research decision 3)

- **Options:** keep TASK-0072 scheduled; trigger-gate it.
- **Recommendation:** trigger-gate. Trigger: a named table or issue asks for it, or an R5 playtest shows a group refusing to leave its VTT. Foundry first. Review at CP-15.
- **Rationale:** an adapter costs per-VTT upkeep and serves no MVP goal.
- **Unblocks:** removes TASK-0072 from the critical path.

### P-08 — Typed Intent vocabulary and deterministic planner

- **Question:** keep free text as the only player write, re-parsed by LLM nodes?
- **Options:** (a) keep; (b) add buttons that send English text; (c) one typed Intent set produced by every surface and both DM seats, planned deterministically.
- **Recommendation:** (c). Contract in target-architecture §2. Frozen at CP-4.
- **Rationale:** the only write today is `action.declare {text}` (audit §3.2); a button has nowhere to go but an LLM. Prompt churn (narrate-v21, audit-v16) is the signature of an LLM doing deterministic work. Fixing the contract first lets Table, Sheet, Board and Console lanes run in parallel.
- **Unblocks:** N-01–N-04 and every surface lane.

### P-09 — Spatial model: zones first

- **Recommendation:** positions enter engine state as zone membership with optional squares; range bands without a grid; one model at two resolutions (target-architecture §3).
- **Rationale:** area spells (0227), objects as targets (0201), life and position visibility (0252) and the board all block on positions. Zones unblock text combat in R1 without waiting for a map.
- **Unblocks:** N-05, N-06, TASK-0227.

### P-10 — Codex model

- **Recommendation:** generic entity base + typed payload; typed links and containment; visibility per block (`dm` / `party` / `pc:<id>[]`); reveal is an `info.revealed` event; append-only versions with author, source and draft/curated status (target-architecture §4). Frozen at CP-6.
- **Rationale:** the field converges on this (Kanka base model, World Anvil block secrets); decision-0026 already ratified reveal-as-event; provenance makes human/AI co-authoring auditable.
- **Unblocks:** TASK-0056, 0057, 0059, 0060 and all of R2, R4, R6.

### P-11 — Campaign, table and session records

- **Recommendation:** add `campaigns`, `tables`, `sessions` tables; a session covers a seq range of the log.
- **Rationale:** G1 needs a campaign across sessions; `routes/tables.ts` scans events today (audit §3.3).
- **Unblocks:** N-14, N-15, TASK-0084.

### P-12 — Narration around facts

- **Question:** keep generating free prose and auditing it (regenerate, then fallback)?
- **Options:** (a) keep and tune; (b) render facts in code and let the model write prose slots around a fact sheet; the audit becomes a leak and contradiction check whose failure appends a correction.
- **Recommendation:** (b). Decision-0025's gates stay where they guard state (plan legality moves into the planner); the prose-policing half retires.
- **Rationale:** combat first-attempt audit pass was 43% then 71% after many fixes; fallback lines read badly; median turns are 28–39 s. Nine open cards (0200, 0221, 0233, 0255, 0257, 0111, 0144, 0146, 0174) are symptoms.
- **Unblocks:** N-07; closes those nine cards.

### P-13 — Memory model

- **Recommendation:** typed state (knowledge ledger, attitude, clocks) for anything that changes play; hybrid retrieval over chronicle and notebook for recall; projection snapshots so load cost stays flat.
- **Rationale:** the gate replays from seq 0 per attempt and `assemble` reads 20 lines (audit §3.4). Snapshots are needed in R2, long before full memory in R7.
- **Unblocks:** N-15 (R2), TASK-0083 (R7).

### P-14 — Latency as a product requirement

- **Recommendation:** fact rows p95 < 1 s from confirmed Intent; first narration token p50 < 10 s; a 4v4 round < 60 s wall time. These are R1 exit criteria and constitution-level.
- **Rationale:** cost is not the constraint ($2.55–$4.73 per run); latency and feel are (digest §5).
- **Unblocks:** R1 exit gate; constitution rewrite (CP-2).

### P-15 — Repo and package splits

- **Options:** split now; publish at release; never.
- **Recommendation:** keep everything in the monorepo; publish `dnd5e-engine` and `srd` to npm at R8; a Foundry adapter repo only if P-07 fires.
- **Rationale:** the engine is the most separable asset (audit §5) but its schema grows with positions through R5; publishing earlier would freeze it too soon.
- **Unblocks:** N-32.

### P-16 — Card just-in-time

- **Question:** decision-0020 cards every known milestone up front. Keep that depth?
- **Recommendation:** keep the principle (no unplanned "for now"; every deferral is a card with a trigger). Amend the depth: every milestone has one epic; deliverable cards for the next two milestones carry full acceptance criteria; later deliverables are stub cards (title, outcome, milestone, dependencies) that get criteria at their milestone's planning.
- **Rationale:** full up-front carding grew the board to 253 cards against ~50 planned; most later cards needed rewriting by this replan.
- **Unblocks:** the rework map shape.

### P-17 — Generators and prep-time proposals

- **Recommendation:** every generator is hybrid: seeded code skeleton, LLM flesh, code validation, output as a draft version through the gate. Policy `ask` for a human DM, `auto` for an AI-only campaign. The LLM never writes CR, XP, HP, AC, DC or gp.
- **Rationale:** procedural tools are campaign-blind; LLM tools invent numbers; the hybrid matches "the script owns the numbers" (campaign-tools §3).
- **Unblocks:** N-28–N-30, TASK-0061, 0062.

### P-18 — LangGraph

- **Recommendation:** stay on plain async nodes. Close TASK-0054.
- **Rationale:** the planner removes most branching from the DM runtime; generators are linear pipelines. A graph framework adds a dependency for what a few functions do.
- **Unblocks:** removes 0054 from the R6 path.

### P-19 — Stack

- **Recommendation:** keep Node 22, Hono, ws, Postgres + pgvector, Drizzle, Zod, React 19, React Router 8, Tailwind, Radix. Add PixiJS v8 for the board only. Decision-0008 stays (SSR shell; play and board routes client-only). Decision-1 item 1 stays.
- **Rationale:** every gap is a model problem, not a framework problem (audit §6).

### P-20 — Milestone ladder

- **Recommendation:** R1 Fast Table, R2 Living Codex, R3 Human Table, R4 Notebook (MVP), R5 The Board, R6 Generators, R7 Campaign Memory, R8 Release 1.0. Archive m-1…m-9 at CP-3.
- **Unblocks:** CP-3.

### P-21 — Imported mechanics

- **Recommendation:** defer TASK-0064–0067 to Later with a trigger: the SRD monster list blocks a generator or a playtest.
- **Rationale:** low goal relevance; SRD 5.2.1 covers MVP and V1 content. Decision-0011 and 0012 stand otherwise.

## Decisions confirmed unchanged

0002–0007, 0010, 0011, 0014, 0015 (extended by P-17), 0018 (Director constrained by the planner), 0021, 0022, 0023, 0024, 0026, 0027; chat-ui decision (Daylight, slide-out panel, no modals).
