# Implementation Plan: Player agency — one rule for Director, interpret, narrate and audit

**Branch**: `task-0113-player-agency` | **Date**: 2026-11-02 | **Spec**: [spec.md](spec.md)

**Input**: `specs/074-player-agency/spec.md`, card TASK-0113 (ruling 2026-10-26, research (a)–(e),
widening 2026-11-02).

## Summary

One exported rule (`AGENCY_RULE` in `dm/doctrine/doctrine.ts`) states who decides a party member's
acts. Director, interpret, narrate, `dm.audit` and the playtest auditor render it, each with one
node line. The `hero-is-theirs` doctrine pair is revised to block decisions, not reflexes. Code
derives involuntary effects (`stagger`, `heavy-hit`, `flinch`) from this turn's ledger rows into
`NarrationFacts.involuntary`; narrate and audit render them. Two deterministic audit checks hold
the rule by code: a defence verb on a missed party member, and an act or speech verb on a party
member at scene start. The playtest auditor lists the party with controllers. `FactRoll` reserves
`band` for TASK-0127.

## Technical Context

**Language/Version**: TypeScript (Node 22), as the repo.
**Primary Dependencies**: Zod, Vitest. **No new runtime dependency** (checkpoint C5 not reached).
**Storage**: none. **No migration.** No event type, no event field.
**Testing**: Vitest unit tests; one DB integration test (`talk-turn.integration.test.ts`) re-pins a
version and runs with `REQUIRE_DATABASE=1`. Fake gateway only; no paid run.
**Target Platform**: the server's DM runtime and the playtest auditor.
**Project Type**: monorepo web service.
**Performance Goals**: no new model call. Each prompt grows by the rule (about 120 tokens) once.
**Constraints**: frozen contracts unchanged (`ws-protocol.md` frames, `specs/029-proposal-gate/
contracts/`, `specs/030-play-route/contracts/proposal-seam.md`). `facts.ts` imports no engine value.
Avoid `nodes/resolve.ts` and `fallback.ts` (TASK-0209, spec 073, edits them in parallel).
**Scale/Scope**: 11 source files (0 new), 10 test files (1 new) plus 1 new fixture, 4 spec
contracts, 6 wiki notes plus `CAPSULES.md`/`INDEX.md`.

## Constitution Check

Against `.specify/memory/constitution.md` 2.0.0. Re-checked after design: unchanged.

- [x] **I. Agent-operable**: no human-only path. The rule is code text; tests prove it.
- [x] **II. Content contract**: no content shape changes. Seeds are read, not changed.
- [x] **III. Data planes**: session plane only, read-side.
- [x] **IV. Event sourcing**: no new event, no new field. Facts derive from logged rows.
- [x] **V. Citations**: no rules claim shown to a player. Research (b) cites the DMG 2014 massive-
      damage threshold as a reference for the half-HP trigger only.
- [x] **VI. 5e engine boundary**: involuntary effects are derived by code from engine outcomes;
      no model decides one. No engine change.
- [x] **VII. Structured first**: `FactInvoluntary` is a typed record, rendered by code.
- [x] **VIII. Operator-owned content**: no book text. Fixtures are captured project runs.
- [x] **IX. Self-hostable**: no service, purpose or dependency.

**Stack conformance**: no departure. **Complexity Tracking**: none.

## Research

- **R1 — One source for the rule.** Doctrine pairs render through `capEntries(..., CAPS.doctrine,
  "end")`, which can drop pairs. The rule must never be cut, so it is a separate export in
  `doctrine.ts`, rendered outside the cap: `AGENCY_RULE: readonly string[]` and
  `agencyRule(node: "director" | "interpret" | "narrate" | "audit" | "auditor"): string` (the
  shared lines plus one node line). The playtest auditor already imports `DOCTRINE` from this file.
  No new module.
- **R2 — AC #2 measurement.** The only captured run on narrate-v3 is
  `specs/034-narration-quality/evidence/verify-20261026T192319Z-greyhollow-ford-provider/` (51
  `dm.narrate-v3` calls). A paid re-run is checkpoint C6 and out of scope. Three foe attacks missed
  a party member:

  | Attack seq | Narration seq | Text on the miss | Adheres |
  |---|---|---|---|
  | 79 (fire goblin → Tamsin) | 82 | "Tamsin twists just enough, and the blade bites smoke" | no |
  | 84 (lookout → Tamsin) | 87 | "buries itself quivering in a half-sunk post behind her instead" | yes |
  | 123 (pot-helm → Tamsin) | 126 | "the thrust skids wide, scraping along her sword-guard" | yes |

  Adherence 2 of 3 (67%). **Stated rate: 90%.** 67% is below it, so the fix ships: a rewritten
  prompt rule plus a deterministic check (D4) that blocks the breach by code. Earlier runs on v1/v2
  (before the rule) show the same pattern ("She wrenches clear", verify 183818Z seq 250).
