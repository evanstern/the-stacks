# Feature Specification: Acting on anyone outside the turn order pulls them in

**Feature Branch**: `task-0194-noncombatant-targets`

**Created**: 2026-11-02

**Status**: Draft. Open questions OQ-1 to OQ-5 resolved 2026-11-02 at the defaults (a); see Open questions.

**Input**: TASK-0194 (widened 2026-11-02). Card outcome: "during an encounter a PC can act on a
non-combatant NPC (free a captive, hand them something, drag them clear); the plan gate does not
refuse the whole action because the target is not in the initiative order." Operator, verbatim:
"acting on anyone or anything not \"in combat turn order\" should be fine -- they or it just gets
pulled into turn order and rolls their own initiative (if applicable)". Evidence: alpha run 3,
`docs/playtests/2026-11-01-two-browser-alpha-run-3.md` items 11, 13 and 19, session `e8e8326d`.

`speckit-clarify` was skipped. The card, the operator ruling and the code settle what must happen.
The open questions below are operator judgment calls with a safe default, not card ambiguities.

## Background: what happens today

1. The plan gate (`checkPlan`, TASK-0112) runs first in resolve. It checks every id a step names
   against the S0 snapshot's combatant ids plus the combatants this turn's encounter start adds.
2. Pell (`greyhollow-ford-duo`) is a seed NPC with no combatant (`identity.combatant: null`,
   `srdMonsterId: null`). At encounter start the seed marks him `arrived`, so he is a present
   actor in the snapshot, but he has no engine combatant.
3. Any step id naming Pell, other than a `presence` effect, fails with `UNKNOWN_COMBATANT`,
   reason `not-a-combatant`. The whole action group resolves `refused` before any step runs.
4. Even with the gate relaxed, the engine refuses a `check.roll`, `condition.*` or
   `healing.apply` that names an id with no combatant. So relaxing the gate alone fixes nothing:
   the target must become a combatant. That is AC #4, and AC #1 depends on it.
