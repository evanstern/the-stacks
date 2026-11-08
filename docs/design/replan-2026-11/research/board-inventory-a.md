# Board inventory A: not-Done tasks with id <= 0150

Source: `backlog task list --plain` and `backlog task view` on 2026-11-06. 76 cards, all To Do. No In Progress card falls in range (TASK-0186 and TASK-0203 are above 0150). Milestone "-" means the card has none. "still-valid?" is a judgment against the end goals in brief.md.

| id | title | milestone | kind | area | layer | still-valid? | essence | dependencies |
|---|---|---|---|---|---|---|---|---|
| 0031 | M1 human acceptance walkthrough | m-1 | tooling-process | infra | surface | stale (M1 closed in practice; retrieval demo superseded by DM product) | Operator hand-checks M1 criteria from a clean stack | 0028, 0029, 0030 (all Done) |
| 0035 | Gateway: accept sub-1024 embedding models by padding | - | improvement | retrieval | mid | yes (low) | Gateway rejects non-1024-dim embeddings; pad to schema width | - |
| 0037 | Fix dev runbook: compose runs from runner checkout | - | doc | infra | surface | yes | docs/ops/dev-vm-104.md names the wrong directory | 0036 (Done) |
| 0038 | Library management UI: book list, delete, re-import | m-1 | feature | retrieval | surface | yes (re-scope under codex/library) | Books table, delete, re-import on Library page | 0028 |
| 0039 | Chat sessions: persisted, switchable history | m-1 | feature | chat-ui | mid | yes (re-scope; rules-chat only) | Operator-only multi-session history for /library/ask | 0028 |
| 0053 | The Table: multi-human demo, AI DM and assisted human DM | - (M3) | feature | multiplayer | surface | yes (M3 closer; demo of 0049-0052 now Done) | M3 milestone demo, same scene twice | 0049-0052 (Done), 0176, 0177 (Done) |
| 0054 | Revisit LangGraph adoption | m-4 | spike | ai-dm | foundational | yes (decision due) | Adopt/reject LangGraph.js when 2nd agent graph lands | decision-0019 trigger |
| 0056 | Codex: content contracts for NPC, PC, location, encounter, item | m-4 | feature | codex/campaign | foundational | yes | Zod contract per entity + portrayal-completeness lint | 0053 |
| 0057 | Codex: storage, versioning, typed links, CRUD API | m-4 | feature | codex/campaign | foundational | yes | Versioned campaign entities + typed links behind CRUD API | 0056 |
| 0058 | Codex: PC sheets over the 5e engine | m-4 | feature | codex/campaign | mid | yes | PC sheet is a codex entity with engine-computed mechanics | 0057, 0055 (Done) |
| 0059 | Codex: codex browser UI | m-4 | feature | codex/campaign | surface | yes (expand to editors) | Operator browses/searches/edits entities and links; no modals | 0057 |
| 0060 | Codex: DM runtime reads and writes the codex | m-4 | feature | ai-dm | foundational | yes | assemble loads codex neighbours; chronicle proposes codex updates; replaces scene seed | 0057 |
| 0061 | Codex: NPC-smith agent | m-4 | feature | codex/campaign | mid | yes | Plain-words request yields a complete linked codex NPC | 0057, 0054 |
| 0062 | Codex: encounter builder agent | m-4 | feature | codex/campaign | mid | yes | Contract-valid encounter sized for the party | 0061, 0058, 0055 |
| 0063 | Codex: milestone demo | m-4 | feature | codex/campaign | surface | yes | M4 demo: create campaign, NPC, AI DM plays him | 0058-0062 |
| 0064 | Imported Mechanics: layered records over SRD | m-5 | feature | engine | foundational | yes | Imported records first, SRD baseline second, one lookup | 0063 |
| 0065 | Imported Mechanics: stat block extraction from DDB | m-5 | feature | retrieval | mid | yes | DDB monster blocks become engine records with citations | 0064 |
| 0066 | Imported Mechanics: spell extraction from DDB | m-5 | feature | retrieval | mid | yes | DDB spells become engine spell records | 0064 |
| 0067 | Imported Mechanics: review panel and demo | m-5 | feature | codex/campaign | surface | yes | Operator reviews extracted records against source | 0065, 0066 |
| 0068 | Maps: MapPlan contract and map-planner agent | m-6 | feature | maps/vtt | foundational | yes (pending VTT research) | Zod MapPlan (rooms, walls, doors, terrain) linked to a location | 0067 |
| 0069 | Maps: deterministic tile renderer, CC0 pack | m-6 | feature | maps/vtt | mid | yes (pending VTT research) | MapPlan to PNG, same seed same image | 0068 |
| 0070 | Maps: PixiJS table with grid, tokens, fog, walls | m-6 | feature | maps/vtt | surface | yes (build-vs-embed open) | In-app table view; moves/reveals are events | 0069 |
| 0071 | Maps: AI DM drives tokens and fog | m-6 | feature | maps/vtt | mid | yes | DM moves tokens and reveals fog through the gate | 0070 |
| 0072 | Maps: VTT adapter port and first live adapter | m-6 | feature | maps/vtt | mid | yes (open to replan) | Port plus Foundry or Owlbear adapter | 0070 |
| 0073 | Maps: Universal VTT export | m-6 | feature | maps/vtt | surface | yes | PNG + UVTT JSON export | 0069 |
| 0074 | Maps: Obsidian vault export of codex | m-6 | feature | codex/campaign | surface | yes (low value) | One-way markdown vault export | 0067 |
| 0075 | Maps: portraits via image-provider seam | m-6 | feature | codex/campaign | surface | yes | Provider-agnostic portrait generation | 0067 |
| 0076 | Maps: milestone demo | m-6 | feature | maps/vtt | surface | yes | M6 demo: cave map, tokens, fog, export | 0071-0075 |
| 0077 | Dial: per-kind autonomy policy settings | m-7 | feature | multiplayer | mid | yes | DM sets auto/ask/suggest per proposal kind | 0076 |
| 0078 | Dial: assisted-DM panel | m-7 | feature | multiplayer | surface | yes | Human DM rules lookups and NPC lines as proposals | 0076 |
| 0079 | Dial: mid-session generation of NPCs, encounters, maps | m-7 | feature | codex/campaign | mid | yes | Agents callable from the table | 0078 |
| 0080 | Dial: self-host docs and compose quickstart | m-7 | doc | infra | surface | yes | Clean clone to first scene by public docs | 0076 |
| 0081 | Dial: backup, restore, upgrade migrations | m-7 | feature | infra | mid | yes | Campaign backup/restore/upgrade | 0076 |
| 0082 | Dial: tag, public README, demo video | m-7 | doc | infra | surface | yes | V1 release | 0077-0081 |
| 0083 | Memory: campaign memory projections | m-8 | feature | ai-dm | foundational | yes | Summaries as rebuildable log projections within token budget | 0082 |
| 0084 | Memory: session-to-session continuity | m-8 | feature | ai-dm | mid | yes | Accurate recap; threads, clocks, attitudes carry over | 0083 |
| 0085 | Memory: Director scene framing and campaign pacing | m-8 | feature | ai-dm | mid | yes | Director picks scenes from open threads | 0083 |
| 0086 | Memory: milestone demo | m-8 | feature | ai-dm | surface | yes | Second session recaps first | 0084, 0085 |
| 0087 | Solo: re-plan M9 from V1 evidence | m-9 | spike | ai-dm | foundational | superseded-by this replan | Decision record re-planning M9 | 0082 |
| 0088 | Solo: campaign start from a premise | m-9 | feature | codex/campaign | mid | yes (goal 1/4 core) | Premise to codex start and session one | 0087, 0086 |
| 0089 | Solo: assisted fallback when AI out of depth | m-9 | feature | ai-dm | mid | yes | Switch dial toward ask on low confidence | 0087 |
| 0090 | Solo: multi-session playtest and auditor | m-9 | tooling-process | ai-dm | mid | yes | Audit continuity across sessions | 0087, 0088 |
| 0091 | Solo: end-to-end demo | m-9 | feature | ai-dm | surface | yes (goal 1 closer) | Premise to conclusion, AI DM | 0087-0090 |
| 0092 | SRD 5.2.1 data: magic items | m-5 | feature | engine | mid | yes | Zod records in packages/srd | 0043 (Done) |
| 0093 | SRD 5.2.1 data: species, backgrounds, feats | m-5 | feature | engine | mid | yes (needed for char creation) | Origin records in packages/srd | 0043 (Done) |
| 0094 | SRD 5.2.1 data: rules glossary entries | m-5 | feature | engine | mid | duplicate-of-0137 (overlap; 0123 already added part) | Non-condition glossary entries | 0043 (Done) |
| 0097 | Narrow screens: About and Settings unreachable | - | bug | table-ux | surface | yes | Sidebar footer hidden under narrow breakpoint; SRD attribution link lost | - |
| 0098 | Runtime stacks come up with unmigrated DB | - | bug | infra | mid | yes | env:up/env:main leave DB without tables | - |
| 0101 | Hosted dev: 9router and ollama bge-m3 on vm-104 | - | tooling-process | infra | mid | yes (stack open to change) | Mirror local AI setup on dev | - |
| 0103 | Reset-password CLI in runtime image | - | tooling-process | infra | surface | yes | No supported password recovery | - |
| 0107 | Revisit: DM-side nodes read NPC secrets | - | spike | ai-dm | mid | yes (trigger-gated; part of 0148/0149 info model) | Director lost NPC motive after secrets move | 0106 (Done) |
| 0108 | Revisit: Director/interpret lines name characters | - | improvement | ai-dm | mid | yes (likely subsumed by actor snapshot 0140) | Transcript shows user ids, not names | 0106 |
| 0109 | Chronicle conflates distinct combatants in journal | m-3 | bug | ai-dm | mid | yes | dm.chronicle merges Snag with a goblin | 0106 |
| 0111 | Narration digits check: quote match, fix source | m-3 | bug | ai-dm | mid | yes | Audit digit check causes fallbacks | 0106 |
| 0120 | Research branch 3: exploration, awareness, time | - | spike | ai-dm | mid | yes | Doctrine for noticing, stealth, clock | 0119 (Done) |
| 0121 | Research branch 4: table contract (session zero, safety) | - | spike | multiplayer | mid | yes (goal 2 core) | Content limits, safety, spotlight | 0120 |
| 0122 | Research branch 5: running combat | - | spike | engine | mid | yes | Morale, tactics, pacing, parked rules | 0121, 0048 (Done) |
| 0124 | Revisit: research encounter/adventure design for codex | m-4 | spike | codex/campaign | mid | yes (feeds generators) | Node-based design, clue structure | trigger: 0060 |
| 0125 | Revisit: research world, tone, horror doctrine | m-9 | spike | ai-dm | mid | yes | Tone beyond content-pg13 | trigger: first campaign |
| 0126 | Revisit: research rewards and house rules | m-9 | spike | engine | mid | yes (feeds loot generator) | Rewards, house-rule flags | trigger: multi-session spec |
| 0129 | Design round: Ask the DM, OOC read-only answer | m-3 | redesign | chat-ui | mid | duplicate-of-0131 and partly superseded by 0188 (Done) | OOC question changes no state | - |
| 0130 | Doctrine pass: rewrite resolution doctrine against D14 | - | doc | ai-dm | mid | yes | Align doctrine pairs with decision-0022 | 0127 (Done), 0104 (Done) |
| 0131 | OOC channel to ask the DM a question | m-3 | feature | chat-ui | mid | superseded-by 0188/0199 (one chat stream) | Clarifying questions cost a move today | - |
| 0132 | Show progress between Commit and narration | m-3 | improvement | table-ux | surface | yes | 30-60 s with no indicator | overlaps 0116/0117 (Done) |
| 0133 | Render dice lines before and distinct from prose | m-3 | improvement | table-ux | surface | yes (likely folded into 0247 MUD roll rows) | Roll line renders after prose, same style | - |
| 0136 | Revisit: shared presence store, multi-process | - | improvement | multiplayer | foundational | yes (trigger-gated) | Presence is in-process memory | 0051 (Done) |
| 0137 | Revisit: rest of SRD Rules Glossary | - | spike | engine | mid | yes (duplicate-of-0094 scope) | Add glossary entries on demand | 0123 (Done) |
| 0138 | adjudicate integration suite fails without DB | m-3 | bug | infra | surface | yes | Should skip like other integration tests | - |
| 0139 | Revisit: position and range as actor state | - | feature | maps/vtt | foundational | yes (trigger: maps; needed for VTT/combat) | No distance/reach model | 0135 (Done) |
| 0144 | Actor-state gate: claim gate on companion say, chronicle | m-3 | feature | ai-dm | mid | yes | U4 of decision-0025 | 0143 (Done), 0109 |
| 0145 | Actor-state gate: Director legality over actor state | m-3 | feature | ai-dm | mid | yes | U5 | 0140-0142, 0110 (Done) |
| 0146 | Actor-state gate: dm.audit receives actor snapshot | m-3 | feature | ai-dm | mid | yes | U7 | 0140, 0141 |
| 0147 | Actor-state gate: resolve batch gate (formulation 3) | m-3 | feature | ai-dm | foundational | yes | U9: plot changes need recorded fact; other-actor changes need roll or SRD rule | 0140, 0141, 0110, 0127, 0128 |
| 0148 | NPC/info: seed information ids and reveal fact | m-3 | feature | codex/campaign | foundational | yes | Stable ids on knows/secrets/clues; info.revealed fact | 0140, 0143 |
| 0149 | NPC/info: NPC attitude as tracked state | m-3 | feature | ai-dm | foundational | yes | Per-PC attitude in snapshot | 0140, 0142 |
| 0150 | NPC/info: Influence as an engine shape | m-3 | feature | engine | mid | yes | Social requests per SRD Influence | 0104, 0128, 0127, 0149 |

