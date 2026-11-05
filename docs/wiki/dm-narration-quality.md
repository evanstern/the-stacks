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
size_budget_exempt: TASK-0113 adds the agency checks and reflex facts to the one narration-and-audit pipeline; it does not split without a TASK of its own (sibling notes dm-runtime and playtest-harness carry the same exemption)
verified_against: ee5555fef74502e96badd67e43c1b285d964396b
---

# DM narration quality

Part of the DM runtime ([[dm-runtime]]); failure records are in [[dm-failure-and-gates]].
Spec: `specs/034-narration-quality/` (contracts `player-facing-context.md`,
`narration-facts.md`, `fallback-summary.md`, `audit-criteria.md`).

## Player-facing seed view

`seed/views.ts` exports `PlayerSeedView` and `playerFacingSeed(seed)`. The view copies only
player-facing fields: title, goal statement, location (name, features, mood, senses), opening
framing, `openingPremise` (`opening.premise`, required), NPC name/role/voice/want/detail/appearance, and character identity, portrayal, `knows`
and relationship kinds. `dmOnlySeedText(seed)` lists every DM-only string, for tests; it is built over `dmOnlySeedPaths(seed)`, the JSON Pointers of the same fields, which the operator seed route returns as `dmOnlyPaths` ([[debug-view]]). The
narrate builder (`prompts/narrate.ts`) and `companion.ts` take the view (the chronicle prompt takes the roster only);
DM-only seed facts never reach a player-facing prompt. The director still sees the full seed.

## Transcript and facts