5. The engine already has `combatant.add` and `initiative.join` (`initiative.join` rolls the
   joiner's own initiative and slots it into the order). The proposal gate already joins an
   `arrived` combatant to the order. No engine change is needed.

## Terms

- **Named id**: an id in a step's `combatantId`, `attackerId`, `targetId`, or an effect's
  `targetId`, as `checkPlan` walks them today.
- **Non-combatant NPC**: an S0 actor of kind `npc` whose `combatantId` is null.
- **Pull**: the code-owned move that makes a named actor part of the encounter before its action
  group's steps run. A pull adds an engine combatant when the actor has none. A pull joins the
  initiative order when an encounter is active and the actor can act.
- **Can act**: the actor's engine combatant is conscious and has no incapacitating condition (the
  session model's `canAct`), and its logged presence is `present`.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Free the captive mid-fight (Priority: P1)

During an encounter, on Tamsin's turn, her player writes "I run to Pell and attempt to free him."
The DM plans a check by Tamsin whose success removes Pell's bonds. The action resolves. Pell joins
the encounter and rolls his own initiative. The ledger and the narration agree.

**Why this priority**: it is the run 3 blocker (item 13). The player lost the turn for a
reasonable move, and the fiction contradicted the ledger.

**Independent Test**: replay run 3 seq 118 on the duo seed with a scripted DM. Assert the action
does not resolve `refused` with `UNKNOWN_COMBATANT`, and Pell is in the order.

**Acceptance Scenarios**:

1. **Given** an active reed-camp encounter with Pell present and not a combatant, **When** Tamsin's
   free-Pell action resolves with a check step whose effect names `pell`, **Then** the action
   resolves `applied`, the log holds a `combatant.added` for `pell` and an `initiative.join` roll
   for `pell`, and no `UNKNOWN_COMBATANT` refusal.
2. **Given** the same state, **When** a plan names `pell` as the target of an `attack` step,
   **Then** the action resolves `refused` with `UNKNOWN_COMBATANT`, reason `not-a-combatant`, and
   Pell is not added.

---

### User Story 2 - Anyone acted on joins the order (Priority: P2)

Any non-attack step that names a present actor outside the order pulls that actor in: it gains a
combatant if it has none, and it rolls its own initiative when it can act.

**Why this priority**: the operator widened the card to this rule. Story 1 is one case of it.

**Independent Test**: unit tests on `checkPlan` and a resolve DB test for a combatant outside the
order and for free mode.

**Acceptance Scenarios**:

1. **Given** free mode (no encounter), **When** a check effect names a non-combatant NPC, **Then**
   the NPC gains a combatant and no initiative is rolled.
2. **Given** an active encounter and a named actor who has a combatant but is not in the order,
   **When** the group resolves, **Then** the actor rolls `initiative.join` before the steps run.
3. **Given** a pulled actor who cannot act (unconscious, dead, incapacitated, or not `present`),
   **When** the group resolves, **Then** no initiative is rolled for it.

### Edge Cases

- An alias names the NPC (`the boy`): the gate never maps an alias. It still refuses
  `not-a-combatant`.
- The NPC is `absent`: the gate still refuses `absent`, as today.
- A `damage` effect names a non-combatant NPC, inside any list: refused, as an attack is.
- The encounter starts this same turn: the opening moves roll the party and monsters first. The
  pull then joins the NPC to the new order.
- A reclaim replays the turn: the pull rows are keyed submissions and land once.
- The engine refuses a later step (for example `CONDITION_NOT_PRESENT` on a `condition remove`):
  normal chain rules apply. The pull stays; it is not an action step.
- Two groups in one beat name the same NPC: the first adds and joins it; the second finds it in the
  order and does nothing.
- An object target (a door, a post): no object id exists in the snapshot. Out of scope (OQ-2).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001** (card AC #1): The plan gate MUST accept a non-combatant NPC as a named id in a
  `check` step's `combatantId`, and as the `targetId` of a `condition` or `heal` effect in any
  list. A `presence` effect keeps today's rule.
- **FR-002** (card AC #2): The plan gate MUST still refuse a non-combatant NPC named as an
  `attack` step's `attackerId` or `targetId`, or as a `damage` effect's `targetId`. The code stays
  `UNKNOWN_COMBATANT`, reason `not-a-combatant`.
- **FR-003**: The plan gate MUST accept a non-combatant NPC only by its exact actor id. An alias
  still fails `not-a-combatant`.
- **FR-004**: The absent rule MUST hold unchanged. An absent non-combatant NPC fails `absent`.
- **FR-005** (card AC #4): A passing verdict MUST list the group's pull ids: each named S0 actor
  outside the S0 encounter order, in step order, without repeats. Presence-effect targets are not
  pull ids.
- **FR-006** (card AC #4): Before a group's steps run, resolve MUST add an engine combatant for
  each pull id with no combatant. The stat block comes from the NPC's `srdMonsterId`, else SRD
  `commoner` (OQ-1). The combatant id is the NPC id.
- **FR-007** (card AC #4): After the add, resolve MUST roll `initiative.join` for each pull id
  when an encounter is active, the actor is not in the order, and the actor can act.
- **FR-008**: A pull MUST NOT change the group's outcome. The action outcome comes from its steps,
  as today.
- **FR-009**: The snapshot MUST treat a seed NPC and an engine combatant with the NPC's id as one
  actor, as it does for `identity.combatant` today. This prevents an id collision after a pull.
- **FR-010** (card AC #3, merge condition): A test MUST replay run 3 seq 118 and resolve the
  free-Pell action. The same test file MUST show an attack on a non-combatant is still refused.
- **FR-011**: The NPC group (the monster turn) MUST follow the same gate and pull rules.

### Constitution-Driven Requirements *(mandatory)*

- **CR-001** (I. Agent-operable): the pull runs inside the DM turn job; no human-only path.
- **CR-004** (VI. 5e engine boundary): the pull reaches mechanics only through `combatant.add`
  and `initiative.join`. The engine rolls initiative. No model writes a number.
- **CR-006** (IV. Event sourcing): every pull row goes through `gate.submit` as a keyed
  submission. Nothing writes the log directly.
- **CR-005** (VIII. Operator-owned content): the default stat block is SRD `commoner` (CC-BY).

### Key Entities

- **Plan verdict**: gains `pull: string[]` on a passing verdict. Stored in `checkpoint.planGate`.
  The field is additive; older rows lack it.
- **Pulled combatant**: an engine combatant whose id is a seed NPC id.

## Success Criteria *(mandatory)*

- **SC-001**: the run 3 seq 118 replay resolves the free-Pell action with zero `UNKNOWN_COMBATANT`
  refusals.
- **SC-002**: an attack or damage step on a non-combatant NPC is refused in 100% of the gate tests.
- **SC-003**: after the replay, Pell appears in the turn order exactly once.
- **SC-004**: a reclaim of the replay turn writes no second pull row.

## Card acceptance criteria map

| Card AC | Covered by |
|---|---|
| #1 non-attack steps may name a present non-combatant | FR-001, FR-003, FR-004; Story 1 scenario 1 |
| #2 attack or damage on a non-combatant still refused | FR-002; Story 1 scenario 2 |
| #3 replay run 3 seq 118, resolve the free-Pell action | FR-010; SC-001 |
| #4 a targeted actor outside the order joins with its own initiative, when it can act | FR-005 to FR-009, FR-011; Story 2 |

## Open questions (operator)

**Resolved 2026-11-02.** Operator ruling on OQ-1 to OQ-5: "Accept all defaults (Recommended)". Every OQ below stands at (a). OQ-2 is carded as TASK-0201. OQ-3 is carded as TASK-0202. OQ-5 (plan.md): the replay is rebuilt from the run 3 log, with no vm-104 access.

- **OQ-1 — Stat block for an NPC with no `srdMonsterId`.** (a) SRD `commoner` (recommended: a
  captive or bystander is a commoner by default). (b) A new seed field. That edits
  `dm/seed/schema.ts` and every seed, which TASK-0164 also edits.
- **OQ-2 — Objects.** The operator ruling says objects join without initiative. The snapshot has no
  object ids, so a step cannot name one today. (a) Out of scope here; the orchestrator cards it
  (recommended). (b) Add object actors in this card.
- **OQ-3 — Starting conditions.** Pell is bound in the fiction, but the engine has no `restrained`
  condition on him. A `condition remove restrained` on Pell is refused `CONDITION_NOT_PRESENT`
  after the check lands. (a) Accept it here: the action resolves `applied` on the check, and the
  orchestrator cards seed-declared starting conditions (recommended). (b) Add seed conditions in
  this card (seed schema, TASK-0164 overlap).
- **OQ-4 — Attacks.** The widened ruling reads "acting on anyone". AC #2 still refuses an attack
  or damage on a non-combatant. (a) Keep AC #2 as written (recommended: the card is the authority).
  (b) Pull attack targets too and drop AC #2.

## Assumptions

- A pull is code-owned. No prompt changes. The interpret model already names Pell (run 3).
- A pulled NPC's turn plays as a DM-controlled monster turn, as any non-party combatant's turn.
- `canAct` uses the session model's rule. `yielded` and `absent` actors do not roll.
- Frozen contracts are untouched. No migration. No new dependency.
