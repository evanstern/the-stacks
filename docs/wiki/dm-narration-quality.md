---
name: dm-narration-quality
description: DM narration quality (TASK-0106, specs/034) - the PlayerSeedView that keeps DM-only seed text out of player prompts, named public-only transcripts, facts v2, party and world prompt sections from S1, the code-derived blocking/advisory audit with the party-name filter, the claim gate hook-up (see output-claim-gate), and the in-fiction fallback. Read before touching narrate, audit, facts or fallback.
kind: component
sources:
  - apps/server/src/dm/seed/views.ts
  - apps/server/src/dm/prompts/common.ts
  - apps/server/src/dm/prompts/narrate.ts
  - apps/server/src/dm/facts.ts
  - apps/server/src/dm/fallback.ts
  - apps/server/src/dm/snapshot/aliases.ts
  - apps/server/src/dm/snapshot/render.ts
  - apps/server/src/dm/nodes/audit.ts
  - apps/server/src/dm/nodes/narrate.ts
  - apps/server/src/dm/claims.ts
  - apps/server/src/dm/audit-words.ts
  - specs/034-narration-quality/contracts/audit-criteria.md
verified_against: 7c84d75e2613315578ad8a1ebd4ab783b57d4147
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
`clarify` questions, plus v2 fields: `party` (id, name, controller), `events` (public encounter
and turn changes, plus a `presence` fact from each `scene-presence.changed` row: name, new presence and reason; the name falls back to the seed NPC name) and `setting` (`locationName`, `openingFraming`). `party` stays for the audit's
party-name filter and the fallback. The `npcNames` field is gone (TASK-0140): the world list
now comes from the snapshot. A roll fact carries its `target`. `settled` holds the death saves rolled for combatants the turn passed (`FactSettled`; a `death-saves` change; the fallback says "holds on" or "slips closer to death"), and a turn with only settled facts is narrated. The talk path (TASK-0180) builds `NarrationFacts` with `trigger: "talk"` and empty `actions`, so `deterministicChecks` refuses digits and dice language with no roll; it adds a `dmOnlySeedText` substring check ([[dm-runtime]]). `factEntries` renders
the facts for the prompt; `renderDiceLines` still renders every number. The narrate prompt renders a presence fact as `Event: <name> is now <presence> (<reason>)`, and the fallback says the actor arrives, leaves, flees, is removed, surrenders or concedes.

## State sections from the snapshot

`characterSections(snapshot)` (`prompts/narrate.ts`), shared by the narrate and audit prompts,
renders S1 ([[actor-snapshot]]) once in the `fiction` view under `CAPS.snapshotFiction` (800) and
splits it into three sections: `## Scene state` (the stage lines), `## Party (player characters)`
(party actors) and `## Other characters (the world)` (every other actor, so a goblin dead since an
earlier turn appears as dead). The `fiction` view prints no digit and no id: it prints name, kind,
controller ("human player" or "AI companion"), life state, conditions and presence. An overflow
throws `SnapshotOverflowError` and fails the turn with `state-overflow` ([[dm-runtime]]).

## Audit

`nodes/audit.ts`: `deterministicChecks(facts, narration, state)` is pure and every issue blocks
(empty prose, digits, dice language with no roll, outcome-word pairing, `MAX_WORDS`, option menu,
a clarify turn that does not end in `?`, dice lines versus the renderer). The four actor-anonymous
death and unconscious word checks are gone: `checkClaims(state, prose)` (`claims.ts`, spec 051)
replaces them, and each claim issue blocks as `ledger-mismatch` with the detail prefix
`Actor state:`. The `ClaimState` is S1 plus the S0-to-S1 diff from resolve ([[actor-snapshot]]).
Then one `dm.audit` call. Pass or fail is derived in code, not read from the model verdict. Each
issue is recorded as `RecordedIssue` with `blocking`. From `dm.audit`, kinds `ledger-mismatch`, `invented-mechanics` and
`player-agency` may block; `doctrine` and `other` are advisory and logged with an
`[advisory]` prefix. A `player-agency` issue blocks only when its detail names a party member
(`llmIssueBlocksFor`, `partyNameTerms`, `detailNamesPartyMember`: full name, characterId, or
given name after a title word, whole-word match). The title list and the given-name rule moved to
`snapshot/aliases.ts` (`nameTerms`); `partyNameTerms` calls it and its output is unchanged. Each `AuditAttempt` records the prose word
count, both result sets and the prose hash. Regeneration passes blocking issues back.

## Output claim gate

`checkClaims` (`claims.ts`, spec 051) replaces the four anonymous checks and `withholdRefusedInputs`
(`nodes/narrate.ts`) withholds refused rulings and `goalNote` text before the first model call;
the audit records the withheld texts as non-blocking issues on attempt 1 only. Detail: [[output-claim-gate]].

## Fallback

`factualSummary(facts)` (`fallback.ts`) is deterministic in-fiction prose: opening framing on
scene start, one sentence per refusal, roll outcome, public change and event, "What does X do?"
for each clarify, and a scene-end line. It holds no digit, system word or tracker name, passes
`deterministicChecks` by construction and is never sent to `dm.audit`. `factualSummary(facts, state?)` passes
each roll reason through `checkClaims` in `reasonUsable` (a refused reason is not voiced), and
says "<name> dies" instead of "is dead" for a numbered name ("Goblin three"), which the checker
would read as the count word. It ships after three
failed attempts, a failed audit call or a failed regeneration, with a `dm`-visibility journal
flag.

## Prompt versions

`dm.react-v1` (TASK-0180, purpose `dm.narrate`), `dm.narrate-v6`, `dm.audit-v3`, `dm.director-v4`, `dm.chronicle-v3`, `dm.companion-v5`. Narrate v5 (spec 051) says a fact or the state sections may name a character dead or unconscious, and a dead, unconscious, stable or absent character does not act or speak. (For companion: v3 on the
snapshot branch added the `seat` state view; v4 added the react trigger and the withdraw and
revise decisions; companion v5 is both together; see [[dm-runtime]]). The snapshot bumped narrate, audit,
director, interpret, adjudicate and chronicle too. Narrate v6 (TASK-0182, specs/064) adds the rule "A not-yet-attempted step has not happened. Stop before it; never show it start."; `FactAction.followUps` render as `not yet attempted: <text>` lines, and `withholdRefusedInputs` drops a refused follow-up. Interpret v5 and director v4 came in the same task. The presence effect bumped interpret and adjudicate to `dm.interpret-v4` and `dm.adjudicate-v4`.