`transcriptEntries(tail, roster?)` in `prompts/common.ts`: with a roster (`rosterOf(party)`) it
drops non-public rows and names speakers; without one it is the unchanged DM-side form (director
and interpret). `NarrationFacts` (`facts.ts`, `buildNarrationFacts`) carries trigger, actions
with rolls and changes, `npcTurn`, director pacing, `modeChange`, present NPCs, rulings,
`clarify` questions, plus v2 fields: `party` (id, name, controller), `events` (public encounter
and turn changes, plus a `presence` fact from each `scene-presence.changed` row: name, new presence and reason; the name falls back to the seed NPC name) and `setting` (`locationName`, `openingFraming`). At scene start `openingSection` (`prompts/narrate.ts`) adds place, premise, goal, framing, each party character (name, class, look) and each NPC present at the first beat (`beats[0]` declaration minus S1 absent, not the Director's beat); it names characters, never players or controllers. `party` stays for the audit's
party-name filter and the fallback. The `npcNames` field is gone (TASK-0140): the world list
now comes from the snapshot. A roll fact carries its `target`, and since spec 070 its `band`, `margin` and `consequence` (declared stakes text, by batch, every band since spec 080) and, on a success band, `revealed` (the clue text) when the check row has a band; a free retry reads `no roll needed: success`. The fallback voices the band, the consequence and the learned fact when `reasonSpeakable` passes each. `settled` holds the death saves rolled for combatants the turn passed (`FactSettled`; a `death-saves` change; the fallback says "holds on" or "slips closer to death"), and a turn with only settled facts is narrated. The talk path builds facts with `trigger: "talk"` and no actions, so the checks refuse digits and dice language ([[dm-talk-triggers]]). The talk path builds facts with `trigger: "talk"` and no actions ([[dm-talk-triggers]]). `factEntries` renders
the facts for the prompt; `renderDiceLines` still renders every number, including a joiner's initiative roll from `facts.pulled` (TASK-0213; the narrate prompt lists it as `Joined the fight`). The narrate prompt renders a presence fact as `Event: <name> is now <presence> (<reason>)`, and the fallback says the actor arrives, leaves, flees, is removed, surrenders or concedes.

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
An `assist` fact change (`helper`, `target`, `assist` kind) is recorded for each `assist.granted` row (spec 084); `assist.ended` builds none, and `renderChangeLine` returns null for it, so no dice line is added. The fallback voices it as "<helper> lends <target> a hand." or "<helper> distracts <target>.".

A `spell-slot` fact change is recorded for each `spell-slots.changed` event that raises `expended` (a rest is not a spend). `deterministicChecks` adds a blocking `ledger-mismatch` when the prose says a spell slot was spent (a spend verb then a slot in one sentence) and no action, NPC turn or pulled NPC holds a `spell-slot` change this beat (TASK-0211); it does not match the caster by name. It also blocks a turn whose prose ends on the literal "What do you do?" (TASK-0204, also the "all" and "two" forms); no clarify question may end on that phrase.
(empty prose, digits, dice language with no roll, outcome-word pairing, `MAX_WORDS`, option menu (the clarify question is exempt),
a clarify turn that does not end in `?`, dice lines versus the renderer). Two agency checks (specs/074) also block: a party member choosing a defence on a recorded miss, and a party member moved or voiced in the scene-start opening. At scene start a third check blocks (kind `other`) an opening that omits a party member or present NPC (whole-word, full or given name) before its closing question, or holds the word "player" or "AI companion". Both agency checks run with a trailing clarify question removed. When `facts.turn.offTurn` is non-empty, `offTurnActs` (`claims.ts`, TASK-0214) blocks as `invented-mechanics` an off-turn actor shown striking, shooting, casting, throwing or charging, or readying for a next action (`TURN_READY_PHRASE`, TASK-0246); a hit skips the `dm.audit` call for that attempt. The four actor-anonymous
death and unconscious word checks are gone: `checkClaims(state, prose)` (`claims.ts`, spec 051)
replaces them, and each claim issue blocks as `ledger-mismatch` with the detail prefix
`Actor state:`. The `ClaimState` is S1 plus the S0-to-S1 diff from resolve ([[actor-snapshot]]).
Then one `dm.audit` call. Pass or fail is derived in code, not read from the model verdict. Each
issue is recorded as `RecordedIssue` with `blocking`. From `dm.audit`, kinds `ledger-mismatch`, `invented-mechanics` and
`player-agency` may block; `doctrine` and `other` are advisory and logged with an
`[advisory]` prefix. A `player-agency` issue blocks only when its `actor` (optional, set by the model, TASK-0214) names a party member, or, with no `actor`, when its detail does
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
scene start (then "X and Y are here." for the party and "... here too." for present NPCs), one sentence per refusal, roll outcome, public change and event (a drop to unconscious is voiced once, not again for its hp-zero condition, TASK-0212), "What does X do?"
for each clarify (the question voiced when speakable, else "What does X do?"), and a scene-end line. Spec 077 asks reach this path as clarify facts, so their questions are voiced the same way (specs/073). It holds no digit, system word or tracker name, passes
`deterministicChecks` by construction and is never sent to `dm.audit`. `factualSummary(facts, state?)` passes
each roll reason through `checkClaims` in `reasonUsable` (a refused reason is not voiced), and
says "<name> dies" instead of "is dead" for a numbered name ("Goblin three"), which the checker
would read as the count word. With no roll, an NPC turn first voices its planned line as `<Name> calls out, "<line>."` (quotes stripped, `reasonSpeakable` and a `checkClaims` pass required, spec 081; narrate withholds a refused line; a held plan with no steps still ships when it has a line), else the first speakable planned reason (`reasonSpeakable`), else an intent sentence ("speaks up", "shifts ground", "lends a hand"), else "<name> holds back, watching."; "makes a move" is gone. It ships after three
failed attempts, a failed audit call or a failed regeneration, with a `dm`-visibility journal
flag.

## Prompt versions

`dm.react-v2` (talk path, purpose `dm.narrate`), `dm.narrate-v21` (TASK-0238, spec 088: a refused action's fact line reads `it did not happen; nothing was rolled and nothing changed`, `buildNarrationFacts` gives it no `followUps`, and the SYSTEM rule forbids showing it succeed, fail or land; the fallback skips its change sentences), v20 (TASK-0244, spec 087: `NarrationFacts.held` renders a `Waiting: "<text>" waits for <name>'s turn; nothing has happened yet.` line after `Off turn:`, a held group is never an Action, and every combatant a ran group's steps name is on turn, so `turn.offTurn` omits it), v19 (TASK-0242: a hit's separate damage roll, `FactRoll.damage`, renders `damage dealt: <n> <type> to <target>` from the `hp.changed` row in the same batch, or `damage rolled; no hit points lost`, never `no result`; collectFacts sets it on a `damage`-purpose roll with no outcome row, so the audit no longer reads an NPC wound as unsupported), v18 (TASK-0214, spec 085: the shared `TURN_RULE`, the `Off turn:` line from `turn.offTurn`, NPCs get "words, looks and feelings", never end on "What do you do?"; `narrateAttempt` drops a trailing stock sentence, `dropStockEnding`; `withholdRefusedInputs` also blanks a `goalNote` that states a count, `hasCountClaim`), v17 (TASK-0128, spec 084: an `assist` change renders as `<helper> helps <target>` or `<helper> distracts <target>`); v16 (TASK-0171, spec 076: the scene-start opening section); v15 (TASK-0211: a `spends a level N spell slot` change line appears only for an engine spend; v14, TASK-0213: a `Joined the fight` fact lists a pulled NPC's initiative roll; v13, spec 081: a Monster turn `says:` line is spoken in the beat; v12, spec 080: the roll line reads `outcome (settled)` and `learned (settled)`; a success means the task happens; v11, specs/070: tell the declared band and consequence, invent no other; v10, specs/079, adds the reaction roll line and `Earlier beat, not yet attempted:` lines; v9, specs/074: the agency rule and reflex lines; specs/073 made the clarify question the one either-or ending allowed, voiced in the fallback), `dm.audit-v16` (TASK-0237, spec 089: a section "Success outcomes that did not happen" lists each roll's `FactRoll.unmetSuccess`, the success text a `failure` or `severe-failure` band left unmet, and rule 7 says showing it is `ledger-mismatch`; `deterministicChecks` also blocks an absent NPC it names through `unmetReveals` and skips the `dm.audit` call; narrate never renders `unmetSuccess`), v15 (TASK-0203: the shape names the five kinds, says an off-turn act is `invented-mechanics`, and says omit `actor` rather than null; `normalizeAudit` coerces an unknown kind to `other`), v14 (TASK-0246: rule 6 also blocks an off-turn actor readying for a next action and says watching, waiting and turning to a noise are not turn actions), v13 (TASK-0240: the audit rule says a listed reflex, a flinch on a foe's miss included, is never `player-agency`; `namesOnlyReflex` also downgrades a `player-agency` issue to advisory in `llmIssueBlocksFor` when its detail names a `REFLEX_VERBS` form and no `DEFENCE_VERBS` form, `INTENT_MARKERS` phrase, dodge, timing, step or negation), v12 (TASK-0214: rule 6 is `TURN_RULE`; issues may carry `actor`), v11 (TASK-0128: version bump with the assist fact, since audit renders facts through narrate's `factEntries`); v10 (TASK-0211: version bump with the slot-spend fact; v9, spec 081: the audit sees the `says:` line; v8, spec 080: also `ledger-mismatch` when the prose does not deliver the settled outcome or learned fact; v7, specs/070: report `ledger-mismatch` when the prose tells another band or consequence; v5, specs/074: two agency checks), `dm.director-v10` (TASK-0237: `goalNote` states no roll-decidable result), v9 (TASK-0238: monster arrivals), v8 (TASK-0203: `goalNote` is its own top-level key), v7 (TASK-0214: the `goalNote` states no count, morale or trigger), v6, `dm.chronicle-v4`, `dm.companion-v8` (TASK-0203: write all four keys), `dm.interpret-v10` (spec 081: a monster reading may carry `say`, its spoken line, at most 200 characters), `dm.adjudicate-v7` (specs/070 added stakes to both; spec 080 requires `stakes.success`). The agency rule (`agencyRule`, `doctrine.ts`) renders into narrate and audit. Facts carry `involuntary` reflexes (`deriveInvoluntary`, specs/074): a stagger on a critical hit, a heavy-hit reaction, a flinch on a failed save, a flinch on a foe's miss; narrate lists each as a `Reflex:` line. Narrate v5 (spec 051) says a fact or the state sections may name a character dead or unconscious, and a dead, unconscious, stable or absent character does not act or speak. (For companion: v3 on the
snapshot branch added the `seat` state view; v4 added the react trigger and the withdraw and
revise decisions; companion v5 is both together; companion v6 (TASK-0189) adds the "Post that triggered you" section naming the speaking PC and whom the post addressed; see [[dm-runtime]]). The snapshot bumped narrate, audit,
director, interpret, adjudicate and chronicle too. Narrate v6 (TASK-0182, specs/064) adds the rule "A not-yet-attempted step has not happened. Stop before it; never show it start."; `FactAction.followUps` render as `not yet attempted: <text>` lines, and `withholdRefusedInputs` drops a refused follow-up. Interpret v5 and director v4 came in the same task. Narrate v7 and audit v4 (TASK-0193, specs/071) add the `Turn:` and `Next:` lines (from `NarrationFacts.turn`, set only in turn mode) and the rule that only the Turn actor acts in the beat; audit definition 6 treats showing the Next actor act as `invented-mechanics` (v18/v12 extend it to the Off turn characters). A monster turn also renders `planned:`, `held:` and a no-rules-effect line from `FactNpcTurn.plan`. The presence effect bumped interpret and adjudicate to `dm.interpret-v4` and `dm.adjudicate-v4`. TASK-0208 (spec 079): `FactRoll.reaction` marks an opportunity attack (from `attack.resolved.reaction`) and narrate renders it as `reaction: <name> strikes at <target> as they pull away`; `fallback.ts` `rollSentences` names the roller, not the actor, for such a roll; the audit's opposite-outcome check reads only the character's own rolls (`name` equals `characterName`); `NarrationFacts.openFollowUps` (from `follow-ups.ts`, a followUp of an earlier beat not yet attempted) renders as `Earlier beat, not yet attempted:` and `withholdRefusedInputs` drops a refused one.
