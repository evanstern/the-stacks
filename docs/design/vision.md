# the-stacks — Vision

**Status:** ratified 2026-09-21 (design session, operator + Claude); **revised 2026-10-25**
(re-centre session, operator + Claude — decision-0009 to decision-0021, session record
doc-0004).
**Companions:** [architecture.md](architecture.md), [milestones.md](milestones.md)

## What this is

the-stacks is a self-hosted, web-based platform for playing D&D 5e with an AI at the table.
The AI can run the game, or it can assist a human DM — the same machinery at two settings of
one autonomy dial (decision-0015). It is a greenfield rebuild: the prior repo
(the-stacks-v1) proved the RAG foundations and is reference reading only — no code carries
forward.

The end goal: a player sits down alone, and an AI DM runs a full campaign for them start to
finish. Since the 2026-10-25 revision the project climbs toward that goal **AI-run first**:
the next milestone is the First Scene, an AI-run vertical slice (decision-0009). Every
subsystem (maps, NPCs, combat, sessions) is designed to be operated by an agent as well as a
human, and the AI-run scene is the hardest customer for all of them.

Two rules carry the design:

- **The server owns the truth.** The session event log is the only source of truth; any
  client, AI DM or external VTT is a projection of it (decision-0013).
- **The script owns the numbers; the AI owns the story.** Dice, HP, slots and conditions
  belong to a coded 5e engine. The AI proposes; a gate decides (decision-0015,
  decision-0021).

## Posture

| Decision | Choice |
|---|---|
| Relationship to v1 | Greenfield, new stack; steal ideas, not code |
| Game systems | **D&D 5e only** (decision-0010). *Supersedes* "system-agnostic content plane; pluggable system modules, 5e first". |
| Rulebooks | BYO — operator imports their own lawful content; D&D Beyond HTML exports are the supported import (decision-0011). We ship only openly licensed SRD data, with attribution; never proprietary content (decision-0012). *Supersedes* "We ship no rulebooks". |
| Rules depth | Structured core: a coded 5e engine owns dice, HP, conditions, initiative, death saves, rests and slots, over an SRD 5.2.1 baseline; other effects resolve via AI adjudication with citations (decision-0012, decision-0017) |
| AI role | One autonomy dial: the AI runs the game (`auto`) or assists a human DM (`ask`, `suggest`) through one proposal gate (decision-0015) |
| Maps and VTT | Structured-first map generation; our server owns state; own in-app table view plus adapters to external VTTs (Foundry or Owlbear live; Fantasy Grounds and Atlas as export targets); codex export to an Obsidian vault (decision-0013). *Supersedes* "own minimal VTT in-app". |
| Next milestone | **First Scene**: one player plus AI companions play an AI-run scene to its end (decision-0009, decision-0014) |
| V1 release target | **The Dial**: both ends of the autonomy dial ship — an AI-run table and an AI-assisted human DM — multiplayer, with codex and maps (milestones.md M7). *Supersedes* "Assisted table: humans initiate every action". |
| End goal ladder | First Scene → multiplayer table → codex → imported mechanics → maps and table view → V1 → memory and pacing → solo campaign. *Supersedes* the 2026-09-21 ladder (assisted V1 first, auto-DM after). |
| Audience | Public self-hosters (real open-source project, docker compose up) |
| Hosting | Self-hosted via Docker containers, single-tenant |
| LLM strategy | BYO model access through a provider-agnostic gateway (decision-0007); local models arrive as config behind the same seam |
| Image generation | Maps and portraits both, behind an image-provider seam |
| Interface | Web; chat-based table with talk and actions as distinct messages (decision-0016) |
| Cadence | Aggressive push: near-daily involvement, parallel sweep lanes, milestones every 2–4 weeks |

## Use cases

The operator's five goals, unchanged in substance; their order of delivery changed on
2026-10-25.

1. **Grounded rules Q&A** — As a DM or player, I ask a rules question and get an answer
   grounded in my imported books, with durable citations I can verify. *(Built in M1.)* The
   AI DM uses the same retrieval when it adjudicates.
2. **Campaign management** — As a DM, I manage a campaign: locations, encounters, player
   characters, NPCs (sheets, descriptions, mannerisms), maps. I create content with AI
   assistance, grounded in my campaign and books. Every creation is complete enough that an
   agent can load it and play it in character: content is data with a contract, not prose.
   I can export my campaign to an Obsidian vault.
3. **The AI runs the game** — As a player, an AI DM runs a scene, and eventually a whole
   campaign, for me: narration, NPCs, rulings, combat, pacing, memory. The engine rolls; the
   AI never invents a number. AI companions can fill out a small party. *(First slice: M2.)*
4. **The AI assists a human DM** — As a DM, I run the game myself with the AI at my elbow:
   it proposes rulings, NPC lines, encounters and maps, and I approve, edit or ignore each
   proposal. It is the same pipeline as use case 3 with approval switched on.
5. **Multiplayer** — As a table, several of us play together through the app, with an AI
   DM or a human one. Players talk freely; an action happens only when it is committed, by
   the right person for the table's mode. *(M3.)*

## Non-goals

- Shipping, scraping, or bundling any proprietary rulebook content. (Openly licensed SRD
  data with its required attribution is not proprietary content — decision-0012.)
- Game systems other than D&D 5e (decision-0010).
- An external VTT as the source of truth. External VTTs are projections through adapters
  (decision-0013).
- A full rules engine encoding every spell and ability as code. The engine owns the numbers;
  effects beyond its primitives resolve by cited adjudication.
- Multi-tenant hosted service. It stays a non-goal until a decision record changes it.
- SEO / public content pages — this is an authenticated app.
- Mobile-native apps. Responsive web only.