- **R3 — Reflex triggers from the ledger.** All inputs are already in `p.ledger` and the
  projections: `attack.resolved` `outcome: "critical-hit"` with `targetId`; `hp.changed` change rows
  with `before`/`after` `{current,temp}`; `check.resolved` `kind: "saving-throw"`, `outcome:
  "failure"`, `ability`. Maximum HP comes from `p.engine.combatants[id].hp.max`. Death saves emit
  `death-saves.changed`, never `check.resolved`, so they never yield a flinch (verify with a test).
  Surprise has no engine fact (spec OQ-2): no startlement.
- **R4 — Optional fields.** `NarrationFacts` is built as a literal in about 28 places (tests,
  `talk-turn.ts`). `involuntary` is optional (`involuntary?: FactInvoluntary[]`), like `settled`;
  `buildNarrationFacts` always sets it. `FactRoll.band` is optional too
  (`band?: FactBand | null`); TASK-0127 may make it required when it fills it (spec 070 R10).
- **R5 — Deterministic checks reuse `namePairsWith`.** `audit-words.ts` already pairs a name with a
  verb list inside two words. New lists: `DEFENCE_VERBS` (dodge, duck, twist, sidestep, swerve,
  weave, leap, jump, roll, spin, wrench, jerk, lean) and `SCENE_START_VERBS` (`ACT_VERBS` +
  `SPEECH_VERBS` + lead, follow, head, stride, enter, approach, kneel, crouch, study, scan, weigh,
  listen), expanded with `verbForms`. `ACT_VERBS` is not edited: the claim gate reads it.
- **R6 — Scripts stay green.** Every scripted scene-start narration ("The party reaches…") names
  no party member. The runbook A script's miss text ("she turns the blow aside on her shield") uses
  no `DEFENCE_VERBS` word. The build runs the full suite to confirm.
- **R7 — Prompt version bumps.** The revised `hero-is-theirs` pair changes every prompt that
  renders it. Bumps, one past `main`: `dm.director-v5`, `dm.interpret-v6`, `dm.narrate-v8`,
  `dm.audit-v5`, `dm.companion-v7` (renders the pair), `dm.react-v2` (renders narrate doctrine),
  `playtest.audit-v2`. A later card in flight on the same prompt re-bumps at merge (runbook B rule).
- **R8 — Playtest auditor location.** The auditor is `apps/server/src/playtest/auditor/prompt.ts`.
  The runbook footprint names `.claude/skills/playtest-run/scripts/`; those scripts (`checklist.mjs`,
  `freshness.mjs`, `local-table.mjs`, `triage.mjs`, `watch.mjs`) hold no agency check. No `.claude/`
  edit is needed, so no operator question arises.

## Design

### D1 — The shared rule (`apps/server/src/dm/doctrine/doctrine.ts`)

```ts
export const AGENCY_RULE: readonly string[] = [
  "Party members are player characters, AI companions included. Each one's player decides its volitional acts: intent, speech, purposeful movement, choices, chosen emotions, and the method or skill it uses.",
  "Never state, plan or narrate a volitional act, method, skill or reaction for a party member that its player did not declare.",
  "The dice may decide a reflex: an effect listed under Reflex in the facts (a stagger on a critical hit, a heavy-hit reaction, a flinch on a failed save). A small displacement inside a reflex is colour; a position change that matters needs a fact.",
  "A condition limits what a character can do; it never decides what the character chooses. Only a recorded fact naming a control effect compels a party member.",
];
export type AgencyNode = "director" | "interpret" | "narrate" | "audit" | "auditor";
const NODE_LINE: Record<AgencyNode, string> = {
  director: "Your goal note is pacing advice. It never names a party member's act, method, skill or reaction that its player did not declare; leave those to the player and the engine.",
  interpret: "Plan for a party member only what its player declared. Add no method, skill, move, reaction or speech they did not state; when the method matters and is not stated, ask (clarify). A monster's reaction is never a step of a party member's action.",
  narrate: "Show a party member carrying out the action they declared, in plain words, and any listed reflex. Nothing more.",
  audit: "A volitional act, speech or chosen feeling of a party member beyond its declared action is `player-agency`. A listed reflex shown as a reflex is not.",
  auditor: "`hero-is-theirs` covers every party member, AI companions included. A companion's own talk rows and declared actions are its own choices, never `player-agency`.",
};
export function agencyRule(node: AgencyNode): string; // AGENCY_RULE + NODE_LINE[node], "\n"-joined
```

