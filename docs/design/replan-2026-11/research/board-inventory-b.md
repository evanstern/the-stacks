# Board inventory B: not-Done tasks with id > 0150

Source: `backlog task list --plain` and `backlog task view` on branch replan-2026-11, 2026-11-06. 59 cards (57 To Do, 2 In Progress). No dotted subtasks and no drafts exist in this range. Milestone m-3 unless stated. Layer: foundational = engine/gate/data contracts; mid = DM runtime/pipeline/prompt; surface = UI, tooling, docs. Judgements in the still-valid column are mine, from card text plus playtest logs.

| id | title | milestone | kind | area | layer | still-valid? | essence | dependencies |
|---|---|---|---|---|---|---|---|---|
| 0151 | NPC/info: conclusions and clue economy in seed | m-3 | feature | codex/campaign | foundational | yes (reshape under campaign-authoring) | Seeds list conclusions + clue paths; core conclusion survives one failed roll | 0148, 0127 |
| 0152 | NPC/info: NPC doctrine pass | m-3 | doc | ai-dm | mid | yes, but blocked behind 0148-0151 | Doctrine text matches D18 | 0148-0151 |
| 0153 | Revisit: exact pre-turn snapshot S0 across reclaimed turn | none | bug | engine | foundational | yes (maybe; trigger-gated) | S0 rebuilt from log on reclaim, not exact | 0143, 0147 (trigger) |
| 0155 | Revisit: windowed event fetch on debug page | none | improvement | infra | surface | yes (trigger-gated) | Debug page loads whole log | 0117 |
| 0156 | Revisit: landed-row marker mis-match across resolve-order deploy | none | bug | engine | foundational | yes (trigger-gated, accepted risk) | `<jobId>#<n>` marker can mismatch after resolve reorder | 0110 |
| 0160 | Revisit: events.integration T018 flake | none | bug | infra | foundational | yes (trigger: 2nd failure) | 50-concurrent-append gapless test flaked once | none |
| 0162 | Play composer keeps draft until echo lands | none | bug | chat-ui | surface | yes; fold into 0247/0199 composer | Refused line loses typed text | 0157 (Done) |
| 0166 | Revisit: human DM writes scene with no seed | none | feature | multiplayer | mid | yes (maybe) | Scene id locked to seed suggestion; human DM cannot improvise a scene | 0159 (Done) |
| 0169 | Roll lines name ability, skill, roll mode | m-3 | improvement | table-ux | surface | yes; fold into roll rows of 0247 | Roll line shows check kind and mode | none |
| 0172 | Knowledge ledger: who met whom, what each knows | m-3 | feature | codex/campaign | foundational | yes; core NPC-memory primitive | Per-character met/known projections read by narrate + interpret | 0148 |
| 0173 | NPCs learn what party tells/shows them | m-3 | feature | codex/campaign | foundational | yes | NPC-recipient knowledge facts drive NPC dialogue | 0172 |
| 0174 | Revisit: act verbs missing from claim-gate lexicon | none | bug | ai-dm | mid | yes (maybe); symptom of lexical gate | Lexicon lacks "staggers" etc. | 0161 (Done) |
| 0178 | Returning DM seat to AI settles pending ai:dm proposals | m-3 | bug | multiplayer | mid | yes | Pending proposals stall action on seat return | 0177 (Done) |
| 0179 | Revisit: operator seats absent account as DM | none | feature | multiplayer | surface | yes (maybe) | Only present users seatable | 0177 (Done) |
| 0183 | Revisit: cut plan declaration to first stage in turn mode | none | improvement | ai-dm | mid | yes (maybe) | Compound declaration resolves whole in turn mode | 0182 (Done) |
| 0186 | Playtest-run skill (In Progress) | m-3 | tooling-process | pdlc-tooling | surface | yes; skill exists and is used | Stand up, checklist, watch, triage | none |
| 0187 | Play route: cap transcript at 1024 px centered | m-3 | improvement | table-ux | surface | superseded-by 0247/0236 MUD redesign (likely) | Constrain text column | none |
| 0190 | Narration sets NPC dialogue apart from prose | m-3 | improvement | chat-ui | surface | superseded-by 0247 (verify) or yes | Spoken lines read as dialogue | none |
| 0196 | Playtest cost estimate uses measured typical | m-3 | tooling-process | pdlc-tooling | surface | yes (minor) | Estimate inflated after maxTokens 4000 | 0192 (Done) |
| 0197 | Playtest watch shows truncated= count | m-3 | tooling-process | pdlc-tooling | surface | yes (minor) | Separate truncated from invalid-json | 0192 (Done) |
| 0198 | Index/summary table for /api/tables | none | improvement | infra | mid | yes (trigger: volume) | Session list scans events by type | 0175 (Done) |
| 0199 | Build: one chat stream, quiet ring, confirm rows (spec 066) | m-3 | redesign | chat-ui | surface | yes; D20 stands; overlaps 0247 | One composer; DM reads the table after 2s+8s; 👍 confirm | 0188 (Done) |
| 0200 | Fallback repeats roll line | m-3 | bug | ai-dm | mid | yes; cluster fallback | Roll text printed twice in fallback | 0193 (Done) |
| 0201 | Objects as plan targets (doors, posts) | none | feature | engine | foundational | yes; needs object/map model | No object ids in snapshot | 0194 (Done) |
| 0202 | Seed-declared starting conditions on NPCs | none | feature | codex/campaign | foundational | yes | Bound Pell has no restrained condition | 0194 (Done) |
| 0203 | Haiku audit/chronicle invalid-json on attempt 1 (In Progress) | m-3 | bug | ai-dm | mid | yes; run B2 still 1/33 | Repair re-ask cost | none |
| 0215 | Engine records surprise | m-3 | feature | engine | foundational | yes | Surprise at encounter start; startlement derived | 0113 (Done) |
| 0216 | Revisit: reveals in talk turns; offstage NPCs in narrate | m-3 | bug | ai-dm | mid | yes (trigger-gated; B2 showed no case) | React output has no arrivals | 0206 (Done) |
| 0217 | Engine tracks Hide | m-3 | feature | engine | foundational | yes | Hidden state as engine fact | 0205 (Done) |
| 0218 | Offer party member's opportunity attack to player | m-3 | feature | engine | foundational | yes | Reaction is player's choice | 0208 (Done) |
| 0219 | Spell/trait reactions (Shield etc.) | m-3 | feature | engine | foundational | yes | Non-OA reactions via engine | 0105 (Done) |
| 0220 | NPC turn followUps held as cut plan | m-3 | bug | ai-dm | mid | yes | cutBeat from followUps holds Director moves | 0207 (Done) |
| 0221 | Revisit: lexical check that prose delivers declared outcome | m-3 | improvement | ai-dm | mid | yes (trigger-gated; B played, check) | Model-only audit criterion | 0170 (Done) |
| 0222 | Auto-fail saves / auto-crit conditions | m-3 | feature | engine | foundational | yes | Paralyzed etc. via engine | 0104 (Done) |
| 0223 | Roll step and effect amounts from engine | m-3 | improvement | engine | foundational | yes; same root as 0224 | Model-written dice remain | 0104 (Done) |
| 0224 | Monster-feature DCs from stat block | m-3 | improvement | engine | foundational | yes | Model-picked tier | 0104 (Done) |
| 0225 | Class features add damage (Sneak Attack first) | m-4 | feature | engine | foundational | yes | Needs PC sheets (0058) | 0104, 0058 |
| 0226 | Spells: concentration/roll bonuses (Bless, Guidance) | m-3 | feature | engine | foundational | yes | SPELL_UNRESOLVED today | 0105 (Done) |
| 0227 | Spells: area/multi-target | m-3 | feature | engine | foundational | yes; blocked by no positions (0139) | Targets must be named | 0105 (Done) |
| 0228 | Spells: repeat saves | m-3 | feature | engine | foundational | yes | Repeat save at turn end | 0105 (Done) |
| 0229 | Spells: roll riders | m-3 | feature | engine | foundational | yes | Riders refused | 0105 (Done) |
| 0230 | Monster spellcasting through engine | m-3 | feature | engine | foundational | yes | Out of scope in 0105 | 0105, 0224 |
| 0231 | Split two wiki notes under size budget | m-3 | doc | pdlc-tooling | surface | yes (chore) | Two notes over 8000 chars | none |
| 0232 | House-rule group checks | m-3 | feature | engine | mid | yes (low value) | tableRules.groupChecks unread | 0128 (Done) |
| 0233 | Revisit: code check narration never shows followUp as done | m-3 | improvement | ai-dm | mid | yes (trigger-gated; B2 saw none) | Model-only enforcement | 0214 |
| 0235 | playtest-run skill: runbook B scenario, party-scope local-table | m-3 | tooling-process | pdlc-tooling | surface | yes (minor) | Skill names only A | none |
| 0239 | Slide-out interactive map with click-to-draft | m-6 | feature | maps/vtt | surface | yes; re-scope to VTT recommendation | Map in slide-out, click drafts line | 0236 (Done), 0071 |
| 0241 | Party characters carry pronouns | m-3 | bug | codex/campaign | mid | yes | Narration guessed "he" | none |
| 0243 | Dice lines hide dropped die on adv/disadv | m-3 | bug | table-ux | surface | yes; fold into 0247 roll rows | Show both d20s | none |
| 0245 | Every DM reply: restate, describe, ask, state | m-3 | redesign | ai-dm | mid | yes; key table-clarity card; needs coordination with 0247 | Four-part reply, code-rendered State line | none |
| 0247 | Build: MUD stream and composer (spec 091) | m-3 | redesign | table-ux | surface | yes; absorbs 0187, 0190, 0243, 0162, 0169 (likely) | Room blocks, roll rows, chips, Tab, clickable nouns | 0199, 0236 (Done) |
| 0248 | Party action lets human PC act out of turn | m-3 | bug | multiplayer | mid | yes (B2: no recurrence) | Human off-turn in party action | none |
| 0249 | Revisit after B2: pre-encounter monsters (spec 088 OQ-2-4) | m-3 | spike | ai-dm | mid | stale: B2 playtest ruled "keep defaults"; close | Ruling from evidence | none |
| 0252 | Table shows no life state | m-3 | bug | table-ux | surface | yes; high-value; fold into 0164/0247 | Dead/down/stable not visible | none |
| 0253 | Fight can't resume after encounter ended | m-3 | bug | engine | foundational | yes; design flaw (see below) | Broken truce gets no turn order | none |
| 0254 | Fled combatant keeps its turn | m-3 | bug | engine | foundational | yes | Absent actor in initiative | none |
| 0255 | Kill narration doesn't name the death | m-3 | bug | ai-dm | mid | yes; cluster audit/fallback | Ledger-mismatch burns attempts | none |
| 0256 | dm.interpret truncates on attempt 1 | m-3 | bug | ai-dm | mid | yes; same root as 0203 | 2/28 truncated | none |
| 0257 | No-roll check ships no dice line | m-3 | bug | ai-dm | mid | yes | Auditor fails turn | none |

