# the-stacks — Vision

**Status:** ratified 2026-09-21 (design session, operator + Claude)
**Companions:** [architecture.md](architecture.md), [milestones.md](milestones.md)

## What this is

the-stacks is a self-hosted, web-based TTRPG platform that climbs a ladder from
**DM copilot** to **fully automated DM**. It is a greenfield rebuild: the prior
repo (the-stacks-v1) proved the RAG foundations and is reference reading only —
no code carries forward.

The end goal: a player sits down alone, and an AI DM runs a full campaign for
them start to finish. Everything before that milestone is built so that the
auto-DM can eventually drive it: every subsystem (maps, NPCs, combat, sessions)
is designed to be operated by an agent as well as a human.

## Posture

| Decision | Choice |
|---|---|
| Relationship to v1 | Greenfield, new stack; steal ideas, not code |
| V1 release target | **Assisted table**: human DM runs real multiplayer sessions with AI assistance |
| End goal (post-V1) | Auto-DM runs a full solo campaign |
| Audience | Public self-hosters (real open-source project, docker compose up) |
| Hosting | Self-hosted via Docker containers, single-tenant |
| LLM strategy | BYO cloud API key (Anthropic first); local models deferred behind a seam |
| Rulebooks | BYO — operator imports their own lawful content (D&D Beyond HTML exports first). We ship no rulebooks. |
| Rules depth | Structured core: coded combat loop (initiative, HP, dice, conditions); spells/abilities resolve via AI + citations |
| Game systems | System-agnostic content plane; pluggable system modules, 5e first (see architecture A6) |
| Maps | Structured-first generation; own minimal VTT in-app |
| Image generation | Core for V1: maps and portraits both |
| Interface | Web, chat-based for most features |
| Cadence | Aggressive push: near-daily involvement, parallel sweep lanes, milestones every 2–4 weeks |

## Use cases

### V1 (assisted table)

1. **Grounded rules Q&A** — As a DM, I ask a rules question and get an answer
   grounded in my imported books, with durable citations I can verify.
2. **Campaign management** — As a DM, I manage a campaign: maps, locations,
   encounters, player characters, NPCs — including sheets, descriptions, and
   mannerisms.
3. **AI-assisted creation** — As a DM, I create new NPCs (and locations,
   encounters, items) with AI assistance, grounded in my campaign and books.
4. **Agent-loadable content** — As a user, every AI creation is complete enough
   that an agent can load it and generate further content in-character and
   in-world. Content is data with a contract, not prose blobs.
5. **VTT-usable map generation** — As a DM, I generate battle maps dynamically
   that work on a virtual tabletop: grid-aligned, with walls and doors the fog
   and line-of-sight systems understand.
6. **Assisted multiplayer play** — As a table, we play a full D&D session in
   multiplayer through the app. The human DM runs the game with AI assistance
   for maps, NPCs, rules lookups, and improvisation. Humans initiate every
   action.

### Post-V1 (the automaton)

7. **Auto-DM** — As a player, an automated DM runs a full campaign for me from
   start to finish: narration, NPCs, combat, maps, pacing, memory.

## Non-goals

- Shipping, scraping, or bundling any proprietary rulebook content.
- Multi-tenant hosted service (plausible someday; not designed for now).
- Full rules engine encoding every spell and ability as code.
- SEO / public content pages — this is an authenticated app.
- Mobile-native apps. Responsive web only.