Revised pair (same id, same nodes):

- rule: "Never decide the hero's words, choices or chosen feelings; the dice may decide a reflex."
- wrong: `"You nod and step back, afraid."` (unchanged)
- right: `"The club catches you square; you stagger back a step."` (a critical hit)

### D2 — Director and interpret prompts

- `prompts/director.ts`: SYSTEM gains `agencyRule("director")` after the first paragraph. The
  `goalNote` shape line reads `"goalNote":str (a private pacing note, 300 characters at most; it
  names no party member's act, method, skill or reaction its player did not declare)`. Version
  `dm.director-v5`.
- `prompts/interpret.ts`: system gains `agencyRule("interpret")` before the doctrine. The user line
  becomes `Pacing: <tension>. Director's note (pacing advice only; it never adds a step, a method or
  a skill): <goalNote>`. `OUTPUT_SHAPE` and `STEP_GRAMMAR` are unchanged (the inline snapshot
  stays). Version `dm.interpret-v6`.

### D3 — Facts (`apps/server/src/dm/facts.ts`)

```ts
export type FactBand = "success" | "success-at-cost" | "failure" | "severe-failure";
// FactRoll gains: band?: FactBand | null;  // reserved for TASK-0127; this card never sets it
export interface FactInvoluntary {
  name: string;                       // the party member
  trigger: "stagger" | "heavy-hit" | "flinch";
  detail: string;                     // "critical hit by <attacker>", "heavy damage", "failed <ability> save"
}
// NarrationFacts gains: involuntary?: FactInvoluntary[];
export function deriveInvoluntary(
  rows: readonly LedgerRow[],
  party: ReadonlySet<string>,          // party combatant ids
  maxHpOf: (combatantId: string) => number | null,
  nameOf: (combatantId: string | null) => string,
): FactInvoluntary[];
```

Rules, in seq order, deduped by `name|trigger`: a `critical-hit` on a party target → `stagger`; a
damage `hp.changed` on a party subject whose loss (current+temp before minus after) is ≥ half its
maximum HP → `heavy-hit` (skip when max is null or 0); a failed `saving-throw` `check.resolved` by
a party member → `flinch` with the ability. `buildNarrationFacts` passes the union of this turn's
action, NPC-turn and settle rows (the rows it already collects) and always sets `involuntary`.

### D4 — Narrate, audit prompt and deterministic checks

- `prompts/narrate.ts`: `factEntries` renders `Reflex: <name> may <stagger|reel from a heavy hit|
  flinch> (<detail>)` lines. RULES: the party line becomes `agencyRule("narrate")`. The miss line
  becomes: "When a foe's attack misses a party member, its grab fails, or a party member succeeds
  on a save against it, tell it from the foe's side: the blow goes wide, glances off armour, finds
  only air. Never show the party member choosing a defence: no dodge, no duck, no twisting free.
  Never show a wound unless a fact records damage." The scene-start section adds: "The opening
  shows the place and what the party finds. It never moves, leads or voices a party member."
  Version `dm.narrate-v8`.
- `prompts/audit.ts`: definition 1 becomes `agencyRule("audit")` plus "Showing a party member carry
  out their declared action is allowed. Words, moves and feelings of every other character are the
  world's, never `player-agency`." Version `dm.audit-v5`.
- `nodes/audit.ts` `deterministicChecks` adds two blocking `player-agency` checks:
  1. **Miss defence**: for each roll with outcome `miss` whose `target` is a party name (actions and
     the NPC turn), unless that member's own `FactAction.text` this beat matches `DEFENCE_VERBS`, the
     prose pairing an alias of the member (full, first and last name, ≥ 3 letters, as the opposite-
     outcome check) with a `DEFENCE_VERBS` form fails: `The prose shows <name> choosing a defence
     ("<match>") on a recorded miss.`
  2. **Scene-start hero**: when `facts.trigger === "scene-start"`, the prose pairing any party alias
     with a `SCENE_START_VERBS` form fails: `The opening moves or voices <name> ("<match>").`
  Detail quotes at most 60 characters of the match.

### D5 — Playtest auditor (`apps/server/src/playtest/auditor/prompt.ts`)

The user prompt gains a `## Party` section after Doctrine: one line per `seed.characters` entry,
`<name> (human player)` or `<name> (AI companion)` from `seat`, or `(party unknown)` when the seed is
null, then `agencyRule("auditor")`. Version `playtest.audit-v2`.

