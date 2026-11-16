# Feature Specification: The engine records surprise; the fact sheet derives startlement

**Feature Branch**: `task-0215-surprise`
**Card**: TASK-0215 (milestone m-10). Depends on TASK-0113 (spec 074, Done). Lands after TASK-0274 and TASK-0245 (both Done), per runbook finding F3.
**Created**: 2026-11-16
**Status**: Draft
**Authored against**: branch base `f5cee110` (the claim commit), cut from `origin/main` `0f0add89`. `origin/main` has no newer commit at authoring.
Source: `specs/074-player-agency/spec.md` OQ-2 ("The engine records no surprise, so the startlement trigger has no fact to derive from. **Default:** derive none in this card. The orchestrator cards "engine records surprise; facts derive startlement" for a later runbook").
Retarget: `docs/design/r1-fast-table-runbook.md` F3 ("**Recommend:** retarget AC #2 to "the fact sheet lists startlement for a surprised PC". Land 0215 after 0274 (shared `commands/encounter.ts`) and 0245."), signed at CP-5 2026-11-08 (card notes). Escape line E5: "card ACs drive (AC #2 retargeted per F3). Engine test plus fact-sheet test."
Spec 098 seam: `specs/098-fact-sheet/spec.md` ("TASK-0215 AC #2 (retargeted by F3): the sheet's settled facts carry `involuntary`. TASK-0215 adds a startle trigger there and its prompt line. The sheet shape does not change.").
Evidence: none hosted. No engine command carries surprise today, no seed declares it, and no playtest under `docs/playtests/` records one. The only "ambush" text is the `alarm` tracker note in the greyhollow seeds, which starts no surprise. No hosted run could fail this way. The engine golden-dice tests, a gate replay (FR-016) and a fact-level replay of the run-5 encounter start (FR-017) are the replay.
Operator ruling: every fix carries a test that replays the flow.
**Clarify**: skipped. The card ACs, the operator record of 2026-10-26, the SRD record and the code settle the behaviour. The judgment calls are recorded below.
**Spec Kit**: authored directly in the template shape, as specs 119 and 120 were. `.specify/feature.json` is untouched.

## Operator record this card implements

TASK-0113 card notes, research finding (b), quoted verbatim:

> (b) Reflex triggers, operator-confirmed 2026-10-26: a critical hit allows a stagger; damage of about half the character's HP or more allows a heavy-hit reaction (DMG 2014 massive-damage threshold as reference); a failed save allows a flinch matched to the effect; surprise allows startlement.

Spec 074 shipped the first three as `stagger`, `heavy-hit` and `flinch`, and the OQ-1 ruling of 2026-11-02 added `avoid`. This card ships the fourth: surprise allows startlement.

## Summary

SRD 5.2.1 `playing-the-game.combat.the-order-of-combat.initiative` (`packages/srd/data/rule.json`, p. 13):
"Surprise. If a combatant is surprised by combat starting, that combatant has Disadvantage on their
Initiative roll." Under 5.2.1 surprise changes the Initiative roll only. It skips no turn and grants
no condition. The engine has no way to say a combatant is surprised.

This card adds that input and its record, then derives the reflex:

1. Each `initiative.roll` participant gains optional `surprised: boolean`. A surprised participant
   rolls with Disadvantage folded into its mode.
2. `encounter.started` gains optional `surprised: Id[]`, the surprised participants. It is the
   engine's record. Engine state does not change.
3. `buildNarrationFacts` derives a `startle` involuntary effect for each surprised party member from
   that row. The fact sheet carries it in `settled.involuntary`, and narrate lists it as a `Reflex:`
   line.

No new command, event type or refusal code. No Intent contract change, no seed field, no migration.
The DM decides who is surprised (SRD: the GM judges who is "unaware that combat is starting"). A DM
`mechanics` proposal carries that decision today. No producer sets it in this card (OQ-1).

### SRD sources (SRD 5.2.1)

