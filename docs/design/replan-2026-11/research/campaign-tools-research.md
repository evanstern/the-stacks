# Research: campaign creation tools, generators and the notebook

**Phase:** Replan 2026-11, Discovery. **Serves end goal 4** (brief.md): generators, a
campaign notebook, editors; human DM and AI co-author. **Date:** 2026-11-06.
**Status:** research, not a decision. Vendor claims are marked as such.

Current repo context: no codex exists yet. The M4 "Codex" cards (TASK-0056 to TASK-0063 in
`docs/design/milestones.md`) plan content contracts, versioned storage with typed links, a
browser UI, DM runtime reads, an NPC-smith and an encounter-builder agent. decision-0026
(D18) already requires stable ids on `knows`/`secrets`/`clues` and an `info.revealed` fact
before player-facing text may state a DM-only item. That doctrine is the strongest existing
anchor for this research.

---

## 1. Landscape

| Tool | Does well | Does badly / gap for us | Sources |
|---|---|---|---|
| **donjon** | Fast, seedable procedural generators: 5e dungeon (motif, size, corridors, stairs, seed), encounter + treasure from party size/level/difficulty/environment, five-room dungeon (entrance, puzzle, trick, conflict, reward). | Stateless: knows nothing about your campaign. Output is HTML/image, not data you can load. Code sample is CC BY-NC 3.0 (cannot ship in an MIT/permissive self-hosted product). | [donjon 5e](https://donjon.bin.sh/5e/), [dungeon](https://donjon.bin.sh/5e/dungeon/), [5-room](https://donjon.bin.sh/5e/5_room/), [random](https://donjon.bin.sh/5e/random/), [code licence](https://donjon.bin.sh/code/dungeon/) |
| **Kanka** | ~20 typed entity kinds over one generic `entity` base (entity_type + child_id); @-mention links; relations with attitude, colour, mirroring and private flag; layered permissions (campaign role, entity, entity element); "View as" a member; API and Foundry module. | Permissions UI degrades past 10 members; no multi-party-in-one-world; no generators; content is prose with attributes, not playable data. | [features](https://kanka.io/features), [entities API](https://app.kanka.io/api-docs/1.0/entities), [permissions](https://docs.kanka.io/en/latest/_sources/features/permissions.md.txt), [relations 1.15](https://blog.kanka.io/2021/07/26/how-to-use-references-kanka/), [kanka-foundry](https://github.com/owlchester/kanka-foundry) |
| **World Anvil** | Inline **secrets** as separate embeddable objects; **subscriber groups** gate articles and secrets per party or per player; Campaign Manager with plots; Discord webhooks per group. | Heavy, writer-oriented; "organizing secrets is the hard part" (user comment); not a VTT; private worlds paywalled. | [secrets](https://www.worldanvil.com/w/WorldAnvilCodex/a/secrets), [subscribers](https://www.worldanvil.com/w/WorldAnvilCodex/a/subscribers), [secrets workflow](https://www.worldanvil.com/learn/workflows/secrets-workflow), [Loreteller guide](https://loreteller.com/learn/world-anvil-secrets-guide/), [FAQ](https://www.worldanvil.com/faq) |
| **LegendKeeper** | Fast wiki: @-mentions, auto-linking, templates, `/secret` blocks hidden from players inside a public page; pin-level hide/reveal on nested maps; since 0.12 every element holds any number of tabs (page, map, board). | No mechanics or stat data; no generators; per-user secret reveal was "coming soon" (unverified). | [features](https://www.legendkeeper.com/features/), [0.9 Hydra](https://www.legendkeeper.com/changelog/legendkeeper-0-9-0-0-hydra/), [0.12](https://www.legendkeeper.com/changelog/legendkeeper-0-12-0-0/) |
| **Obsidian + TTRPG plugins** | Local Markdown files; backlinks and graph for free; Fantasy Statblocks renders statblocks from YAML and keeps a creature bestiary; Initiative Tracker reads an `encounter` code block, computes XP, runs combat; Dice Roller does random tables; Leaflet does maps and travel distance. The model: **content is text plus fenced structured blocks.** | Structure is convention, not schema; no visibility model (it is a single-user vault); no multiplayer. | [Fantasy Statblocks](https://github.com/LiamSwayne/fantasy-statblocks-obsidian), [Initiative Tracker](https://github.com/Obsidian-TTRPG-Community/initiative-tracker), [Obsidian Hub TTRPG](https://publish.obsidian.md/hub/02+-+Community+Expansions/02.01+Plugins+by+Category/Plugins+for+TTRPG) |
| **Notion templates** | Relational databases: NPCs, Locations, Sessions, Loot linked by relation fields (e.g. Treasure → Session found). Sly Flourish uses one database plus tags, linked by @-mentions. | Flat tables become "a prettier Google Doc" without links (Minva's warning); no visibility split; no play. | [Notion template](https://www.notion.com/templates/dnd-campaign-onepage), [Sly Flourish on Notion](https://slyflourish.com/lazy_dnd_with_notion.html), [Minva guide](https://minvarpg.com/blogs/ttrpg/notion-dnd-campaign-planner) |
| **Foundry VTT journals/compendia** | Per-document ownership levels NONE / LIMITED / OBSERVER / OWNER, and **per-page ownership** so one journal holds a public page and a GM page; compendium packs as reusable content libraries with their own ownership. | Visibility is coarse (per page, not per sentence); LIMITED-in-compendium bug reported; journals are rich text, not playable data. | [journals](https://foundryvtt.com/article/journal/), [compendium](https://foundryvtt.com/article/compendium/), [issue #9318](https://github.com/foundryvtt/foundryvtt/issues/9318), [issue #9477](https://github.com/foundryvtt/foundryvtt/issues/9477) |
| **Alchemy RPG** | Atmosphere-first: scenes with music, ambient sound, animated backdrops; theatre of the mind first, map second; integrated purchasable adventures. | Light combat tooling; cannot use WotC non-SRD content. Lesson: **the scene is a unit of prep and of presentation.** | [StartPlaying guide](https://startplaying.games/blog/virtual-table-tops/the-new-players-guide-to-alchemy-rpg), [Churape review 2025](https://churapereviews.com/2025/04/11/why-alchemy-rpg-is-the-best-virtual-tabletop-for-storytelling/) |
| **D&D Beyond encounters/Maps** | Maps VTT computes 2024 DMG difficulty (Low/Moderate/High) live as tokens are added; prepared encounters stored per campaign; hidden monsters stay off the player tracker. | Old Encounter Builder is 2014 math and disconnected from Maps (double entry). Lesson: **one encounter record, prep and play.** | [DDB combat tracking](https://www.dndbeyond.com/posts/1841-roll-for-initiative-combat-tracking-comes-to-the), [support](https://dndbeyond-support.wizards.com/hc/en-us/articles/46385529638164-Combat-Encounters-on-Maps), [forum](https://www.dndbeyond.com/forums/d-d-beyond-general/d-d-beyond-feedback/230197-encounters-or-maps) |
| **Kobold Fight Club / Kobold+** | The reference encounter builder: party → budget → filter monsters by CR/environment → random fill; strategies for 2014, 2024 and Flee, Mortals!. Original KFC broke in late 2024 (Sheets API). | Stateless; no campaign link. | [koboldplus.club](https://koboldplus.club/), [scaled encounters](https://fantasycomputer.works/scaled-encounters/) |
| **Watabou** (One Page Dungeon, City) | Beautiful seeded generators; JSON export (rooms as rects, doors, notes) readable by other tools; URL params `seed`, `tags`, `export=json`; city ↔ Azgaar integration. | Client-only, no API, undocumented schema, JSON cannot be re-imported (the seed is the save). Licence must be checked before embedding. | [OPD](https://watabou.github.io/dungeon.html), [City](https://watabou.github.io/city.html), [OPD export comments](https://watabou.itch.io/one-page-dungeon/comments?after=221) |
| **Azgaar FMG** | World/region generator: states, provinces, burgs, cultures, religions, routes; full JSON export "as an API replacement", GeoJSON, per-editor CSV import/export. | Huge payload; index-based references; world scale, not adventure scale. | [FMG](https://azgaar.github.io/Fantasy-Map-Generator/), [data import](https://github.com/Azgaar/Fantasy-Map-Generator/wiki/Data-import), [GIS export](https://github.com/Azgaar/Fantasy-Map-Generator/wiki/GIS-data-export) |
| **Lazy DM (Sly Flourish)** | A **prep method**, not software: eight steps (review characters, strong start, potential scenes, secrets and clues, fantastic locations, important NPCs, relevant monsters, magic item rewards). Secrets are one-sentence, **location-agnostic**, revealed wherever they fit, not all used. Free CC-BY resource document and Markdown template. | Nothing to integrate except the shape. That shape is the right session-prep checklist. | [eight steps](https://slyflourish.com/eight_steps_2023.html), [at the table](https://slyflourish.com/using_the_8_steps_at_the_table.html), [template](https://slyflourish.com/rotldm_template.html), [Lazy GM Resource Doc (CC-BY)](https://slyflourish.com/lazy_gm_resource_document.html) |
| **Friends & Fables** | Nearest competitor to goal 1: AI GM "Franz" over 5e, world builder (lore, quests, NPCs, maps) "the AI learns and uses instantly", auto-tracked inventory/HP/locations, Memories V2, up to 6 players. | Closed SaaS, pay per turn; vendor claims only. | [fables.gg](https://fables.gg/), [review 2026](https://dungeonsdeep.ai/blog/friends-and-fables-review-2026) |
| **Archivist AI** | Session audio/notes → transcript → summary → auto-maintained wiki of characters, locations, factions, quests, timeline; `/ask` over the campaign; ZIP export. | Audio-first; can't backfill old campaigns (competitor's point); summaries, not structured state. | [myarchivist.ai](https://www.myarchivist.ai/), [docs](https://www.myarchivist.ai/documentation), [Daily DM review](https://www.thedailydungeonmaster.com/4-14-2025/product-review-archivist-ai), [Lorevia guide](https://lorevia.gg/blog/ai-dnd-session-notes-tools) |
| **LoreKeeper** (three unrelated products) | lorekeeper.ai: notes → entities ("Notes Decipher"), GM-only entities revealed later, encounter tables. lorekeeper.com: generators fed by uploaded lore. | Name collision; vendor claims. | [lorekeeper.ai](https://lorekeeper.ai/), [lorekeeper.com compare](https://www.lorekeeper.com/compare) |

**Synthesis of the landscape.** Every tool sits in one of three silos. Wikis (Kanka, World
Anvil, LegendKeeper, Notion, Obsidian) hold campaign knowledge with links and visibility but
no mechanics. Generators (donjon, KFC, Watabou, Azgaar) produce good skeletons but know
nothing about the campaign. AI tools (F&F, Archivist, LoreKeeper) read and write prose
memory but expose little structure and gate nothing in code. No tool offers all three over
one data model. That gap is the-stacks' opportunity, and our engine plus proposal gate is
the missing piece the others lack.

---

## 2. Campaign data model

### Entity kinds

Kanka's design (one generic `entity` row plus a typed child) is the proven pattern: links,
tags, permissions, mentions and history attach to the base; kind-specific fields live in the
child ([Kanka entities](https://app.kanka.io/api-docs/1.0/entities)). Recommended kinds:

| Kind | Playable payload (what the AI DM needs) |
|---|---|
| **npc** | identity, stats ref (SRD id or custom statblock), portrayal (voice, mannerism, want, fear), attitude default (D18), `knows[]`, `secrets[]` with stable ids |
| **faction** | goals, resources, members (npc links), attitude toward party, clocks |
| **location** (nested: region → settlement → site → room) | read-aloud, senses, exits/links, inhabitants, features, map ref |
| **dungeon** | a location subtree plus a map (grid, rooms as rects, doors); rooms carry key text, encounter and treasure refs |
| **encounter** | creatures (SRD ids × count), budget tier, terrain, tactics, morale, trigger, location ref |
| **item** | SRD magic item id or custom record, owner/location, attunement, lore |
| **loot table / treasure** | rolls against SRD tables, resolved to items and coin |
| **quest / storyline** | goal, stakes, nodes (locations/NPCs/encounters), status |
| **clue / secret** | one sentence, stable id, points-to (node), Lazy-DM style location-agnostic by default |
| **session** | date, strong start, potential scenes, chosen secrets, recap, event-log range |
| **timeline event / calendar** | in-world date, participants, consequences |
| **pc** | sheet over the engine (TASK-0058), bonds, character secrets |

### Relationships

- **Typed, directed links** with an optional label and attitude, mirrored on demand
  (Kanka relations: attitude, colour, mirror, private).
- **Containment** is a separate parent edge (location tree, dungeon rooms), not a generic link.
- **Mentions** in prose (`@npc:id`) produce backlinks automatically (LegendKeeper, Obsidian).
- **Clue edges**: clue → points-to node. The Alexandrian's Three Clue Rule ("at least three
  clues" per conclusion) and its inverse are then checkable by graph query: every node needs
  ≥3 inbound clues ([three-clue rule](https://thealexandrian.net/wordpress/8122/roleplaying-games/node-based-scenario-design-collectors-edition)).

### Visibility

Three granularities exist in the field. Entity-level (Kanka private flag, Foundry ownership),
page-level (Foundry per-page ownership), and block-level (World Anvil secrets, LegendKeeper
`/secret`). Block level is what DMs actually use. Recommendation: visibility on every
**field and block**, values `dm` | `party` | `<pc-id>[]`, and a reveal is an **event**
(`info.revealed`, already ratified by D18) rather than a toggle. A reveal toggle loses who
learned what and when. An event gives "View as player" for free: the projection a player
sees is the fold of reveals for that player (Kanka "View as", World Anvil per-group).

### Revision history

None of the wiki tools treat history as first-class. Our event log already does. Recommend
append-only content versions (each save a version row with author `human|ai:<purpose>`,
source `generator:<id>@seed` and parent version). Authorship and provenance on every version
is what makes human/AI co-authoring auditable.

---

## 3. Generator design

### Three approaches

| Approach | Strength | Weakness |
|---|---|---|
| **Procedural** (donjon, Watabou, KFC) | Deterministic, seedable, cheap, numbers right by construction | Generic, campaign-blind, flavourless |
| **LLM** (LoreKeeper, F&F) | Fits context, flavourful | Invents numbers, inconsistent, unverifiable |
| **Hybrid** | Skeleton and numbers from code; flesh from the LLM; validate in code | More moving parts |

PCG research converges on the hybrid: the LLM extracts intent or constraints, a solver or
critic validates, iterate ([Constraint Is All You Need, PCG 2025](https://www.pcgworkshop.com/archive/xu2025constraint.pdf);
[dual-agent map generation](https://arxiv.org/pdf/2512.10501); [LLMaker tool-calling, Liapis](https://antoniosliapis.com/research/research_pcg.php)).
This is the project's existing doctrine ("the script owns the numbers; the AI owns the story")
applied to prep.

### The hybrid pipeline, per generator

1. **Context read.** Load the target node and its neighbours from the notebook (region,
   faction, party level, open quests, existing NPC names to avoid collisions).
2. **Skeleton (code, seeded).** Encounter: 2024 DMG XP budget per character × party size,
   Low/Moderate/High, no group multiplier, "spend as much as you can without going over"
   ([2024 table](https://roll20.net/compendium/dnd5e/Rules:Plan%20Encounters?expansion=33359),
   [DDB article](https://www.dndbeyond.com/posts/1901-creating-combat-encounters-using-the-new-dungeon));
   monsters picked from SRD records filtered by CR/environment. Treasure: SRD treasure and
   magic-item records. Dungeon: rooms/corridors graph (own generator, or Watabou JSON import
   if licence permits). Five-room dungeon shape from donjon/Johnn Four as a template.
3. **Flesh (LLM).** Names, read-aloud text, NPC portrayal, tactics, hooks, clue sentences.
   Strict JSON schema output; LLM never writes CR, XP, HP, AC, DC or gp.
4. **Validate (code).** Schema; SRD id existence; budget recomputed; no number in prose
   (reuse the digit-free narration audit idea); name uniqueness; links resolve; Three Clue
   coverage warning.
5. **Draft.** Result lands as a **draft** version, never live.

### Curation workflow

Generate → review → accept. The proposal gate (decision-0015) already models this: a
generator output is a proposal; `ask` policy for a human DM; `auto` for the AI DM between
sessions. Review UI needs: side-by-side draft vs current, per-field accept, **reroll one
field** (keep skeleton, new flesh), **reroll skeleton** (new seed), lock fields before reroll.
Every accepted item keeps its generator id and seed for provenance and reproduction.

---

## 4. Notebook UX

- **Navigation:** left tree by kind and by containment (region → site → room); right pane
  the entity; slide-out panels for linked entities (operator rule: no modals).
- **Backlinks and mentions:** `@` autocomplete inserts typed links; every entity shows
  "mentioned in" (LegendKeeper, Obsidian). A small relations graph per entity (Kanka explorer).
- **Search:** hybrid full-text plus vector search. The `library` plane already has
  vector/fts/RRF retrieval ([[retrieval]] in the wiki); reuse it for campaign content.
- **At-the-table quick reference:** pinned "now" panel: current location, NPCs present,
  active encounter with statblocks inline (Fantasy Statblocks pattern), unrevealed secrets for
  this scene, one-click reveal. D&D Beyond's lesson: the prepared encounter must be the same
  record the combat tracker runs, never re-entered.
- **Session prep checklist:** the Lazy DM eight steps as a session template, each step a
  slot linked to notebook entities, AI can fill any step on request. Sly Flourish's
  template is CC-BY and may be adapted with attribution.
- **Handouts vs secrets:** per-block visibility; a "View as <player>" toggle; a handout is a
  party-visible block revealed by event. Reveal happens at the table from the quick panel.

---

## 5. Campaign content and the AI DM

### At play time (read)

- **Structured state first, retrieval second.** The actor snapshot (TASK-0140) already
  renders typed state into `dm`/`seat`/`fiction` views under a token cap. Codex entities
  become snapshot inputs: the scene's location, present NPCs, active encounter and in-scope
  clues are loaded **by graph neighbourhood**, not by similarity search.
- **Retrieval** covers the long tail: lore questions, "who was that innkeeper", past
  sessions. Use the existing hybrid retrieval over chunked notebook prose, filtered by
  visibility before ranking.
- **Secrets gating in code.** The player-facing prompts must only see revealed fields
  (existing `PlayerSeedView` pattern). D18's `info.revealed` and the output claim gate check
  leaks against stable ids, not string matches. The Director (decision-0018) sees DM
  fields; narrator and companions see the player view.

### After play (write back)

- **Session log → notebook.** Archivist proves demand for transcript-to-wiki. We have better
  input: the event log already has structured facts (attitude moves, reveals, deaths, loot).
  A post-session `chronicle` job proposes notebook updates (new NPC met, item acquired,
  location visited, quest status) as **drafts through the gate**, human curates in `ask`.
- **NPC memory.** Per-NPC memory stream of observations tied to event seqs, with
  recency × importance × relevance retrieval and periodic reflection, as in Generative Agents
  ([Park et al. 2023](https://arxiv.org/pdf/2304.03442), §4.1-4.2). Facts that change play
  (attitude, knowledge) stay in typed state per D18; memory is flavour and recall only.
- **Session record** gets recap, reveals made, secrets unused (carried forward, per Lazy DM).

---

## 6. Recommended feature tiers

### Prerequisites (before any tier)

1. **Content contracts** (TASK-0056): Zod schemas per kind with a playable core, reusing
   `srd-data` record shapes for stats and items.
2. **Entity store**: generic `entity` base + typed payload (Postgres JSONB with schema
   version), append-only versions with author and provenance, typed link table, containment
   parent, per-field visibility.
3. **Reveal as event**: `info.revealed` (D18) generalised to any notebook field.
4. **Proposal gate covers prep**: generator and chronicle outputs are proposals.
5. **Snapshot/assemble reads the codex** (TASK-0060) by neighbourhood.

### MVP (makes goal 4 real and feeds goal 1)

- Entity kinds: npc, location (nested), encounter, item, clue/secret, session, pc.
- Notebook: tree, entity page, `@` links, backlinks, full-text search, per-block DM/party
  visibility, "View as player".
- Generators (hybrid, validated): NPC (the NPC-smith, TASK-0061) and encounter (2024 budget
  over SRD monsters, TASK-0062). Draft → accept flow.
- AI DM plays a scene from codex entities instead of the hand-authored seed.
- Session prep template (Lazy DM eight steps).

### V1

- Kinds: faction, quest/storyline with clue graph and Three Clue coverage lint, dungeon with
  rooms, loot table, timeline.
- Generators: treasure/loot (SRD tables), five-room dungeon, dungeon map skeleton, tavern/
  settlement, rumour/clue; field-level reroll and locks.
- At-table quick panel with one-click reveal and inline statblocks; prepared encounter runs
  in the combat tracker unchanged.
- Chronicle write-back proposals after each session; session recap.
- Vector search over notebook prose; Obsidian vault export (TASK-0074).

### Later

- NPC memory streams with reflection; faction clocks advancing between sessions.
- Region/world: Azgaar JSON import; Watabou city/dungeon import (licence permitting).
- Relations graph explorer; per-player visibility groups; handout rendering (images, letters).
- Campaign-from-premise generator (TASK-0088) chaining all generators.
- Random tables as data (Dice Roller pattern), user-authored.

### Risks and open questions

- **Licensing:** donjon code is CC BY-NC 3.0; Watabou and Azgaar licences must be checked
  before import/embedding. Generate our own skeletons from SRD 5.2.1 (CC-BY) data.
- **Prose vs data tension:** humans write prose; the AI DM needs fields. Recommend every kind
  has a small required playable core plus free prose, and a lint (portrayal completeness,
  TASK-0056) that blocks "ready for play" status, not saving.
- **Visibility granularity** costs editor complexity; block-level is the minimum DMs expect.
- **SRD 2024 data source:** Open5e has srd-2024; dnd5eapi's 2024 endpoints were reported as
  stubs ([Open5e](https://github.com/open5e/open5e-api/releases)). The repo already pins its
  own SRD 5.2.1 package, so no external API is needed at runtime.
