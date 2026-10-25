---
id: doc-0004
title: Design re-centre 2026-10-25 — session record
type: specification
created_date: '2026-10-25 20:02'
updated_date: '2026-10-25 20:02'
tags:
  - design
  - decisions
  - m-2
---
# Design re-centre 2026-10-25 — session record

Status: **ratified 2026-10-25.** Every decision below was made by the operator in the session.
Each backs one decision record (decision-0009 … decision-0021). TASK-0041 carries the
revision of the design documents and the constitution.

## Participants

- The operator (Evan Stern) — made every decision.
- Claude (orchestrator session, Opus) — ran the session and wrote the handoff brief.
- Claude (opus-implementer, TASK-0041) — recorded the decisions and revised the documents.

## Inputs

### tabletop-dm study

github.com/bradbushSFAI/tabletop-dm, MIT, studied at commit fe2c29b. One Claude skill plus a
Python engine (`skills/tabletop-dm/scripts/dmlib/`), SRD 5.1 data under CC-BY-4.0. Solo hero
plus up to two DM-played companions; no maps, no multiplayer.

Why it plays well:
- **A hard ownership split.** The script owns dice, HP, slots, gold, XP, conditions,
  initiative, rests, death saves and the roll log. The LLM owns story, rulings and DCs, and
  never invents a roll or does arithmetic. The engine refuses illegal moves with an error
  code before any write.
- **DM craft as right/wrong pairs.** About 100-word turns ending on a demand for action; no
  option menus; never move or feel for the hero; roll only when the outcome is uncertain,
  failure is interesting and trying costs something; four fail-forward modes; every NPC gets
  a voice, a want and one specific detail.

Its gaps, already covered by our design: free-markdown world state (we have codex
contracts, A5); solo only and honour-system spoilers (we have a multiplayer event log with
server-enforced visibility); 44 monsters and 43 spells (we have imported books plus cited
retrieval); conditions and monster turns left to the LLM (we have a coded engine); no check
that narration matches dice (fixed by pipeline ordering, decision-0017).

The facts above come from the session's study and were not re-verified by the implementer.

### VTT integration research

Some items are unverified; they are marked.

- **Fantasy Grounds Unity:** least integrable. Closed client; sandboxed Lua 5.1 extensions
  with no documented network or file I/O; `db.xml` is safe to edit only while FG is closed.
  The only known Claude bridge tails `chatlog.html` read-only with a human pasting replies.
  Reportedly free-to-play since November 2025 (**unverified**). Realistic only as a
  prep/export target.
- **Atlas VTT:** AGPL-3.0, pre-1.0, single maintainer, runs as an Obsidian plugin. No API;
  `.atlasmap` schema undocumented; remote play through a closed-beta hosted relay. Export
  target only. Its appeal (Obsidian as the management surface) is met by exporting the codex
  to an Obsidian vault.
- **Foundry VTT:** most integrable (document API, module system, sockets). A small module can
  hold a WebSocket to our server.
- **Owlbear Rodeo:** clean SDK; maps and tokens only.
- **Verdict:** no VTT can hold authoritative state for an AI DM. Our server stays the source
  of truth; any VTT is a projection through an adapter.

### Facts verified during recording (2026-10-25)

- SRD 5.2.1 is licensed CC-BY-4.0 and its Legal Information page gives one exact attribution
  statement (SRD_CC_v5.2.1.pdf, page 1; dndbeyond.com/srd).
- LangGraph.js: `StateGraph` and `interrupt()` come from `@langchain/langgraph`;
  `interrupt()` needs a checkpointer and a `thread_id`; `@langchain/langgraph` 1.5.2 and
  `@langchain/langgraph-checkpoint-postgres` 1.1.2 both list `@langchain/core` as a peer
  dependency.

## Decisions

| Id | Session id | Decision |
|---|---|---|
| decision-0009 | D1 | First Scene (AI-run vertical slice) is the next milestone, ahead of the Codex |
| decision-0010 | D2 | 5e only; drop the system-agnostic core and the Fate conformance module |
| decision-0011 | D3 | BYO books; D&D Beyond HTML exports are the supported import |
| decision-0012 | D4 | SRD 5.2.1 structured baseline with attribution; extraction from imports later |
| decision-0013 | D5 | Our server owns state; own table view plus VTT adapters; Obsidian vault export |
| decision-0014 | D6 | Solo plus AI companions first; multi-actor protocol from day 1 |
| decision-0015 | D7 | Proposal gate and autonomy dial: auto, ask, suggest |
| decision-0016 | D8 | Talk versus action; action lifecycle; table modes and commit authority |
| decision-0017 | D9 | Four-layer runtime; turn pipeline; ordering is the anti-cheat |
| decision-0018 | D10 | The Director is its own node from day 1 |
| decision-0019 | D11 | No LangGraph now; revisit on a named trigger |
| decision-0020 | D12 | No unplanned "for now" deferrals |
| decision-0021 | D13 | Seven ideas adopted from tabletop-dm; two parked |

Superseded by this session: decision-1 items 2 and 3; architecture A6, the table part of A8,
and A7's "agents as tool-loops" for the DM; constitution Principle VI (and VIII amended,
IV reworded) in constitution 2.0.0; vision's "we ship no rulebooks", "own minimal VTT in-app"
and V1 definition.

## Board

- Milestones m-2 to m-9 (M2 First Scene through M9 Solo Campaign).
- M2 First Scene: TASK-0042 (engine), TASK-0043 (SRD data), TASK-0044 (session model),
  TASK-0045 (gate), TASK-0046 (DM runtime), TASK-0047 (play route), TASK-0048 (playtest and
  demo).
- M3 The Table: TASK-0049 (group sign-off), TASK-0050 (floor passing), TASK-0051 (presence),
  TASK-0052 (narrator chime-in), TASK-0053 (multi-human demo).
- Revisit cards: TASK-0054 (LangGraph, trigger in decision-0019), TASK-0055 (parked combat
  rules, after TASK-0048).

## Open follow-ups

- Choose the first live VTT adapter (Foundry or Owlbear) in M6.
- Choose the SRD 5.2.1 data source (transcription or an existing CC-BY dataset) in
  TASK-0043's spec.
- Decide how presence is carried (TASK-0051); the WebSocket frame shapes are a frozen
  contract.
- Card M4 to M9 at each preceding milestone's close (decision-0020).
- Re-pin the grounding wiki after this revision merges: `docs/wiki/overview.md` lists
  architecture.md and milestones.md as sources.