- `rule.json` `playing-the-game.combat.the-order-of-combat.initiative` (p. 13): the Surprise
  paragraph above. Its example: "if an ambusher starts combat while hidden from a foe who is unaware
  that combat is starting, that foe is surprised."
- `condition.json` `incapacitated` (p. 184), effect "Surprised": "If you're Incapacitated when you
  roll Initiative, you have Disadvantage on the roll." `invisible` (p. 184), effect "Surprise": "If
  you're Invisible when you roll Initiative, you have Advantage on the roll." Both are condition
  rules, not the surprise rule. They are out of scope (OQ-2).

## Decision record

| # | Question | Option | Verdict | Reason |
|---|---|---|---|---|
| 1 | What surprise does mechanically | A. A lost first turn (the 2014 rule) | Rejected | SRD 5.2.1 removed it. The rule text states Disadvantage on Initiative only. |
| 1 | | B. Disadvantage on the surprised combatant's Initiative roll | **Chosen** | The 5.2.1 record, verbatim. |
| 2 | Who decides surprise | A. The engine, from Stealth against passive Perception | Rejected | Hidden state is not tracked (`packages/planner/src/checks.ts` `hide`: unserved `hidden-state`). The SRD leaves awareness to the GM. |
| 2 | | B. The producer of `initiative.roll` states it per participant | **Chosen** | The engine owns the number; the DM owns the judgment. The command already carries a per-participant `mode`, so the input is one optional flag beside it. |
| 3 | The command input | `participants[].surprised?: boolean`, omitted meaning not surprised | **Chosen** | The smallest input the existing encounter-start command carries. Every current producer omits it, so none changes. |
| 4 | The roll mode | `foldMode(p.mode, surprised ? ["disadvantage"] : [])` | **Chosen** | The engine's one fold rule. A surprised participant whose producer also asked for Advantage (for example an Invisible one) rolls normal, as Advantage and Disadvantage cancel. |
| 5 | Where the record lives | A. A list on `EncounterSchema` | Rejected | Nothing reads it after the roll under 5.2.1. A state list would need a lifetime rule for `initiative.leave` and `combatant.depart`, for no reader. |
| 5 | | B. `encounter.started.surprised?: Id[]`, an event field only | **Chosen** | The log is the record. `evolve` reads `after` only, so state, `replay` and every encounter spread stay unchanged. |
| 6 | The event field's shape | Participant ids in command order, at least 1. Omitted when none is surprised | **Chosen** | An omitted key keeps every existing `encounter.started` payload byte-identical. Optional, so `v: 1` rows still parse. |
| 7 | `initiative.join` | No surprise | **Chosen** | The rule names a combatant "surprised by combat starting". A joiner arrives after combat started. |
| 8 | Who gets startlement | Party members only: every combatant id a `party.member.changed` row names | **Chosen** | The card AC says "a surprised PC". `AGENCY_RULE` says "Party members are player characters, AI companions included", the same `party` set `deriveInvoluntary` uses. A surprised monster derives none. |
| 9 | Where the fact is derived | A new pure `deriveStartle(rows, party, nameOf)` in `dm/facts.ts`, over the turn's public appended rows | **Chosen** | The ledger change row copies only `before` and `after` (`session-model/src/projections/ledger.ts`), so it drops the event field. `buildEvents` already reads `encounter.started` from `appendedRows` the same way. `packages/session-model/src` is untouched. |
| 10 | The trigger name and text | `trigger: "startle"`, `detail: "surprised as the fight starts"`, prompt phrase `startle` | **Chosen** | "Startlement" is the operator's word; the trigger names follow the verb form (`stagger`, `flinch`). The line reads `Reflex: Tamsin Vale may startle (surprised as the fight starts)`. |
| 11 | Order in `involuntary` | Startle entries first, then `deriveInvoluntary`'s | **Chosen** | Initiative is rolled before any turn's rows. One startle per name. |
| 12 | The sheet shape | Unchanged. The sheet carries the entry in `settled.involuntary` | **Chosen** | Spec 098: "The sheet shape does not change." Narrate already renders `settled` through `factEntries`. |
| 13 | The agency rule's reflex list | Add "a startle when surprised as a fight starts" to the `AGENCY_RULE` reflex line | **Chosen** | The line enumerates every reflex the facts can list. Spec 074 T013a amended it the same way for `avoid`. |
| 14 | Prompt versions | Bump every prompt that renders the changed text: `dm.narrate-v27`, `dm.director-v13`, `dm.interpret-v19`, `playtest.audit-v3` | **Chosen** | Spec 074 R7: a prompt whose text changes takes the next version. `agencyRule` renders into those four (`doctrine.ts` callers). |
| 15 | Producers | No producer change in this card | **Chosen** | `start_combat` would need an Intent field, a contract change. The Director's seed encounter would need a seed field. Each is a judgment the card does not hold (OQ-1). A DM `mechanics` proposal sends `surprised` today. |
| 16 | Hosted replay | Engine golden-dice tests, a gate replay and a fact-level replay of run 5 | **Chosen** | No hosted flow failed. The gate test replays an AI DM `mechanics` start through `planProposal`. The fact test replays the run-5 encounter start (seq 39 to 58) with a surprised party. |

