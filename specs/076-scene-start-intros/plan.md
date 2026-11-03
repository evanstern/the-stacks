# Implementation Plan: Scene-start intros

**Branch**: `task-0171-scene-start-intros` | **Date**: 2026-11-02 | **Spec**: [spec.md](spec.md)

**Input**: `specs/076-scene-start-intros/spec.md`, runbook B lane B4, spine #17
(`docs/design/m3-runbook-b-resolution-quality.md`). This plan assumes OQ-1 (a), OQ-2 (a) and
OQ-3 (a). OQ-1 is resolved by operator ruling (2026-11-02): "The opening should name the
characters, not the players". Amended 2026-11-02 after merging `origin/main` (TASK-0113, 0209,
0205, 0206 merged). Research, data model and contracts are small, so they live in this file; there is no
separate research.md, data-model.md or quickstart.md.

## Summary

The seed's `opening` gains a required `premise`. The player-facing seed view carries it. At scene
start only, the narrate prompt replaces its two scene lines with an opening section: location
(name, features, mood, senses), premise, goal statement, framing, each party character (class,
look) and each NPC present at the first beat (role, look), plus the rule to name them all, and no
player, before one open closing question. TASK-0113's scene-start agency rule moves into the
section verbatim. The narrate node derives the scene-start NPC list from
the first beat's declaration and the logged presence, not from the Director's beat. A new
deterministic audit check blocks a scene-start narration that leaves a name out or names a player
or controller, and the scene-start fallback names everyone. Every other trigger is unchanged. No migration, no route, no
new dependency.

## Technical Context

**Language/Version**: TypeScript (Node 22), as the repo.
**Primary Dependencies**: Zod, Vitest. **No new runtime dependency.**
**Storage**: none changed. The seed is a JSON file read at load. No event shape changes.
**Testing**: Vitest unit tests; one DB integration test (`REQUIRE_DATABASE=1` on the worktree
stack) on the fake gateway.
**Target Platform**: server DM runtime (`apps/server/src/dm/`).
**Project Type**: monorepo web service.
**Constraints**: player-facing prompts take `PlayerSeedView` only (spec 034). Non-scene-start
narration is byte-identical in prompt and checks (FR-015). Frozen contracts untouched.
**Scale/Scope**: 6 source files, 5 seed data files, 9 DM script files (1 new), 4 contract
amendments, 2 new test files, 3 extended test files. Unchanged by the OQ-1 ruling: the ruling
removes the controller from the opening and adds no file.

## Constitution Check

Against `.specify/memory/constitution.md` 2.0.0. Re-checked after design: unchanged.

- [x] **I. Agent-operable**: the premise is seed data an agent authors and the loader validates
      with a named issue. The name check reports which name is missing, in the audit record.
- [x] **II. Content contract**: no codex entity. The seed schema change is validated at load.
- [x] **III. Data planes**: session plane only. The seed is read at scene start, as today.
- [x] **IV. Event sourcing**: no event changes. The present-NPC list reads logged presence (S1),
      never the seed alone, except to bound it by the first beat's declaration.
- [x] **V. Citations**: no library claim. N/A.
- [x] **VI. 5e engine boundary**: no mechanic. The narrate import closure stays engine-free (the
      `narrate.test.ts` closure test still runs).
- [x] **VII. Structured first**: typed seed field, a pure prompt-section function, a pure check.
- [x] **VIII. Operator-owned content**: the premise is original prose in the shipped seeds. No
      book text.
- [x] **IX. Self-hostable**: no new service, container or dependency.

**Stack conformance**: no departure. **New runtime dependencies**: none.

## Research