Note: ids 0032..0034, 0036, 0040-0052, 0055, 0095, 0096, 0099, 0100, 0102, 0104-0106, 0110, 0112-0119, 0123, 0127, 0128, 0134, 0135, 0140-0143 are Done. 0110 and 0127/0128 are Done, so dependency chains above are partly satisfied.

## 1. Clusters

- **Codex chain 0056-0063 plus 0059/0060 plus 0079, 0088**. One root: the project has no campaign data model; scenes run from a hand-authored seed (0060, 0056). All M4 agents, editors and solo start depend on 0056/0057. Merge candidates: 0056+0057 (contract and storage are one design surface). 0061/0062 become instances of one generator framework (with 0079, 0088); 0054 (LangGraph) gates both.
- **Maps/VTT chain 0068-0076 plus 0139 plus 0239 (out of range)**. 0070 builds a PixiJS table, 0072 an adapter, 0073 UVTT. 0139 (position/range) is the missing engine foundation for all of them. Build-vs-embed research should rewrite 0070/0072/0073 as one decision first.
- **Actor-state gate and NPC/info 0144-0150, 0107, 0108, 0109, 0111, 0130**. Root: the DM pipeline enforces rules by patching each output after the fact (claim gate, audit, legalize, fallback). 0109/0111 are symptoms of the same audit/fallback path as the out-of-range 0214/0242 cards. Merge 0107+0148+0149 (NPC knowledge, secrets, attitude) and 0108 into 0140-style snapshot work.
- **OOC and chat stream 0129, 0131**. Both predate decision for one chat stream (0188 Done; 0199 To Do, out of range). Close 0129/0131 as superseded-by 0199.
- **Display polish 0132, 0133, 0097**. 0133 and 0132 fold into the MUD stream (0247) rows.
- **SRD data 0092, 0093, 0094, 0137**. Same package and loader; one card, 0094 and 0137 overlap. 0093 (species, backgrounds, feats) is a precondition of character creation, so it moves up in priority.
- **Research branches 0120-0122, 0124-0126**. Same vault-research mechanism; 0124 and 0126 feed generators (encounters, loot). Run them as one research wave keyed to the generators.
- **Import chain 0064-0067**. Self-contained; low relevance to goals 1-4 beyond monster coverage. Candidate to defer.
- **Release and infra 0080-0082, 0098, 0101, 0103, 0037, 0035**. Hygiene; independent of the product plan.
- **Memory/solo 0083-0091**. 0087 is superseded by this replan. 0083 is foundational for goal 1.