## Acceptance criteria map

| Card AC | Requirements | Success criteria | Phase |
|---|---|---|---|
| #1 The engine records which combatants are surprised when an encounter starts, with an engine test | FR-001–FR-006, FR-015, FR-016, FR-018 | SC-001, SC-002, SC-005 | 1 |
| #2 The fact sheet lists a startlement involuntary effect for a surprised PC, with a test | FR-007–FR-014, FR-017 | SC-003, SC-004, SC-006 | 2 |
| Grounding freshness | FR-019 | SC-007 | 3 |

## User scenarios

### US1 — An ambush catches Tamsin (P1)

Goblins hidden in the reeds open the fight. The human DM starts combat with Tamsin marked surprised.
Her Initiative roll shows two d20s and keeps the lower. The ledger's `encounter.started` row names
her as surprised.

### US2 — The narrator may show the start (P1)

The same turn's fact sheet lists `Reflex: Tamsin Vale may startle (surprised as the fight starts)`.
The narrator may show her start at the first blade. It still never decides what she does next.

### US3 — A surprised goblin gives no reflex (P2)

The party ambushes a goblin. The goblin rolls with Disadvantage. No reflex line names it.

### US4 — Every shipped start is unchanged (P2)

The Director and `start_combat` send no `surprised`. Their `dice.rolled` and `encounter.started`
rows are identical to today's.

## Requirements

### Engine: command (`packages/dnd5e-engine/src/schema/commands.ts`)

- **FR-001**: Each `initiative.roll` participant MUST gain `surprised: z.boolean().optional()`.

### Engine: event (`src/schema/events.ts`)

- **FR-002**: `encounter.started` MUST gain `surprised: z.array(Id).min(1).max(50).optional()`.
  `EngineEventSchema` stays `v: 1`.

### Engine: handler (`src/commands/encounter.ts`)

- **FR-003**: `handleInitiativeRoll` MUST roll a participant with `surprised: true` at
  `foldMode(p.mode, ["disadvantage"])`. Every other participant rolls at `p.mode`, as today.
- **FR-004**: `encounter.started` MUST carry `surprised`: the ids of participants with
  `surprised: true`, in command order. The key MUST be omitted when there are none.
- **FR-005**: The refusals, their order and refuse-before-draw MUST NOT change. `initiative.join`,
  `EncounterSchema`, `evolve` and `replay` MUST NOT change.
- **FR-006**: The `handleInitiativeRoll` doc comment MUST cite the SRD record id
  `playing-the-game.combat.the-order-of-combat.initiative`.

### Server: facts (`apps/server/src/dm/facts.ts`)

