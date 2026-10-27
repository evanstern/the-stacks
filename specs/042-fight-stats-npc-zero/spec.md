# Feature Specification: Fight statistics count NPCs reduced to zero

**Feature Branch**: `task-0134-fight-stats-npc-zero`

**Created**: 2026-10-27

**Status**: Draft

**Input**: User description: "TASK-0134: the playtest report's fight statistics count every
combatant reduced to 0 HP, heroes and NPCs alike."

**Board card**: TASK-0134 (m-3, sweep track B7, haiku tier). Must merge before TASK-0053, the M3
demo, which reads these statistics. TASK-0055 rested its 2026-10-26 ruling (option A) on them.

**Clarify pass**: skipped. The card states the rule ("heroes and NPCs alike"). Every other choice
below is settled from an existing artifact: the auditor contract
(`specs/032-playtest-harness/contracts/auditor.md` "Fight statistics"), the report schema
(`apps/server/src/playtest/auditor/schema.ts`), and the committed M2 demo run directory.

## The defect

The fold is `fightStats` in `apps/server/src/playtest/auditor/stats.ts`. Its `hp.changed`
branch pushes a name onto `reducedToZero` only when the subject's side is `"players"`:

```ts
if (a.current === 0 && b.current > 0 && side === "players") {
  reducedToZero.push(nameOf(r.subject));
}
```

`sideOf` returns `"npcs"` for every combatant outside the party, so an NPC dropped to 0 HP never
counts. The contract asks for "characters reduced to zero hit points" with no side filter, and
the report line renders a single list with no side label. The `side === "players"` guard is the
whole defect.

**Evidence.** The M2 demo session ledger
(`docs/design/m2-demo/demo-session/ledger.json`) holds the row `hp.changed` subject `goblin-3`,
before `{current: 7, temp: 0}`, after `{current: 0, temp: 0}`. `transcript.md` line 500 renders
it as `goblin-3 takes 7 (7→0 HP)`. The committed `report.json` has `fight.reducedToZero: []`, and
`report.md` renders "Reduced to zero: none". No party member reached 0 HP in that session (Tamsin
Vale's lowest was 1), so the true list is goblin-3 alone.

No existing test covers `reducedToZero`. The doctored fixture
(`apps/server/test/playtest/fixtures/doctored/`) has three NPC `hp.changed` rows and none ends at
0 HP.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - An operator reads how many combatants dropped (Priority: P1)

An operator reads a playtest report's "Fight statistics" to judge how lethal a fight was
(TASK-0055 used these numbers to rule on parked rules). The "Reduced to zero" line lists every
combatant whose HP reached 0 during the fight: party members and NPCs.

**Why this priority**: it is the whole card. A wrong "none" misstates the fight that a ruling
rests on.

**Independent Test**: run `fightStats` on a ledger whose only drop is an NPC. The list holds that
NPC's name.

**Acceptance Scenarios**:

1. **Given** a ledger with an `hp.changed` row that takes an NPC from positive HP to 0,
   **When** `fightStats` folds it, **Then** `reducedToZero` holds that NPC's name.
2. **Given** a ledger with an `hp.changed` row that takes a party member from positive HP to 0,
   **When** `fightStats` folds it, **Then** `reducedToZero` holds that party member's name, as
   before this change.
3. **Given** the committed M2 demo session run directory, **When** `fightStats` folds its
   transcript and ledger, **Then** `reducedToZero` is `["Goblin lookout"]` (goblin-3's name), and
   every other field equals the committed `report.json` `fight` object.

### Edge Cases

- **Display name, not id.** Entries stay display names resolved by the existing `nameOf`:
  the projected combatant's `name`, then the party member's `name`, then the raw id. goblin-3
  renders as "Goblin lookout". The M2 demo never removes goblin-3, so its name resolves.
- **Already at 0.** A row whose `before.current` is 0 does not count (no new drop). This rule is
  unchanged.
- **Dropped twice.** A combatant healed above 0 and dropped again appears twice, once per drop.
  This is the existing per-drop rule, now applied to NPCs too.
- **Temp HP.** The drop test reads `current` only, as before. Temp HP never makes a row count.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: `fightStats` MUST append to `reducedToZero` for every `hp.changed` row where
  `before.current > 0` and `after.current === 0`, whatever the subject's side.
- **FR-002**: `reducedToZero` MUST keep ledger order and the existing `nameOf` resolution.
- **FR-003**: Every other `FightStats` field MUST be unchanged by this card.
- **FR-004**: `FightStatsSchema`, the report schema, and `render.ts` MUST NOT change. The report
  line already renders any non-empty list.
- **FR-005**: The recompute of the M2 demo MUST read the committed run directory
  `docs/design/m2-demo/demo-session/` in a test. It MUST make no model or provider call.

### Key Entities

- **FightStats.reducedToZero** (`auditor/schema.ts`): `string[]` of display names, one entry per
  drop to 0 HP, ledger order. Shape unchanged.

## Acceptance criteria mapping

| Card AC | Requirement | Proven by |
|---|---|---|
| #1 The fight-statistics fold counts NPCs reduced to 0 HP | FR-001, FR-002 | tasks.md T001, T002 |
| #2 A test replays a ledger with an NPC dropped to 0 HP and asserts the count | FR-001, FR-003 | tasks.md T002 |
| #3 The M2 demo session's recomputed statistics report goblin-3 reduced to zero | FR-003, FR-005 | tasks.md T003 |

## Success Criteria *(mandatory)*

- **SC-001**: The new stats test passes, and fails when the `side === "players"` guard is
  restored.
- **SC-002**: The M2 demo recompute yields `reducedToZero: ["Goblin lookout"]` with every other
  field equal to the committed `report.json`.
- **SC-003**: `pnpm ci:check` is green with no paid run.

## Out of scope

- Regenerating `docs/design/m2-demo/demo-session/report.json` or `report.md`. A re-audit calls
  `playtest.audit` (a paid model). The committed artifacts stay as produced.
- Splitting `reducedToZero` by side. The schema and the report contract stay as they are.

## Open questions (for the orchestrator)

- **OQ-1**: `docs/design/m2-demo.md` "Fight statistics (TASK-0055 evidence)" (line 378) records
  "reduced to zero none" in an operator-signed record. This card does not edit it. Should an
  erratum line be added beside it, citing this card's recompute test? Editing it re-opens the
  `m2-demo` wiki note (the file is in its `sources:`).
