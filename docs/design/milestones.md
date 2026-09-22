# the-stacks — Milestones 0 → V1

**Status:** ratified 2026-09-21 (design session, operator + Claude) — shape and order approved as proposed
**Companions:** [vision.md](vision.md), [architecture.md](architecture.md)
**Cadence assumption:** aggressive push — near-daily operator involvement,
parallel sweep lanes, a milestone lands every 2–4 weeks.

Each milestone is a demoable state, maps to a set of board TASKs (one PR
each), and ends with a re-grounding pass. Dates are targets, not promises.

## M0 — Skeleton (2 wk, target mid-Oct 2026)

Walking skeleton proving every seam: monorepo, compose stack (app + db),
session auth (operator + invited players), one REST route, one WebSocket
echo into a Postgres event log and back out, CI (lint, typecheck, test,
build, boundary check). **Demo:** two browsers sign in; a message from one
appears in the other via the event log.

## M1 — The Library (3 wk, target early Nov 2026)

Ingestion + grounded Q&A. D&D Beyond HTML parser, generic HTML/MD fallback,
chunking, embeddings, hybrid retrieval, citations with source anchors, chat
UI with streaming answers, retrieval eval fixtures in CI. **Demo:** import
your PHB export, ask "how does grappling work," get a cited answer you can
click through to the source passage.

## M2 — The Codex (3 wk, target late Nov 2026)

Campaign content plane. Campaign CRUD; entity types NPC / PC / location /
encounter / item with content contracts (identity, portrayal, hooks); typed
links between entities; the NPC-smith agent (AI-assisted creation grounded
in library + campaign); portrayal-completeness lint; codex browser UI.
**Demo:** create a campaign, ask for "a corrupt harbormaster with a debt,"
get a complete, linked, editable NPC; agent then writes a letter in his voice.

## M3 — Sheets & Systems (3 wk, target mid-Dec 2026)

System-module interface extracted against real load: 5e module (full sheet,
d20 resolution, dice roller, conditions, initiative math) + Fate Condensed
conformance module (interface depth only); conformance suite in CI; sheet UI
rendered from module schema. **Demo:** the same codex hosts a 5e fighter and
a Fate character; both sheets render; both systems roll.

## M4 — The Table (4 wk, target mid-Jan 2027)

Realtime play, no map yet. Session lifecycle (schedule, join, run, end);
event-sourced session log; chat with in-character/OOC lanes; dice in chat
via system module; initiative tracker; HP/condition tracking; visibility
(DM-only events); reconnect/replay. **Demo:** three browsers — DM + two
players — run theater-of-the-mind combat end to end.

## M5 — Maps & Media (4 wk, target mid-Feb 2027)

Map-planner agent → MapPlan JSON → deterministic tile renderer; PixiJS
tabletop: grid, tokens, fog of war, walls blocking reveal; token movement as
session events; Universal VTT export; portrait generation for codex
entities via image-provider seam. **Demo:** "a smugglers' cave, 30×40" →
playable map in the session; move tokens, reveal fog; export to Foundry;
NPC gets a portrait.

## M6 — The Assisted Table = V1 (3 wk, target mid-Mar 2027)

AI at the human DM's elbow, humans initiate everything. DM assist panel in
session: rules lookups with citations in context, NPC improvisation (speak
as any codex NPC), on-the-fly encounter/NPC/map generation mid-session;
suggestion-only mode (AI proposes, DM applies as events). Self-host polish:
docs, compose quickstart, backup/restore, versioned migrations. **Release:**
tagged V1, public README, demo video.

## Post-V1 — the road to the automaton (sketch, re-planned at V1)

- **M7 Solo scene:** auto-DM runs a single bounded encounter for one player —
  narration, NPC dialogue, structured combat via the same event API.
- **M8 Memory & pacing:** campaign memory (summarization projections of the
  event log), scene framing, session-to-session continuity.
- **M9 Solo campaign:** the SUPER DUPER END GOAL — full campaign, start to
  finish, auto-DM. V1's assisted table becomes the fallback when the
  automaton is out of its depth.

## Standing risks

| Risk | Mitigation |
|---|---|
| Map gen quality disappoints | Structured-first keeps maps *correct*; style is iterable. UVTT export gives value even if our renderer lags. |
| System-agnostic tax stalls 5e depth | Fate module is interface-depth only; 5e is the product. If the interface fights us in M3, descope Fate to post-V1 by decision record. |
| Event-log schema churn | Events are versioned from day one; projections tolerate unknown types. |
| D&D Beyond export format shifts | Parser is fixture-tested; fixtures captured from real exports; generic HTML fallback always works. |
| Aggressive cadence slips | Milestones are demo-gated, not date-gated; dates re-baselined at each milestone close. |