- **FR-007**: `FactInvoluntary.trigger` MUST gain `"startle"`.
- **FR-008**: `facts.ts` MUST export `deriveStartle(rows: readonly StoredEvent[], party: ReadonlySet<string>, nameOf: NameOf): FactInvoluntary[]`.
  It reads each public `encounter.started` row's `payload.event.surprised`, in seq order. For each
  id in `party` it adds `{ name: nameOf(id), trigger: "startle", detail: "surprised as the fight starts" }`,
  once per name.
- **FR-009**: `buildNarrationFacts` MUST set `involuntary` to
  `[...deriveStartle(input.appendedRows, partyIds, nameOf), ...deriveInvoluntary(...)]`.

### Server: prompts and doctrine

- **FR-010**: `prompts/narrate.ts` `REFLEX_PHRASE` MUST map `startle` to `"startle"`.
- **FR-011**: The `AGENCY_RULE` reflex line in `dm/doctrine/doctrine.ts` MUST read
  "(a stagger on a critical hit, a heavy-hit reaction, a flinch on a failed save, a flinch on a
  foe's miss, a startle when surprised as a fight starts)". The rest of the line is unchanged.
- **FR-012**: `PROMPT_VERSION` MUST become `dm.narrate-v27` (`prompts/narrate.ts`),
  `dm.director-v13` (`prompts/director.ts`) and `dm.interpret-v19` (`prompts/interpret.ts`).
  `AUDITOR_PROMPT_VERSION` MUST become `playtest.audit-v3` (`playtest/auditor/prompt.ts`).

### Server: fact sheet (`apps/server/src/dm/fact-sheet.ts`)

- **FR-013**: `fact-sheet.ts` MUST NOT change. The sheet carries the entry in `settled.involuntary`.
- **FR-014**: No other server source changes. The Director, `resolve.ts`, the planner and the
  Intent package send no `surprised`.

### Replay (operator ruling)

- **FR-015**: `packages/dnd5e-engine/test/commands/encounter.test.ts` MUST gain
  `describe("spec 121: surprise")` with the SC-001 and SC-002 cases, scripted dice only.
- **FR-016**: `packages/session-model/test/gate-plan.test.ts` MUST gain
  `describe("spec 121: surprise through the gate")` with the SC-005 case.
- **FR-017**: `apps/server/test/dm/fact-sheet.test.ts` MUST gain
  `describe("spec 121: startlement on the fact sheet")` with the SC-004 cases.
  `apps/server/test/dm/facts.test.ts` MUST gain `describe("deriveStartle (spec 121)")` with the
  SC-003 cases.

### Contracts

- **FR-018**: `specs/026-dnd5e-engine/contracts/commands.md` and `events.md` MUST each gain an
  "Amended by specs/121-engine-surprise (TASK-0215)" section (plan D6).
  `specs/074-player-agency/spec.md` OQ-2 MUST gain one line: "Closed by spec 121 (TASK-0215)."

### Wiki

- **FR-019**: The wiki MUST be re-pinned with worded prose where behaviour changed (tasks Phase 3).

## Success criteria

- **SC-001**: Surprise rolls in `encounter.test.ts`, each with combatants `a` and `b` at bonus 0:
  - `a` surprised, `b` not, faces `[15, 4, 10]`: `a`'s `dice.rolled` has `mode` `disadvantage`,
    `faces` `[15, 4]`, `natural` 4 and `total` 4; `b`'s has `mode` `normal` and `total` 10;
    `encounter.started` has `surprised` `["a"]` and order `b`, `a`;
  - `a` surprised with `mode: "advantage"`, faces `[7, 12]`: `a`'s roll has `mode` `normal`,
    one face, `total` 7; `b` totals 12;
  - `a` surprised with `mode: "disadvantage"`, faces `[9, 3, 10]`: `a` keeps 3, `mode`
    `disadvantage`;
  - both surprised, faces `[15, 4, 2, 18]`: `surprised` `["a", "b"]`, in command order;
  - no participant surprised, and separately `surprised: false` on `a`: the `encounter.started`
    event has no `surprised` key.
