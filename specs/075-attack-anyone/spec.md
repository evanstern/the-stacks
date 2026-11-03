# Feature Specification: Attacks and damage may target anyone present, combatant or not

**Feature Branch**: `task-0210-attack-anyone`

**Created**: 2026-11-02

**Status**: Draft. Open questions OQ-1 to OQ-3 carry defaults (a); see Open questions.

**Input**: TASK-0210. Card outcome: "an attack or damage step may name any present actor. A target
outside the turn order is pulled in first (TASK-0194's pull), as checks, conditions and heals
already are." Operator ruling, 2026-11-02, runbook A playtest run 1 (session 9296c653), verbatim:
"I actually think that the rule itself is incorrect -- we should be able to attack anyone
regardless of combatant state." Evidence: `docs/playtests/2026-11-02-runbook-a-playtest.md`
findings 6, 21 and 23.

`speckit-clarify` was skipped. The card, the operator ruling and the code settle what must happen.
The open questions below are scope calls with a safe default, not card ambiguities.

## The reversal

This spec reverses spec 068 (TASK-0194) on one point:

- Spec 068 OQ-4 (a), card TASK-0194 AC #2, FR-002 and SC-002 kept an `attack` step's
  `attackerId` and `targetId`, and every `damage` effect target, refused with
  `UNKNOWN_COMBATANT` reason `not-a-combatant` when they named a non-combatant NPC.
- Under this spec those fields pull the NPC in, exactly as a `check` `combatantId` and a
  `condition` or `heal` effect target do since spec 068.
- Everything else in spec 068 stands: the pull itself, the `commoner` default block, the alias
  rule, the absent rule, the snapshot link, and the NPC-group rules.

## Background: what happens today

1. The plan gate (`checkPlan`) walks every named id of every group. Since spec 068 each named id
   carries `pullable`. It is false for an attack's `attackerId` and `targetId` and for `damage`
   effect targets.
2. A non-combatant NPC named in a non-pullable field fails `UNKNOWN_COMBATANT`, reason
   `not-a-combatant`. The group resolves `refused` and runs no step.
3. Run 1 seq 45: Kestrel's "I take aim and shoot at Snag" failed this way. Snag was absent in the
   log (the TASK-0206 gap), and before the encounter he had no engine combatant.
4. Run 1 seq 172: "I attack Pell" passed only because an earlier NPC turn had pulled Pell in. The
   same attack one turn earlier would have been refused.
5. Resolve's `pullIn` already pulls any id in a verdict's `pull` list, attack target or not. It
   needs no change.

## Terms

The terms of spec 068 hold unchanged: **named id**, **non-combatant NPC**, **pull**, **can act**.

- **Present**: the S0 actor's `presence` is not `absent`.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Shoot the goblin the DM just revealed (Priority: P1)

The scene reveals Snag at the reed camp before any fight starts. Kestrel's player writes "I take
aim and shoot at Snag." The DM plans an attack by Kestrel on Snag. The attack resolves. Snag
becomes a combatant for the engine to hit.

**Why this priority**: it is run 1 seq 45, the card's merge condition. The player lost the turn
for an obvious move.

**Independent Test**: replay run 1 seq 45 on the duo seed with a scripted DM, Snag present.
Assert the action does not resolve `refused`, and the log holds `combatant.added` for `snag`, then
an `attack.resolved` with `targetId: "snag"`.

**Acceptance Scenarios**:

1. **Given** free mode and Snag present with no engine combatant, **When** Kestrel's attack on
   `snag` resolves, **Then** the verdict is `ok` with `pull: ["snag"]`, the log holds
   `combatant.added` for `snag` before `attack.resolved`, and no `UNKNOWN_COMBATANT` refusal.
2. **Given** the same state before the reveal (Snag `absent`), **When** the same attack resolves,
   **Then** the action resolves `refused` with `UNKNOWN_COMBATANT`, reason `absent`, and Snag is
   not added.

---

### User Story 2 - Attack the captive mid-fight (Priority: P2)

During an encounter, Tamsin attacks Pell, a present captive outside the turn order. Pell is pulled
in and rolls his own initiative. The attack resolves against him.

**Why this priority**: it is the case the operator ruled on (findings 21 and 23). It replaces spec
068's "attack control" test.

**Independent Test**: the free-Pell world of spec 068 with the reading's steps replaced by an
attack on `pell`.

**Acceptance Scenarios**:

1. **Given** an active reed-camp encounter with Pell present and not a combatant, **When** an
   attack step names `pell` as `targetId` with a damage effect on `pell`, **Then** the verdict is
   `ok` with `pull: ["pell"]`, Pell gains a combatant and an `initiative.join`, and the attack
   resolves.
2. **Given** the same state, **When** the NPC group's attack names `pell` as `attackerId`,
   **Then** Pell is pulled in the same way before the attack runs (OQ-2).

### Edge Cases

- An alias names the NPC (`the boy`): the gate never maps an alias. It still fails
  `not-a-combatant`.
- An absent NPC with no combatant: it fails `absent`. Before this change it failed
  `not-a-combatant`, because the combatant check runs before the absent check. The order is
  unchanged; the NPC now passes the first check and fails the second.
- An unknown id: it still fails `not-in-snapshot`.
- A pulled actor drops or dies from the hit: normal engine rules apply. The pull rows stay; they
  are not action steps.
- Free mode: the pull adds a combatant and rolls no initiative. No encounter starts (OQ-1).
- A pulled seed-encounter monster (Snag before the encounter): a later encounter start finds his
  combatant and skips the add. He still rolls initiative with the encounter.
- A reclaim replays the turn: the pull rows are keyed submissions and land once (spec 068).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001** (card AC #1): The plan gate MUST accept the exact id of a present non-combatant NPC
  in every named-id field: `check` `combatantId`, `attack` `attackerId` and `targetId`, and every
  `condition`, `heal` and `damage` effect target.
- **FR-002** (card AC #1): An accepted actor outside the encounter order, or any such actor with
  no combatant in free mode, MUST be listed in the `ok` verdict's `pull`, as spec 068 lists it.
- **FR-003** (card AC #2): An absent actor MUST still fail, reason `absent`, code
  `UNKNOWN_COMBATANT`, in every field except a `presence` effect with reason `arrived`.
- **FR-004**: An alias MUST still fail `not-a-combatant`. An unknown id MUST still fail
  `not-in-snapshot`.
- **FR-005**: Resolve MUST pull every `pull` id before the group's steps run, as spec 068 does
  today. Resolve needs no code change.
- **FR-006** (card AC #1, merge condition): A test MUST replay run 1 seq 45 ("I take aim and shoot
  at Snag") with Snag present and resolve the attack. The same file MUST show an absent Snag is
  refused (card AC #2).
- **FR-007** (card AC #3): The 058 plan-reason-gate contract MUST record the reversal and cite the
  ruling verbatim. Spec 068 MUST carry a pointer from OQ-4 and FR-002 to this spec.
- **FR-008** (card AC #3): The wiki notes `dm-failure-and-gates`, `dm-runtime`, `turn-floor`, and
  `CAPSULES.md`/`INDEX.md` MUST record the reversal and cite the ruling.
- **FR-009**: The spec 068 tests that assert the refusal MUST be replaced, not deleted. Each keeps
  its purpose (refusal order, NPC-group refusal) with a still-refused id, or flips to assert the
  pull.

### Constitution-Driven Requirements *(mandatory)*

- **CR-001** (I. Agent-operable): the change runs inside the DM turn job; no human-only path.
- **CR-004** (VI. 5e engine boundary): the engine resolves the attack and rolls any initiative. The
  gate decides only which ids may reach it.
- **CR-006** (IV. Event sourcing): pull rows stay keyed `gate.submit` submissions (spec 068).

### Key Entities

- **Plan verdict**: unchanged shape. `pull` may now hold attack targets, attackers and damage
  targets.
- **Named id**: loses its `pullable` flag. Every non-presence named id is pullable.

## Success Criteria *(mandatory)*

- **SC-001**: the run 1 seq 45 replay resolves Kestrel's shot at a present Snag with zero
  `UNKNOWN_COMBATANT` refusals.
- **SC-002**: an attack on an absent actor is refused in 100% of the gate tests.
- **SC-003**: an attack on a present captive mid-fight puts the captive in the turn order exactly
  once.
- **SC-004**: no prompt changes; the interpret, adjudicate and step-grammar prompt versions are
  unchanged.

## Card acceptance criteria map

| Card AC | Covered by |
|---|---|
| #1 attack or damage on a present non-combatant passes and pulls in; replays run 1 seq 45 | FR-001, FR-002, FR-005, FR-006; Story 1 scenario 1; Story 2 |
| #2 an absent actor is still refused, with a test | FR-003, FR-006; Story 1 scenario 2 |
| #3 the contract amendment and wiki notes record the reversal and cite the ruling | FR-007, FR-008 |

## Open questions (operator)

- **OQ-1 — Encounter start and disposition.** Does a pulled-in attack on a captive or a
  non-hostile start an encounter or turn the target hostile? The code has no disposition field on
  a seed NPC or a combatant. Encounter start is the Director's `tableMode` decision.
  (a) No. The pull makes the target a combatant and, in an active encounter, joins it to the
  order. In free mode no encounter starts and nothing records hostility (recommended: the
  Director owns encounter start; a disposition model is new design). (b) An attack in free mode
  on a seed-encounter member starts that encounter. That is TASK-0206 AC #2's "starts that
  encounter" branch, and it belongs to that card.
  **What 0210 delivers for TASK-0206 AC #2 under (a):** the "joins it to initiative and
  resolves" branch in turn mode, and "resolves" in free mode (Snag gains a combatant and the
  attack lands). It does not deliver "starts that encounter", and it does not make a revealed
  NPC present (that is 0206 AC #1). TASK-0206's spec checks this first. It keeps the
  encounter-start branch, or it narrows to AC #1 and #3 if the operator accepts the free-mode
  resolve as enough.
- **OQ-2 — Attacker side.** May a present non-combatant attack (`attackerId` pulled)? (a) Yes,
  the same pull (recommended: the ruling reads "attack anyone regardless of combatant state", and
  a one-sided rule keeps a `pullable` flag alive for one field). (b) Keep `attackerId` refused.
- **OQ-3 — Seq 45 presence.** Run 1 seq 45 failed with Snag absent in the log (the TASK-0206
  gap). Under this spec that state still fails, now as `absent`. (a) The replay makes Snag present
  first and asserts the absent state as AC #2's control (recommended: the merge condition reads
  "once Snag is present"). (b) Wait for TASK-0206 to set presence from the reveal. That reorders
  the merge spine.

## Assumptions

- No prompt change. `prompts/interpret.ts` and `prompts/step-grammar.ts` name ids only; neither
  states the refusal (checked 2026-11-02 against `6a1b3e80`). Interpret stays at
  `dm.interpret-v5`, so this card does not collide with TASK-0113's interpret edit.
- A pulled NPC's turn plays as a DM-controlled monster turn (spec 068).
- Frozen contracts are untouched. No migration. No new dependency.