## Files the build touches

Every path below is the full list. A build that needs another file stops and amends this list.

**Phase 1 — rule source, Director, interpret, playtest auditor (AC #3, #4, #5)**
- `apps/server/src/dm/doctrine/doctrine.ts` (`AGENCY_RULE`, `agencyRule`, revised pair)
- `apps/server/src/dm/prompts/director.ts` (rule, goal-note line, `dm.director-v5`)
- `apps/server/src/dm/prompts/interpret.ts` (rule, note label, `dm.interpret-v6`)
- `apps/server/src/dm/prompts/companion.ts` (`dm.companion-v7`, version only)
- `apps/server/src/dm/prompts/react.ts` (`dm.react-v2`, version only)
- `apps/server/src/playtest/auditor/prompt.ts` (party section, rule, `playtest.audit-v2`)
- `apps/server/test/dm/doctrine.test.ts`
- `apps/server/test/dm/assemble.test.ts` (director version pin, rule assertions)
- `apps/server/test/dm/interpret-prompt.test.ts` (version pin, rule and note-label assertions)
- `apps/server/test/dm/companion-addressee.test.ts` (version pin)
- `apps/server/test/dm/react-prompt.test.ts` (version pin)
- `apps/server/test/dm/talk-turn.integration.test.ts` (version pin; DB suite)
- `apps/server/test/playtest/auditor-prompt.test.ts` (new)
- `specs/031-dm-runtime/contracts/doctrine.md` (the revised pair row)
- `specs/032-playtest-harness/contracts/auditor.md` (the Party section)

**Phase 2 — facts, narrate, audit (AC #1, #2; research (a)–(e))**
- `apps/server/src/dm/facts.ts` (`FactBand`, `band?`, `FactInvoluntary`, `deriveInvoluntary`)
- `apps/server/src/dm/audit-words.ts` (`DEFENCE_VERBS`, `SCENE_START_VERBS`)
- `apps/server/src/dm/prompts/narrate.ts` (Reflex lines, rules, scene start, `dm.narrate-v8`)
- `apps/server/src/dm/prompts/audit.ts` (definition 1, `dm.audit-v5`)
- `apps/server/src/dm/nodes/audit.ts` (two deterministic checks)
- `apps/server/test/dm/facts.test.ts`
- `apps/server/test/dm/narrate.test.ts` (version pins, rule assertions)
- `apps/server/test/dm/player-agency.test.ts` (new)
- `apps/server/test/dm/fixtures/player-agency-captures.json` (new; prose of verify
  20261026T192319Z seq 10, 82, 87, 126 with the minimal facts each needs)
- `specs/034-narration-quality/contracts/audit-criteria.md` (two checks, definition 1)
- `specs/034-narration-quality/contracts/narration-facts.md` (involuntary, band, rule lines)

**Phase 3 — wiki**
- `docs/wiki/dm-narration-quality.md`, `docs/wiki/dm-runtime.md`, `docs/wiki/output-claim-gate.md`
  (pins `audit-words.ts`), `docs/wiki/dm-talk-triggers.md` (pins `react.ts`),
  `docs/wiki/dm-failure-and-gates.md` (names `dm.interpret-v5`), `docs/wiki/playtest-harness.md`
  (auditor prompt), `docs/wiki/CAPSULES.md`, `docs/wiki/INDEX.md`.

Not touched: `nodes/resolve.ts`, `fallback.ts` (TASK-0209), `gates/plan-gate.ts` (TASK-0205),
`packages/dnd5e-engine` (TASK-0208), `.claude/`, `backlog/`.

## Overlap with tasks in implementation

- TASK-0209 (spec 073): `resolve.ts`, `fallback.ts`. Disjoint. Develops beside it (spine #3).
- TASK-0210: `plan-gate.ts`, `resolve.ts`, spec 058/068 files. Disjoint.
- TASK-0205 and TASK-0208 share `interpret.ts`, `director.ts`, `narrate.ts`: they develop after this
  card merges (spine #5, #7). TASK-0127 reads D3's `band` name.

## Risks

- The deterministic checks are lexical. A paraphrase ("she slips aside") passes; a world sentence
  with a party name and a list verb ("the club rolls toward Tamsin") is a subject-order false
  positive only when the name precedes the verb. `ponytail:` note in code: lexical window of two
  words; upgrade path is the claim gate's clause parser (`claims.ts`) if the playtest shows misses.
- A blocking deterministic check sends a turn to regenerate and, after three attempts, to the
  fallback. The playtest's fallback rate is the watch number (TASK-0214 measures it).