## 1. Clusters

- **Table clarity / MUD stream (0247, 0199, 0187, 0190, 0243, 0169, 0162, 0252, 0245):** one redesign of the play surface (D20 one-chat-stream, MUD decision doc). 0187, 0190, 0243, 0169 and 0162 are presentation details the 0247 stream/composer/roll-row design should absorb. 0252 (life state) and 0245 (State line) share a root: no code-rendered, authoritative scene/state view. Merge into one "scene state + stream" epic; the code-rendered State line, life-state chips and 0164 party panel are the same data surface.
- **Model output fragility (0203, 0256, 0192 Done, 0181 Done, 0196, 0197):** schema/truncation/invalid-json retries on haiku and interpret. Root cause: free-form model JSON with tight caps. One task: structured output or tool-call mode, with truncation observability (0197) folded in.
- **Gate/audit false results (0255, 0257, 0200, 0174, 0221, 0233, 0214 Done, 0246 Done, 0240 Done, 0242 Done):** a lexical + model audit layered over free prose keeps producing fallbacks (run B 43%, B2 71% first-attempt pass). Root cause: narration is generated free-form then policed. Candidate: narrate from structured facts with code-rendered numbers/state (0245 State line, 0257, 0200 all fixed by code-rendering).
- **Engine completeness (0215, 0217, 0218, 0219, 0222-0230, 0225, 0232):** SRD rules coverage, a long tail. 0227 needs positions (0139 outside this range). 0223/0224 same root (model-written numbers). 0225 needs PC sheets.
- **Encounter lifecycle (0253, 0254, 0201, 0202, 0249, 0216, 0220):** encounter start/end/resume, presence, and object/condition modelling. 0253 and 0254 point to one root: encounter and initiative are seeded one-shot objects, not a live state machine.
- **Knowledge / NPC (0172, 0173, 0151, 0152, 0241):** per-character knowledge, NPC memory, clue economy, pronouns. All depend on 0148 (outside range). These are the campaign-authoring/NPC primitive; they should sit under the codex data model, not as DM-runtime patches.
- **Human DM / multiplayer (0178, 0179, 0166, 0248):** small seat/seam gaps; all trigger-gated "maybes" except 0178 and 0248.
- **Playtest tooling (0186, 0196, 0197, 0235):** merge into one playtest-tooling card.
- **Revisit maybes with unfired triggers (0153, 0155, 0156, 0160, 0198, 0183, 0221, 0233, 0216, 0166, 0179):** candidates to close as a batch unless a replan goal fires them.
- **Stale or closable:** 0249 (B2 ruled keep defaults).