## 2. Foundational defects (design flaws, not local bugs)

- **0060 / 0056 / 0057**: no codex. The DM reads a hand-authored scene seed, so campaign creation (goal 4) and campaign continuity (goal 1) have no substrate.
- **0147 and 0144-0146 (decision-0025)**: rule enforcement lives in gates stacked after model output rather than in a state machine the model proposes into. The need for U1-U9 shows the pipeline design is the flaw.
- **0148, 0149, 0107, 0108**: information and attitude are not first-class state. Secrets moved out of prompts and the Director lost them (0107); transcript lines carry user ids (0108).
- **0139**: no position, range or distance. Blocks maps, combat realism, VTT.
- **0083**: memory is not a derived view yet; long campaigns outgrow context.
- **0136**: presence is in-process; single-server assumption baked in.
- **0054**: agent orchestration framework undecided across generators.
- **0064**: engine lookup has no layered/imported-record model.

## 3. Cards touching UX, VTT, maps, campaign creation, NPCs, generators

- **UX**: 0097 (narrow screens), 0132 (progress), 0133 (dice lines), 0038 (library UI), 0039 (chat sessions), 0059 (codex UI), 0078 (assisted-DM panel), 0129/0131 (OOC channel).
- **VTT/maps**: 0068, 0069, 0070, 0071, 0072, 0073, 0076, 0139.
- **Campaign creation**: 0056, 0057, 0059, 0060, 0063, 0074 (vault export), 0079, 0088, 0124, 0126.
- **NPCs**: 0061 (NPC-smith), 0107, 0148, 0149, 0150, 0075 (portraits), 0065 (stat blocks).
- **Generators**: 0061, 0062, 0068/0069 (map-planner), 0079, 0088, 0124 (design research), 0126 (rewards/loot research). No card exists for dungeon, loot, storyline or item generators, or for a donjon-style standalone generator UI; none for a campaign notebook or for character creation (0093 is only the data).