- **R1 — Today's opening input.** `buildNarratePrompt` (`prompts/narrate.ts`, `dm.narrate-v9`)
  adds, for `facts.trigger === "scene-start"`, three lines: `Open the scene. Framing:
  <seed.openingFraming>`, TASK-0113's "The opening shows the place and what the party finds. It
  never moves, leads or voices a party member." (asserted in `narrate.test.ts`), and `Location:
  <name>. Mood: <mood>`. The party is in the prompt only as snapshot lines
  ("Tamsin Vale (party, human player): conscious"). The "Present characters" section lists
  `facts.presentNpcs` (voice, want, detail).
- **R2 — Why Wenna is missing.** `nodes/narrate.ts` passes `beatNpcIds` = the Director's chosen
  beat's `npcIds`, filtered against S1. The scene-start scripts and the real Director pick
  `ferry-house`, whose `npcIds` is `[]`, yet `beats[0].presence.wenna` is `present`. So
  `facts.presentNpcs` is empty at the opening. Spec 078 (merged) leaves this cause in place:
  `applyLegality` sets `arrivals = []` at scene start, and `offstageNpcIds` lists only logged
  `absent` NPCs.
- **R2b — Reuse of 078's helper.** `offstageNpcIds` (`nodes/director.ts`) is not imported into
  `nodes/narrate.ts`: `director.ts` value-imports `./schemas.js`, and the narrate import-closure
  test forbids `dm/nodes/schemas.ts`. S1's `presence` is built from the same `scenePresence`
  projection (`snapshot/build.ts` `presenceOf`), so the S1 filter in D5 is the same predicate.
- **R3 — Present at the first beat.** At scene start resolve logs a `removed`/`conceded` `dm` row
  for each NPC `beats[0]` declares `absent`/`yielded` (`seedPresence`). Under an AI DM, S1 then
  reads those NPCs absent or yielded. Under a human DM the rows stay pending, so S1 reads every
  NPC present. Bounding the list by `beats[0]`'s declaration (`present` or `yielded`) makes both
  paths give the same set (spec FR-007).
- **R4 — Player-safe fields.** Every field the opening section reads is player-facing in
  `specs/034-narration-quality/contracts/player-facing-context.md`: location name, features,
  mood, senses; goal statement; opening framing; NPC name, role, appearance; character name,
  class (`identity.class`), appearance. The premise is classed player-facing here. Per the OQ-1
  ruling, the opening section reads no controller kind and no user id. The shared snapshot lines
  ("Tamsin Vale (party, human player)") are unchanged (FR-015).
- **R5 — Name matching.** `nameTerms(name)` (`snapshot/aliases.ts`) gives the full name and the
  given name after title words ("Brother Odo" gives "Odo"). The audit's party-name filter already
  matches whole words with `(?<![\p{L}\p{N}_-])…(?![\p{L}\p{N}_-])`. The name check reuses both,
  case-sensitive, because names are proper nouns ("snag" the verb is not Snag).
- **R6 — Captured openings.** `specs/034-narration-quality/evidence/verify-20261026T192319Z-greyhollow-ford-provider/transcript.jsonl`
  seq 10 names Tamsin Vale, Brother Odo and Kestrel and omits Wenna Marsh. `…/run5-20261026T171359Z-greyhollow-ford-provider/transcript.jsonl`
  seq 10 names nobody. Both used seed `greyhollow-ford` (Wenna present at `beats[0]`).
- **R7b — TASK-0113's scene-start agency check.** `deterministicChecks` blocks a scene-start
  prose where a party name is followed within two words by a `SCENE_START_VERBS` form
  (`audit-words.ts`: act and speech verbs plus lead, follow, head, enter, approach, study, listen and
  others). Every D8 text and the D7 fallback must pass it. "Kestrel have followed" fails it, so
  the reed-camp text below avoids it.
- **R7 — Scripted openings name nobody.** Eight DM scripts carry a scene-start `dm.narrate` reply
  that names no one. Once the check lands, each would fail the audit, regenerate, and drain the
  strict fake provider. All eight change in the same phase as the check. The composite scripts
  must stay call-for-call equal to their parts (`dm-scripts.test.ts`, `scene.integration.test.ts`),
  and `script-env.integration.test.ts` expects the text to contain "The party reaches Greyhollow
  Ford". The scripts merged with spec 077 and 078 (`approach-reed-camp.json`, `reveal-snag.json`,
  `shoot-snag.json`) hold no scene-start narrate call; their tests compose `scene-start.json`, so
  they pick up the D8 text unchanged.
- **R8 — Isolation.** `RULES` is the system text for every trigger, so no rule is added there.
  All new instructions live in the scene-start user section. `factEntries`, `characterSections`
  and `buildAuditPrompt` are unchanged. The name check returns early unless
  `facts.trigger === "scene-start"`. `talk-turn.ts` builds its own facts with trigger `talk` and is
  unaffected.
- **R9 — Length.** The beat rule says about one hundred words, never more than one hundred fifty.
  The opening section raises that for the opening only (OQ-3 (a)). `MAX_WORDS = 220`
  (`audit-words.ts`) and `MAX_PROSE_CHARS = 1200` (`nodes/narrate.ts`) stay.

## Design

### D1 — Seed premise (`apps/server/src/dm/seed/schema.ts`; FR-001, FR-002)

```ts
opening: z.object({ framing: Text(800), premise: Text(500) }),
```

Required, no default. A seed without it fails `parseSeed` with an issue whose path is
`opening.premise`. The line is the last field of `SceneSeedSchema`; spec 070's `tableRules`
(TASK-0127) is a separate top-level key, so the hunks are disjoint.

### D2 — Shipped premises (FR-003)

Add `premise` after `framing` in each seed's `opening`:

| Seed | Premise |
|---|---|
| `greyhollow-ford.json`, `-duo.json`, `-trio.json` | "The party came to Greyhollow Ford to cross the river before full dark. Tamsin Vale carries a Greyhollow ferry token, and the ferry keeper owes her a crossing." |
| `greyhollow-ford-reed-camp.json` | "The party has followed whoever silenced the ferry bell down the causeway from Greyhollow Ford. They mean to have the ferry crossing again before full dark." |

Copy `greyhollow-ford.json` byte for byte to `specs/031-dm-runtime/data/greyhollow-ford.seed.json`
(the `seed.test.ts` copy test).

### D3 — View (`apps/server/src/dm/seed/views.ts`; FR-004)

`PlayerSeedView` gains `openingPremise: string`; `playerFacingSeed` sets it from
`seed.opening.premise`. `dmOnlyEntries` is unchanged: the premise is player-facing.

### D4 — Opening section (`apps/server/src/dm/prompts/narrate.ts`; FR-005, FR-006, FR-008 to FR-011)

Export a pure `openingSection(seed: PlayerSeedView, facts: NarrationFacts): string`. It returns
`""` unless `facts.trigger === "scene-start"`. Otherwise it returns these lines, in order:

```
## Opening
Open the scene. This is the first narration the players see.
Location: <name>. <features joined by " "> Mood: <mood> <senses joined by " ">
Why the party is here: <openingPremise>
Goal: <goalStatement>
Framing: <openingFraming>
Party:
- <name>, <class>. Looks: <appearance>
Present at the start:
- <name>, <role>. Looks: <appearance>
Introduce the place, why the party is here and what they are there to do. Name every party member and every character present listed above before you ask anything. A present character may be heard, glimpsed or expected rather than seen.
Name the characters only. Never say who plays a character or how it is played.
The opening shows the place and what the party finds. It never moves, leads or voices a party member.
This opening may run to about one hundred sixty words, never more than one hundred eighty.
End on one short open question to the party, in your own words. Never end with "What do you do?".
```

- The party list joins `facts.party` (order) to `seed.characters` by `characterId` for
  `identity.class` and `portrayal.appearance`. A member with no seed entry gets its name only. The
  controller is not rendered (OQ-1 ruling). No line of the section holds "player" or "companion".
- The present list joins `facts.presentNpcs` to `seed.npcs` by `id` for `role` and
  `appearance`. It is omitted when empty, with its "Present at the start:" line.
- The "Party:" block is omitted when `facts.party` is empty.
- In `buildNarratePrompt`, replace the `scene` array with `openingSection(seed, facts)`. Leave
  every other section as it is.
- TASK-0113's rule moves from the `scene` array into `openingSection` verbatim, as shown. The
  `narrate.test.ts` assertion on it stays green unchanged.
- Bump `PROMPT_VERSION` from `dm.narrate-v9` (main after TASK-0113) to `dm.narrate-v10`. If 0127,
  0170 or 0208 bumps it first, take the next free version. Update the pin in `narrate.test.ts`.
  `dm.audit-v5` is unchanged: `prompts/audit.ts` is not touched.

The parameter type is `PlayerSeedView`, so passing a `SceneSeed` is a compile error (FR-011).

### D5 — Scene-start NPC list (`apps/server/src/dm/nodes/narrate.ts`; FR-007)

In `narrate`, compute `beatNpcIds` per trigger:

```ts
const s1 = (id: string) => resolve.snapshot.actors.find((a) => a.id === id)?.presence;
const beatNpcIds =
  ctx.job.trigger === "scene-start"
    ? ctx.seed.npcs
        .map((n) => n.id)
        .filter((id) => ctx.seed.beats[0]?.presence[id] !== "absent")
        .filter((id) => s1(id) !== "absent")
    : /* today's expression, unchanged */;