## 2. Foundational defects (design flaws, not local bugs)

- **Narration generated free-form then audited (0255, 0257, 0200, 0245, 0221, 0233, 0174):** code-owned facts (dice, state, deaths, outcomes) should be rendered by code, not asked of the model then lexically checked.
- **Encounter and initiative as one-shot seeded objects (0253, 0254, 0201, 0202, 0249):** the fight cannot restart; fled combatants stay in order; objects and starting conditions have no model.
- **No positions / spatial model (0227, 0239, 0252 operator quote "where any character is in relation to another"):** area spells and the map both block on it. 0139 (track position, outside range) is the real card.
- **Model-written numbers (0223, 0224, 0230, 0225):** the engine still does not own every number.
- **Knowledge is not a first-class store (0172, 0173, 0151):** NPC/info facts are bolted onto the event log per feature.
- **Turn ownership is patched per case (0248, 0178, 0244 Done, 0220):** floor/turn authority across humans, companions and the Director lacks one rule.
- **Output-contract brittleness (0203, 0256):** JSON schema retries on cheap models.

## 3. Cards touching UX, VTT, maps, campaign creation, NPCs, generators

- **UX / table:** 0247, 0199, 0245, 0252, 0187, 0190, 0243, 0169, 0162, 0164 (Done) and 0132 (outside range).
- **VTT / maps:** 0239 (m-6, slide-out map depends on 0071 PixiJS table, outside range). 0227 and 0201 need spatial model. No card in range covers a map editor.
- **Campaign creation / generators:** none in this range. The only campaign-authoring items are seeds (0151 clues, 0202 starting conditions, 0166 human DM writes a scene with no seed, 0241 pronouns). Codex (0056-0063), NPC-smith and generators are cards 0056-0063 and 0079 in the other range. Goal 4 is largely uncarded here.
- **NPCs:** 0172, 0173, 0151, 0152, 0241, 0202, 0216, 0220.
- **Human DM tools:** 0166, 0178, 0179, 0248.