- **SC-002**: State and refusals in `encounter.test.ts`:
  - after `settle` on the first SC-001 case, `state.encounter` has no `surprised` key and
    `EngineStateSchema` parses the state;
  - a dead participant with `surprised: true`: `TARGET_DEAD` before any draw
    (`expectRefusedBeforeDraw`).
- **SC-003**: `deriveStartle` in `facts.test.ts` (party `{ ana }`, names Ana and Goblin):
  - one public `encounter.started` row with `surprised` `["ana", "goblin"]`: exactly
    `[{ name: "Ana", trigger: "startle", detail: "surprised as the fight starts" }]`;
  - the same row with `visibility: "dm"`: `[]`;
  - a row with no `surprised` key: `[]`;
  - two such rows naming `ana`: one entry.
- **SC-004**: Fact-level replay in `fact-sheet.test.ts`. Take the run-5 fixture
  (`fixtures/run5-narration-quality.json`) and set seq 50's `payload.event.surprised` to
  `["tamsin", "odo", "goblin-3"]`. Build facts over seq 39 to 58, as the facts v2 test does, then
  `buildFactSheet` over them:
  - `sheet.settled.involuntary` equals `[{ name: "Tamsin Vale", trigger: "startle", ... }, { name: "Brother Odo", trigger: "startle", ... }]`,
    both with `detail` `surprised as the fight starts`. No entry names `Goblin lookout`;
  - `factEntries(sheet.settled)` contains `Reflex: Tamsin Vale may startle (surprised as the fight starts)`;
  - the unpatched fixture gives no `startle` entry.
- **SC-005**: Gate replay in `gate-plan.test.ts`. Over `dmFold()`, the AI DM's `mechanics`
  `initiative.roll` with `ana` surprised and `goblin` not, faces `[15, 4, 10]`:
  - rows are `dice.rolled` (ana, `mode` `disadvantage`, `total` 4), `dice.rolled` (goblin,
    `total` 10), `encounter.started` with `payload.event.surprised` `["ana"]`;
  - folding the rows gives `encounter.activeCombatantId` `goblin`.
- **SC-006**: The prompt pins read the FR-012 versions. `doctrine.test.ts` asserts the
  `AGENCY_RULE` text contains "a startle when surprised as a fight starts". Every existing test
  passes; any test that changes is listed in the commit message with the reason.
- **SC-007**: `pnpm ci:check` is green. `node scripts/check-boundaries.mjs` exits 0. The wiki plan
  prints nothing. The wiki freshness gate exits 0.

## Scope

- **In**: the `surprised` participant flag and its Disadvantage; the `encounter.started`
  `surprised` field; `deriveStartle` and the `startle` trigger; the narrate phrase; the agency
  rule line; the four prompt versions; the tests; the contract notes; the wiki.
- **Out**: any producer that sends `surprised` (OQ-1); the Incapacitated and Invisible Initiative
  effects (OQ-2); a surprise list in engine state (decision 5); any Intent, seed, web, migration or
  fact-sheet shape change.

## Open questions

- **OQ-1**: No producer sets `surprised`, so only a DM `mechanics` proposal sends it today. A live
  ambush needs the Director, or `start_combat`, to carry it. `start_combat` needs an Intent field,
  an Intent contract change. The Director needs a seed field naming who is surprised. Default: out
  of this card. Recommend the orchestrator cards "a seed encounter or `start_combat` states who is
  surprised", with the trigger: the first seed with an ambush encounter.
- **OQ-2**: The Incapacitated condition gives Disadvantage on Initiative, and the Invisible
  condition gives Advantage (`condition.json` `incapacitated`, `invisible`). The engine does not fold
  conditions into Initiative today. Default: out of this card. Recommend a card with the trigger: a
  seed that starts a fight with an Incapacitated or Invisible combatant.