```

Seed order is kept. The full seed is read here, as today; only ids leave this function. The S1
filter is `offstageNpcIds`'s predicate (R2b); do not import that helper.
`buildNarrationFacts` (`facts.ts`) is unchanged.

### D6 — Name check (`apps/server/src/dm/nodes/audit.ts`; FR-012, FR-013)

Add an exported pure helper and one block at the end of `deterministicChecks`, before the dice-line
check:

```ts
/** The prose before its closing question: the text up to the last sentence end before a final "?". */
export function beforeClosingQuestion(prose: string): string;
/** True when `text` holds `name`'s full or given name as a whole, case-sensitive word. */
export function namesCharacter(text: string, name: string): boolean;
```

- `beforeClosingQuestion`: trim; if the text does not end with `?`, return it. Else cut at the
  last `.`, `!` or `?` followed by whitespace before the final `?`; with none, return `""`.
- `namesCharacter`: `nameTerms(name)` (no ids); a term matches with the party-name filter's
  whole-word pattern, without the `i` flag.
- Put the block inside TASK-0113's existing `if (facts.trigger === "scene-start")` block, after
  its agency loop.
- For each `facts.party` name then each `facts.presentNpcs` name not named in
  `beforeClosingQuestion(prose)`, add `("other", "The opening does not name <Name> before its
  closing question. Name every party member and every present character.")`.
- When `/\b(players?|AI companions?)\b/i` matches the prose, add `("other", "The opening names a
  player or a controller. Name the characters, not the players.")` (FR-016, OQ-1 ruling). Every
  deterministic issue already blocks.

The regenerate loop passes the issue detail back to narrate, as it does today.

### D7 — Fallback (`apps/server/src/dm/fallback.ts`; FR-014, OQ-2 (a))

In `factualSummary`'s scene-start branch, after the framing, push:

- when `facts.party` is non-empty: `<names> are here.` (one member: `<Name> is here.`), names
  joined "A, B and C", each through `spellDigits`;
- when `facts.presentNpcs` is non-empty: `<names> is here too.` / `<names> are here too.`.

With both lists empty, the output stays the framing verbatim (the existing test holds). The
property test in `fallback.test.ts` must stay green: no system word, no digit, and
`deterministicChecks` passes over the summary, including the new name check and TASK-0113's
scene-start agency check ("are here" pairs no name with a scene-start verb). The fallback names
no controller.

### D8 — Scripted openings (R7)

Replace the scene-start `dm.narrate` reply text in each file below. Keep every other call.

- Base text, for `apps/server/test/dm/scripts/scene-start.json`,
  `apps/server/test/dm/scripts/greyhollow-ford-full.json`,
  `apps/server/test/playtest/fixtures/downed-seat.json`,
  `apps/server/dm-scripts/greyhollow-live.json`, `greyhollow-human-dm.json`,
  `greyhollow-plan-approach.json`, `greyhollow-talk.json`:

  > The party reaches Greyhollow Ford as the light goes amber. Tamsin Vale, Brother Odo and
  > Kestrel came to cross before full dark, and the ferry keeper owes Tamsin a crossing. The ferry
  > sits chained to the near bank, the ferry-house door hangs open, and the bell that should have
  > rung for them stays silent. Above, in the loft, a board creaks: Wenna Marsh, the keeper, is
  > somewhere overhead and has not called down. Where do you start?

- Reed-camp text, for `apps/server/dm-scripts/runbook-a-reed-camp.json`:

  > The party reaches the end of the causeway as the light goes amber, on the trail of whoever
  > silenced the ferry bell. Tamsin Vale, Brother Odo and Kestrel mean to have the ferry crossing
  > again before full dark. Wenna Marsh keeps close with her boathook, and smoke from the goblins'
  > reed-camp curls up from the reeds ahead. Where do you start?

- TASK-0113 left these texts unchanged on main. Both texts pass its scene-start agency check
  (R7b) and the new name check; the Phase 3 test asserts it.
- New `apps/server/test/dm/scripts/scene-start-intro-regenerate.json`: the `scene-start.json`
  director call; a `dm.narrate` reply holding the captured R6 `verify-20261026T192319Z` seq 10
  text verbatim; a second `dm.narrate` reply holding the base text; one `dm.audit` pass. Attempt
  1 fails the code checks, so no `dm.audit` call runs for it. The test appends spare
  `dm.chronicle` calls, as `duo.integration.test.ts` does.

## Contracts (additive amendments)

- `specs/031-dm-runtime/contracts/scene-seed.md`: append "Amended by spec 076 (TASK-0171)":
  `opening.premise` (1..500 chars), required.
- `specs/034-narration-quality/contracts/player-facing-context.md`: append "Amended by spec 076":
  `opening.premise` is player-facing; `PlayerSeedView.openingPremise: string`.
- `specs/034-narration-quality/contracts/audit-criteria.md`: append "Deterministic checks
  (amendment, spec 076)": the scene-start name check of D6, blocking.
- `specs/034-narration-quality/contracts/fallback-summary.md`: amend the `scene-start` row: the
  framing, then the party sentence and the present-NPC sentence of D7.
- Not edited: `specs/029-proposal-gate/contracts/*`, `specs/030-play-route/contracts/proposal-seam.md`,
  `docs/wiki/ws-protocol.md`.

## Tests

- `apps/server/test/dm/seed.test.ts`: a seed without `opening.premise` fails with an issue naming
  `opening.premise`; every `listSeeds()` seed has a non-empty premise; the premise holds no
  DM-only string of its seed (`dmOnlySeedText`).
- `apps/server/test/dm/narrate.test.ts`: the version pin (`dm.narrate-v10`); the TASK-0113 opening
  rule assertion stays green unchanged; a scene-start narrate-node case on the
  base seed: Director beat `ferry-house` and beat `reed-camp` both give
  `facts.presentNpcs` ids `["wenna"]`; with S1 reading `wenna` absent, `[]`. A `commit` case keeps
  today's beat-derived list. The existing spec-050 case passes unchanged.
- `apps/server/test/dm/scene-start-intros.test.ts` (new, pure):
  - `openingSection` over the duo seed holds the location features, mood and senses, the premise,
    the goal, the framing, "Tamsin Vale, Fighter.", "Brother Odo, Cleric.", "Kestrel, Rogue.",
    "Wenna Marsh, ferry keeper", the name rule, TASK-0113's opening rule and `"What do you do?"`
    only inside the "Never end with" line. The section holds no "player", no "companion", no
    user id (OQ-1 ruling).
  - `openingSection` returns `""` for `commit`, `npc-turn` and `talk` facts; the full
    `buildNarratePrompt` text for a `commit` facts object equals today's (snapshot the string
    before the change, or assert no "## Opening" and the old two lines absent only for scene start).
  - For each of the four shipped seeds, the scene-start `buildNarratePrompt` text holds none of
    `dmOnlySeedText(seed)` and no user id.
  - Type-level: `// @ts-expect-error` on `openingSection(SEED, facts)` with the full seed.
  - `beforeClosingQuestion` and `namesCharacter` cases: given name, title skip, whole word
    ("Snagged" is not Snag), case ("snag" is not Snag), family name alone does not count, a name
    only in the closing question does not count.
  - Captured replay (AC #4, SC-003): `deterministicChecks` over the R6 `verify` text with
    Greyhollow facts (party Tamsin Vale, Brother Odo, Kestrel; present Wenna Marsh; trigger
    `scene-start`) reports exactly one name issue, naming Wenna Marsh. The `run5` text reports
    four. The D8 base and reed-camp texts report no deterministic issue of any kind (name, agency,
    digits, word cap). The texts are pasted as constants citing their source paths.
  - Controller check (FR-016): the D8 base text plus "Kestrel, the AI companion, waits." at scene
    start reports one controller issue; "the players arrive" reports one; the same texts on
    `commit` report none.
  - The same captured text with trigger `commit` reports no name issue (FR-013).
- `apps/server/test/dm/fallback.test.ts`: scene-start facts with a party of two and one present
  NPC give the framing, then "Ana and Bram are here.", then "<Npc> is here too."; the summary
  passes `deterministicChecks`.
- `apps/server/test/dm/scene-start-intros.integration.test.ts` (new, DB; AC #3): a duo-seed scene
  start through the real queue with `scene-start-intro-regenerate.json`. The audit record has two
  attempts, attempt 1 blocked with the Wenna issue; the shipped `narration` row names Tamsin Vale,
  Brother Odo, Kestrel and Wenna Marsh before its closing question and is not a fallback; the
  scripted provider has no `dm.narrate` or `dm.audit` call left.
- Unchanged and green: `dm-scripts.test.ts`, `scene.integration.test.ts`,
  `script-env.integration.test.ts`, `duo`/`trio`/`talk-turn`/`plan-first-step`/
  `noncombatant-targets`/`attack-anyone`/`revealed-npc`/`no-undeclared-method` integration tests,
  `harness.integration.test.ts`, `player-facing-prompts.test.ts`, `duo-views.test.ts`,
  `audit.test.ts`, `player-agency.test.ts`, `narration-quality-repro.test.ts`.

## Files

| File | Change |
|------|--------|
| `apps/server/src/dm/seed/schema.ts` | D1: `opening.premise` |
| `apps/server/src/dm/seed/views.ts` | D3: `openingPremise` |
| `apps/server/src/dm/prompts/narrate.ts` | D4: `openingSection`, version bump |
| `apps/server/src/dm/nodes/narrate.ts` | D5: scene-start `beatNpcIds` |
| `apps/server/src/dm/nodes/audit.ts` | D6: name check and two helpers |
| `apps/server/src/dm/fallback.ts` | D7: scene-start names |
| `apps/server/seeds/greyhollow-ford.json` | D2 |
| `apps/server/seeds/greyhollow-ford-duo.json` | D2 |
| `apps/server/seeds/greyhollow-ford-trio.json` | D2 |
| `apps/server/seeds/greyhollow-ford-reed-camp.json` | D2 |
| `specs/031-dm-runtime/data/greyhollow-ford.seed.json` | D2: byte copy |
| `apps/server/test/dm/scripts/scene-start.json` | D8 |
| `apps/server/test/dm/scripts/greyhollow-ford-full.json` | D8 |
| `apps/server/test/playtest/fixtures/downed-seat.json` | D8 |
| `apps/server/dm-scripts/greyhollow-live.json` | D8 |
| `apps/server/dm-scripts/greyhollow-human-dm.json` | D8 |
| `apps/server/dm-scripts/greyhollow-plan-approach.json` | D8 |
| `apps/server/dm-scripts/greyhollow-talk.json` | D8 |
| `apps/server/dm-scripts/runbook-a-reed-camp.json` | D8 |
| `apps/server/test/dm/scripts/scene-start-intro-regenerate.json` (new) | D8 |
| `apps/server/test/dm/seed.test.ts` | Tests |
| `apps/server/test/dm/narrate.test.ts` | Tests |
| `apps/server/test/dm/fallback.test.ts` | Tests |
| `apps/server/test/dm/scene-start-intros.test.ts` (new) | Tests |
| `apps/server/test/dm/scene-start-intros.integration.test.ts` (new) | Tests |
| 4 contract files above | amendments |
| `docs/wiki/*` per tasks.md Phase 4 | re-ground |

**Not touched**: `apps/server/src/dm/scene-start.ts` (the start-state predicate; the runbook's
overlap row lists it, but nothing here needs it), `prompts/audit.ts`, `facts.ts`, `talk-turn.ts`,
`prompts/common.ts`, `dm/snapshot/`, `nodes/director.ts`, `audit-words.ts`, `doctrine/doctrine.ts`,
`pipeline/context.ts`, `worker.ts` (no users lookup: OQ-1 ruling).

**Corrected footprint (2026-11-02, after merging `origin/main` at TASK-0206)**: unchanged from the
table above. The OQ-1 ruling adds no file and removes no file; it removes the controller from the
opening section and adds one regex to D6. Prompt versions on main: narrate-v9, audit-v5,
director-v6, chronicle-v4; this task bumps narrate only, to v10.

**Migrations**: none. **New runtime dependencies**: none.

## Overlap

The runbook's overlap row for 0171 names `seed/schema.ts`, `seed/views.ts`, the seeds,
`prompts/narrate.ts`, `scene-start.ts` and `prompts/audit.ts`. This plan's list differs: it adds
`nodes/narrate.ts`, `nodes/audit.ts`, `fallback.ts` and eight DM scripts, and drops
`scene-start.ts` and `prompts/audit.ts`. **The orchestrator amends the runbook row** (rule:
"Any spine amendment from a plan.md overlap: tell the operator, amend this file").

- **TASK-0113 (spine #3, spec 074)**: merged. It edited `prompts/narrate.ts` (scene-start rule,
  narrate-v9) and `nodes/audit.ts` (scene-start agency check), not the scripted openings. D4 keeps
  its rule verbatim; D6 nests inside its scene-start block; D8 texts pass its check (R7b).
- **TASK-0209 (#2), TASK-0205 (#5), TASK-0206 (#6)**: merged. 0209 edited `fallback.ts` (clarify
  sentence, disjoint from the scene-start branch). 0206 edited `nodes/director.ts`, `resolve.ts`,
  `prompts/chronicle.ts` and added three scripts this task does not edit (R2, R7).
- **TASK-0208 (#7)**: shares `prompts/narrate.ts` and `fallback.ts`; merges first.
- **TASK-0127 (#8, spec 070)**: shares `seed/schema.ts` (disjoint keys), `prompts/narrate.ts`
  (`rollEntry`, a rule line in `RULES`), `fallback.ts` and three DM scripts
  (`greyhollow-human-dm.json`, `greyhollow-live.json`, `greyhollow-plan-approach.json`). 070 merges
  first; D8 edits only the scene-start narrate reply in each.
- **TASK-0104 (#13)**: shares `seed/schema.ts`; merges first.
- **TASK-0170 (#9)**, **TASK-0214 (#19)**: share `prompts/narrate.ts`; 0214 also `fallback.ts`.
  0171 merges before 0214, so 0214's audit replay sees this fallback.
- **Fallback order**: the runbook's `fallback.ts` sequence (0209 → 0208 → 0127 → 0207 → 0212 →
  0213 → 0214) gains 0171 between 0213 and 0214, which is spine order. No reorder.
- **TASK-0204 (#18)**: follows 0171 on `prompts/narrate.ts` and the deterministic checks. D4 says
  "Never end with "What do you do?"" in the opening section only; 0204 adds the code check for
  every trigger.
- **Prompt version**: each card on `prompts/narrate.ts` claims the next version; the later merge
  re-bumps and reconciles `docs/wiki/dm-narration-quality.md`.
- Per the runbook rule, 0171 develops ahead from #9 on only on disjoint files. Phase 1 shares
  `seed/schema.ts` with 0127 and 0104 and runs once both merge. Phase 2 shares
  `prompts/narrate.ts` with 0208, 0127 and 0170 and runs once they merge. Phase 3 shares
  `fallback.ts` with 0208, 0127, 0207, 0212 and 0213, and three DM scripts with 0127; it runs once
  they merge. 0214 and 0204 follow 0171.

## Open questions

OQ-1 is resolved by operator ruling: the opening names the characters, not the players. OQ-2 and
OQ-3 stand at (a), and this plan implements them. OQ-2 (b) would drop D7 and `fallback.ts`.