## 4. What recent playtests revealed (docs/playtests/)

- **Alpha 2026-10-28 (run 1 lost to reboot; run 2):** roll line after prose (0133), success doesn't deliver what was attempted (0170 Done), roll line doesn't name the check (0169), opening reads mid-campaign (0171 Done), no party list (0164 Done), NPC unintroduced (0172), no table list after reboot (0175 Done). Run 2: in-character talk gets no reaction (0180 Done); `<think></think>` prefixes plus a 1200-token cap killed interpret and the Director, showstopper (0181, 0192 Done).
- **Alpha run 3 (2026-11-01, $2.55 of $50):** wide transcript (0187), group sign-off has no teeth (-> D20, 0188/0199), companion misnamed speaker (0189 Done), dialogue hard to spot (0190). Scene goal reached. Haiku audit/chronicle 2/21 invalid-json (0203).
- **Runbook A (2026-11-02):** failures in stealth assumption, reveal state, no-roll lines (0205, 0206, 0207, 0208, 0209, 0210, 0213, 0217, 0220).
- **Runbook B (2026-11-03, $4.73 of $100):** combat first-attempt audit pass 43% (23 narrations), 10 fallbacks, 17/224 schema mismatches on attempt 1, median turn 39 s, max 102 s. Produced 0237-0245 including the four-part reply structure (0245).
- **Runbook B2 (2026-11-06, $3.30 of $100):** combat audit pass 71% (12/17) vs a 70% target; whole run 76%; attempt-1 failures 3/141; median turn 28 s, max 89 s. Auditor verdict fail (0257). Working: 0238, 0237, 0242, 0240, 0244. Bugs: fight can't resume after the truce (0253), fled combatant keeps turn (0254), kill narration unnamed (0255), interpret truncation (0256), life state not shown (0252, operator: "no way to easily tell what's dead or alive or where any character is"). Human DM seat (0165, 0177) never exercised in B2 or run 3. Play has been scripted-scene combat with the same seed (Greyhollow reed camp); no multi-session play, campaign start, or full-campaign play has been tested.
- **Cost:** playtest spend is a few dollars per run, far under the ceilings.
