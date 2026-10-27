---
name: dm-narration-quality
description: DM narration quality (TASK-0106, specs/034-narration-quality) - the PlayerSeedView that keeps DM-only seed text out of player-facing prompts, named public-only transcripts, facts v2 (party, npcNames, public events, setting, roll target), the code-derived blocking/advisory audit with the party-name filter, and the in-fiction deterministic fallback. Read before touching narrate, audit, facts or fallback.
kind: component
sources:
  - apps/server/src/dm/seed/views.ts
  - apps/server/src/dm/prompts/common.ts
  - apps/server/src/dm/prompts/narrate.ts
  - apps/server/src/dm/facts.ts
  - apps/server/src/dm/fallback.ts
  - apps/server/src/dm/nodes/audit.ts
  - specs/034-narration-quality/contracts/audit-criteria.md
verified_against: 0822fb959951b8aa06f3ae2b836549ee72730498
---

# DM narration quality

Part of the DM runtime ([[dm-runtime]]); failure records are in [[dm-failure-and-gates]].
Spec: `specs/034-narration-quality/` (contracts `player-facing-context.md`,
`narration-facts.md`, `fallback-summary.md`, `audit-criteria.md`).

## Player-facing seed view

`seed/views.ts` exports `PlayerSeedView` and `playerFacingSeed(seed)`. The view copies only
player-facing fields: title, goal statement, location (name, features, mood, senses), opening
framing, NPC name/role/voice/want/detail/appearance, and character identity, portrayal, `knows`
and relationship kinds. `dmOnlySeedText(seed)` lists every DM-only string, for tests; it is built over `dmOnlySeedPaths(seed)`, the JSON Pointers of the same fields, which the operator seed route returns as `dmOnlyPaths` ([[debug-view]]). The
narrate builder (`prompts/narrate.ts`) and `companion.ts` take the view (the chronicle prompt takes the roster only);
DM-only seed facts never reach a player-facing prompt. The director still sees the full seed.

## Transcript and facts

`transcriptEntries(tail, roster?)` in `prompts/common.ts`: with a roster (`rosterOf(party)`) it
drops non-public rows and names speakers; without one it is the unchanged DM-side form (director
and interpret). `NarrationFacts` (`facts.ts`, `buildNarrationFacts`) carries trigger, actions
with rolls and changes, `npcTurn`, director pacing, `modeChange`, present NPCs, rulings,
`clarify` questions, plus v2 fields: `party` (id, name, controller), `npcNames` (seed NPCs plus
non-party combatants), `events` (public encounter and turn changes) and `setting`
(`locationName`, `openingFraming`). A roll fact carries its `target`. `factEntries` renders
the facts for the prompt; `renderDiceLines` still renders every number.

## Audit

`nodes/audit.ts`: `deterministicChecks` is pure and every issue blocks (empty prose, digits,
dice language with no roll, death or unconscious words versus recorded life-state, omitted
recorded death or down, outcome-word pairing, `MAX_WORDS`, option menu, a clarify turn that
does not end in `?`, dice lines versus the renderer). Then one `dm.audit` call. Pass or fail is
derived in code, not read from the model verdict. Each issue is recorded as `RecordedIssue`
with `blocking`. From `dm.audit`, kinds `ledger-mismatch`, `invented-mechanics` and
`player-agency` may block; `doctrine` and `other` are advisory and logged with an
`[advisory]` prefix. A `player-agency` issue blocks only when its detail names a party member
(`llmIssueBlocksFor`, `partyNameTerms`, `detailNamesPartyMember`: full name, characterId, or
given name after a title word, whole-word match). Each `AuditAttempt` records the prose word
count, both result sets and the prose hash. Regeneration passes blocking issues back.

## Fallback

`factualSummary(facts)` (`fallback.ts`) is deterministic in-fiction prose: opening framing on
scene start, one sentence per refusal, roll outcome, public change and event, "What does X do?"
for each clarify, and a scene-end line. It holds no digit, system word or tracker name, passes
`deterministicChecks` by construction and is never sent to `dm.audit`. It ships after three
failed attempts, a failed audit call or a failed regeneration, with a `dm`-visibility journal
flag.

## Prompt versions

`dm.narrate-v3`, `dm.audit-v2`, `dm.director-v2`, `dm.chronicle-v2`, `dm.companion-v4` (v3 added the react trigger, v4 the withdraw and revise decisions; see
[[dm-runtime]]).
