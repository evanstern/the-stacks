# Feature Specification: Seed NPCs carry minimal scene presence

**Feature Branch**: `task-0142-seed-npc-presence`
**Spec dir**: `specs/050-seed-npc-presence`
**Created**: 2026-10-27
**Status**: Ready for planning — operator ruled OQ-1 to OQ-6, all (a), on 2026-10-27 (see
"Operator rulings").
**Board card**: TASK-0142 (Track C7, runbook amendment 1)
**Input**: TASK-0142, decision-0025 (D17) card U8, `docs/design/actor-state-gate.md` §5.3 (U8),
specs/040-actor-snapshot (U1, merged), specs/048-scene-presence (U2, merged).

## Governing decision

This card implements decision-0025 (D17, "Actor-state rule gate", TASK-0135) card **U8, seed
NPCs carry minimal scene presence**, under the C3 ruling "Seed NPCs: M3, minimal". It implements
these rules:

- **Terms, "Actor".** In M3 a seed NPC is an actor with scene presence only. Richer NPC records
  belong to the Codex (M4).
- **Terms, "Scene presence"; §1.2.** Every snapshot actor carries scene presence. For a seed NPC
  the value starts from the seed, not from a blanket `present`.
- **Terms, "Plot"; rule §2.1.** A seed NPC's presence change is plot. It moves only through a
  recorded fact: U2's `scene-presence.changed` row. Prose never moves it.
- **§2.7.** An NPC that begs or bolts in narration is not `yielded` or `absent` until a row says
  so.

It implements none of these, each owned by a card:

- The roll requirement for a presence change to another actor (§2.2): TASK-0147 (U9).
- Prose claims checked against NPC aliases and presence (§3.4): TASK-0143 (U3), TASK-0144 (U4).
- Director encounter end over beaten opposition (§2.5): TASK-0145 (U5).
- `dm.audit` reading S1 (§3.5): TASK-0146 (U7).

## Dependencies (both merged)

- **TASK-0140 (spec 040).** `buildSnapshot` lists every seed NPC as an actor of kind `npc`. A
  seed NPC whose `identity.combatant` names a live engine combatant is one actor with that
  combatant (contract rule 3). Aliases come from `nameTerms` plus the engine name.
- **TASK-0141 (spec 048).** `scene-presence.changed` v1 (`actorId`, `before`, `after`, `reason`,
  `actionId`); the `scenePresence` projection keyed by actor id, defaulting to `present`; the
  `scene-presence` DM proposal (policy `ask`, `auto` for the AI seat); the planner fills
  `before` from the projection and plans `initiative.leave` or `initiative.join`; the resolve
  `presence` effect; the plan gate's `absent` reason. A resolve test asserts no Director fixture
  produces a `scene-presence` submission (048 FR-021, card AC #5).

## Operator rulings (2026-10-27, recorded on the card, commit 43e6d6a)

The operator's words:

> "TASK-0142: I accept the recommended defaults OQ-1 to OQ-6 (a), including the frozen 029 and
> 031 amendments and the Greyhollow aliases "the keeper", "the boy", "the goblin leader". The
> Director-triggered encounter-start seed rows are fine under decision-0025 §2.5 and 048 AC #5."

| Question | Ruling | What it binds |
|---|---|---|
| OQ-1 seed shape | (a) | A required `beats[].presence` map per beat covering every seed NPC; `npcIds` kept and cross-checked; seed `v` stays 1; `specs/031-dm-runtime/contracts/scene-seed.md` amended |
| OQ-2 when rows are logged | (a) | Seed rows at scene start (opening beat) and at encounter start (`arrived`, before the initiative roll); other beats are guidance only |
| OQ-3 reasons | (a) | `removed` for `absent`, `conceded` for `yielded`, `arrived` for `present`; no event change |
| OQ-4 visibility | (a) | The `scene-presence` proposal gains optional `visibility` (`public` default, or `dm`); scene-start seed rows are `dm`; `specs/029-proposal-gate/contracts/proposals.md` and `gate-api.md` §1 amended |
| OQ-5 one identity | (a) | Seed cross-check: `identity.combatant`, when set, equals the NPC `id` and names an encounter monster |
| OQ-6 aliases | (a) | Optional `identity.aliases` (at most 6); Greyhollow: Wenna "the keeper", Pell "the boy", Snag "the goblin leader" |
| Director-triggered seed rows | accepted | Encounter-start seed rows are fine under decision-0025 §2.5 and 048 AC #5 |

The options under "Open questions" stay below as the record.

## Root cause (from the evidence)

| Evidence | What happened |
|---|---|
| `nodes/assemble.ts` `presentNpcIds` | Every NPC of every beat counts as present at every turn. Snag and Pell are "present" at the ferry-house. |
| `snapshot/build.ts` `presenceOf` | A seed NPC with no logged row reads `present`. The seed says nothing about where an NPC starts. |
| M2 demo seq 296–301 (`docs/design/m2-demo/demo-session/transcript.jsonl`, session `e8c848ec`) | Seq 296 resolves Kestrel's dare `no-effect` with no roll. Seq 299 narrates Snag and two goblins fleeing. Seq 300 ends the encounter on that prose; seq 301 sets free mode. No row records a flight. |
| `gate/plan.ts` `scene-presence` | For an actor that is not a party member, the planner uses the actor id as the combatant id. A seed NPC whose id differs from its combatant id would leave or join the wrong combatant. Greyhollow Ford's `snag` works only because both ids are `snag`. |

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A seed declares where each NPC starts in each beat (Priority: P1)

A seed author states, for every beat, each NPC's scene presence when that beat opens. The seed
loader refuses a seed that leaves an NPC undeclared or names an unknown NPC.

**Why this priority**: Card AC #1. Every other story reads this declaration.

**Independent Test**: Parse the Greyhollow Ford seed and malformed variants; assert the accepted
and refused cases and their issue text.

**Acceptance Scenarios**:

1. **Given** the shipped Greyhollow Ford seed, **When** it loads, **Then** every beat declares a
   presence for each of `wenna`, `pell` and `snag`, and the load succeeds.
2. **Given** a beat that omits one seed NPC, **When** the seed loads, **Then** it is refused with
   an issue naming the beat and the NPC.
3. **Given** a beat that declares an unknown NPC id, **When** the seed loads, **Then** it is
   refused with an issue naming the beat and the id.
4. **Given** a beat whose `npcIds` names an NPC it declares `absent`, **When** the seed loads,
   **Then** it is refused (the two lists disagree).

---

### User Story 2 - Seed NPCs are snapshot actors with their declared presence (Priority: P1)

Every seed NPC appears in the snapshot with id, name, aliases, kind `npc` and a scene presence
that reflects the seed's declaration as logged at scene start.

**Why this priority**: Card AC #2. U3, U5 and U7 read these actors.

**Independent Test**: Run a scene start on Greyhollow Ford with the fake gateway; build S1;
assert each NPC actor's fields and presence.

**Acceptance Scenarios**:

1. **Given** a scene start on Greyhollow Ford, **When** S1 is built, **Then** `wenna` is
   `present`, and `pell` and `snag` are `absent` (the opening beat's declaration, OQ-2 default).
2. **Given** any seed NPC actor, **When** the snapshot is built, **Then** it carries `id`,
   `name`, `aliases`, `kind: "npc"`, `controller: { kind: "dm" }` and `presence`.
3. **Given** the fiction view, **When** an absent seed NPC is rendered, **Then** it shows as
   absent (compressed under the cap, as for any absent actor) and is never dropped.
4. **Given** the prompts' NPC portrayal lines, **When** a turn assembles, **Then** they list only
   seed NPCs whose presence is not `absent` (replacing "every NPC of every beat").

---

### User Story 3 - A seed NPC's presence changes only through the logged event (Priority: P1)

No prose, Director field or encounter end changes a seed NPC's presence. Only a
`scene-presence.changed` row does.

**Why this priority**: Card AC #3. This is the M2 seq 296–301 failure.

**Independent Test**: Fold the recorded M2 demo log through seq 301; build a snapshot with the
Greyhollow Ford seed at each seq from 295 to 301; assert Snag's presence.

**Acceptance Scenarios**:

1. **Given** the recorded M2 demo log, **When** a snapshot is built at each seq 295 to 301,
   **Then** Snag is one actor (`id: "snag"`, `combatantId: "snag"`) with presence `present` at
   every seq, and the log holds no `scene-presence.changed` row.
2. **Given** the same fold, **When** S(298) is diffed with S(301), **Then** the diff holds no
   `presence` change for any actor, although seq 299 narrates a flight and seq 300 ends the
   encounter.
3. **Given** that log with one appended `scene-presence.changed` row for `snag` (`fled`),
   **When** the snapshot is rebuilt, **Then** Snag reads `absent`, and the diff holds exactly
   one `presence` change.
4. **Given** the seed's declarations for later beats, **When** no row is logged, **Then** a
   beat's declaration never changes the snapshot by itself (OQ-2).

---

### User Story 4 - An NPC that becomes a combatant keeps one identity (Priority: P2)

Snag is a seed NPC before the fight and a combatant during it. Every reader sees one actor with
one id, and a presence row for that actor moves the right combatant in the order.

**Why this priority**: Card AC #4. Without it a presence change can miss the combatant.

**Independent Test**: Build snapshots before and after `combatant.add` for `snag`; submit a
presence change for `snag` in turn mode; assert the order and the actor ids.

**Acceptance Scenarios**:

1. **Given** Snag before the encounter, **When** the snapshot is built, **Then** one actor `snag`
   of kind `npc` has `combatantId: null`.
2. **Given** Snag after `combatant.add`, **When** the snapshot is built, **Then** the same actor
   id `snag` now has `combatantId: "snag"`, its presence row carries over, and no `monster` actor
   `snag` exists.
3. **Given** a seed whose NPC `identity.combatant` differs from its `id`, **When** the seed
   loads, **Then** it is refused (OQ-5 default).
4. **Given** Snag `absent` before the fight and the reed-camp encounter starting, **When**
   resolve runs, **Then** Snag reads `present` in S1 and is in the initiative order (OQ-2
   default).

### Edge Cases

- **Legacy logs** (the M2 demo, every pre-U8 session) have no seed rows. Every NPC reads
  `present`, as before. Tests on recorded logs assert this.
- **A seed with no NPCs.** No beat declares anything; no rows are written.
- **Reclaim.** A reclaimed scene start or encounter start must not write a seed row twice. The
  submission checkpoint (`stepRef`) covers it; the planner's same-value refusal is the backstop.
- **An NPC already `absent` by a logged row when its encounter starts.** The encounter-start
  arrival writes `arrived` only for an NPC the encounter beat declares `present` (OQ-2 default).
- **A `yielded` declaration.** A beat may open with an NPC `yielded` (a captive who will not
  fight). The opening row uses the closed reason list (OQ-3).
- **Pell.** Pell is a seed NPC with no combatant. He is `absent` until the reed camp, then
  `present`. He never enters the order.

## Requirements *(mandatory)*

### Functional Requirements

FRs marked "(OQ-n)" follow that question's recommended default and change if the operator rules
otherwise.

**Seed declaration (AC #1) (OQ-1)**

- **FR-001**: Each seed beat MUST declare a scene presence (`present`, `yielded` or `absent`)
  for every seed NPC, keyed by NPC id.
- **FR-002**: The seed cross-check MUST refuse a beat that omits a seed NPC, names an unknown
  NPC, or lists in `npcIds` an NPC it declares `absent`. Each issue names the beat and the NPC.
- **FR-003**: `beats[0]` MUST be the opening beat: its declaration is each NPC's presence at
  scene start (OQ-2).
- **FR-004**: The shipped seed (`apps/server/seeds/greyhollow-ford.json`), its spec copy
  (`specs/031-dm-runtime/data/greyhollow-ford.seed.json`) and every test seed fixture MUST carry
  the declaration. `specs/031-dm-runtime/contracts/scene-seed.md` MUST record the field with an
  "Amended 2026-10-27 (TASK-0142)" note.
- **FR-005**: A schema test MUST cover the shipped seed and each refusal in FR-002.

**Logging the declaration (AC #2, AC #4) (OQ-2, OQ-3, OQ-4)**

- **FR-006**: At scene start, resolve MUST submit one `scene-presence` proposal (`actionId:
  null`) for each seed NPC whose opening-beat presence is not `present`.
- **FR-007**: When resolve starts a seed encounter, it MUST submit, before the initiative roll,
  one `scene-presence` proposal with reason `arrived` for each NPC the encounter's beat declares
  `present` whose logged presence is not `present`.
- **FR-008**: These seed submissions MUST read only the seed and the projections. They MUST run
  in a code-owned seed-presence group, not the Director group, with stepRefs under `seed:presence:`.
  The 048 test "no Director fixture produces a scene-presence submission" MUST keep asserting
  that no `director:`-keyed submission has kind `scene-presence`; its total-row count is amended
  to count only non-seed rows. A new test MUST show the seed rows are identical for any two
  Director outputs that start the same encounter.
- **FR-009**: Seed rows MUST use reasons from the existing closed list (OQ-3): `removed` for
  `absent`, `conceded` for `yielded`, `arrived` for `present`.
- **FR-010**: Scene-start seed rows MUST NOT reveal a not-yet-met NPC to players (OQ-4): they
  are written with visibility `dm`, and narration facts MUST exclude them.

**Snapshot (AC #2)**

- **FR-011**: `buildSnapshot` MUST keep reading a seed NPC's presence from the `scenePresence`
  projection by NPC id. It MUST NOT read the seed's beat declarations.
- **FR-012**: Assemble's present-NPC list (`presentNpcIds`) MUST become the seed NPCs whose S0
  presence is not `absent`, in seed order. Narrate's beat NPC list (`beatNpcIds`) MUST drop NPCs
  whose S1 presence is `absent`.
- **FR-013**: Seed NPC aliases MUST include seed-declared aliases when present (OQ-6).

**Only the event changes presence (AC #3)**

- **FR-014**: A test MUST fold `docs/design/m2-demo/demo-session/transcript.jsonl` through seq
  301 and assert User Story 3 scenarios 1 and 2. The test reads the recorded file; it does not
  copy rows into a fixture.
- **FR-015**: A test MUST assert scenario 3: one appended row changes Snag, and only that row.

**One identity (AC #4) (OQ-5)**

- **FR-016**: The seed cross-check MUST refuse an NPC whose `identity.combatant` is set and
  differs from its `id`, or names no encounter monster's `combatantId`.
- **FR-017**: A test MUST assert User Story 4 scenarios 1, 2 and 4.

**Docs**

- **FR-018**: `specs/040-actor-snapshot/contracts/actor-snapshot.md` rule 7 and the U8
  extension row MUST record the seed rows and the identity rule.

### Constitution-Driven Requirements *(mandatory)*

- **CR-001** (II. Content is a contract): The seed declaration is part of the seed contract.
  A seed that fails it never loads. Every contract edit carries an "Amended 2026-10-27
  (TASK-0142)" note.
- **CR-002** (IV. Event-sourced play, server authority): A seed NPC's presence MUST be derived
  only by folding logged rows. The seed declaration is input to the server's own proposals,
  never a second source of state. A refused seed proposal leaves the log unchanged.
- **CR-003** (VI. 5e engine boundary): An NPC combatant joins or leaves the order only through
  the engine (`initiative.join`, `initiative.leave`) via the existing planner.
- **CR-004** (VII. Structured before styled): Presence values and reasons are closed lists. No
  prose sets presence.
- **CR-005** (VIII. Operator-owned content): The seed edits are original content; no book text.

### Key Entities

- **Beat presence declaration**: per beat, per seed NPC id, `present`, `yielded` or `absent` at
  the beat's opening.
- **Seed presence row**: a `scene-presence.changed` row written by the seed-presence group at
  scene start or encounter start, with `actionId: null`.
- **NPC actor**: a snapshot actor of kind `npc` keyed by NPC id, joined to its combatant when
  one exists, whose combatant id equals its NPC id.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 0 shipped or test seeds load with a beat that leaves an NPC undeclared.
- **SC-002**: Over the recorded M2 demo log, Snag's presence reads `present` at 7 of 7 seqs from
  295 to 301, with 0 presence diff entries between 298 and 301.
- **SC-003**: After a Greyhollow Ford scene start, 2 of 3 seed NPCs (`pell`, `snag`) read
  `absent`, and 0 opening-narration facts name them.
- **SC-004**: After the reed-camp encounter starts, Snag and Pell read `present`, and Snag is in
  the initiative order exactly once.
- **SC-005**: 0 snapshots list a seed NPC and its combatant as two actors.
- **SC-006**: The existing DM, session-model, engine and playtest suites pass. The shipped
  scenario's ci case still ends `ended` with a passing report.

## Card acceptance criteria mapping

| Card AC | Text (short) | Met by | Test owner |
|---|---|---|---|
| #1 | A seed declares each NPC's initial presence per beat, with a schema test | FR-001 to FR-005; User Story 1; OQ-1 | TASK-0142 |
| #2 | Seed NPCs appear in the snapshot with id, name, aliases, kind `NPC`, presence | FR-006 to FR-013; User Story 2; OQ-2, OQ-3, OQ-4, OQ-6 | TASK-0142 |
| #3 | Presence changes only through U2's event, test over M2 seq 296–301 | FR-011, FR-014, FR-015; User Story 3 | TASK-0142 |
| #4 | An NPC that becomes a combatant keeps one identity | FR-007, FR-016, FR-017; User Story 4; OQ-5 | TASK-0142 |

## Assumptions

- **Kind `NPC`.** The card's "kind `NPC`" is the snapshot's existing `kind: "npc"`. No rename;
  the enum is a frozen-in-practice value read by every view.
- **The recorded log folds today.** Verified 2026-10-27 (plan research R1): all 333 rows of
  `docs/design/m2-demo/demo-session/transcript.jsonl` pass `StoredEventSchema` and decode as
  `known` under the current catalog, with 0 fold diagnostics. The test never edits the record.
- **The Director's `pacing.beatId` is not state.** It is per-turn model output and is never
  logged. This card does not log it (OQ-2 option (c) is rejected for that reason).
- **No `speckit-clarify` run.** The open questions below change a seed schema, a frozen
  contract or what a player sees, so they go to the operator as rulings, not to clarify.

## Out of scope (each owned by a card)

- The roll a presence change to another actor needs: TASK-0147 (U9).
- Prose claims against NPC aliases and presence: TASK-0143 (U3), TASK-0144 (U4).
- Ending an encounter on beaten opposition: TASK-0145 (U5).
- Disposition beyond `yielded`, and richer NPC records: the Codex (M4).
- A yielded actor resuming opposition: 048 OQ-5 (no reason exists).

## Open questions

Each question changes a seed or event schema, a frozen contract, or what a player sees. Each
gives options, a recommended default and why. The operator ruled every one (a) on 2026-10-27
(see "Operator rulings"); the FRs above follow the rulings.

### OQ-1 — The shape of the per-beat declaration (seed schema; AC #1)

- **(a) Recommended.** Add a required `presence` map to each beat: `{ [npcId]: "present" |
  "yielded" | "absent" }`, covering every seed NPC. Keep `npcIds` (narrate facts and assemble
  read it); the cross-check makes the two agree (FR-002). Seed `v` stays 1; every shipped and
  test seed is updated in this PR.
  *Why:* the card says "declares each NPC", so an explicit entry per NPC per beat is the
  literal reading. It is small (at most 20 NPCs by 12 beats) and fails loudly when an author
  forgets one. Keeping `npcIds` avoids churn in narrate and facts.
- **(b)** An optional map; an NPC missing from it defaults to `present` when in `npcIds`, else
  `absent`. Backward compatible, but the declaration is implicit and a typo passes silently.
- **(c)** Replace `npcIds` with `npcs: [{ id, presence }]` and bump seed `v` to 2. Cleanest
  shape, but it breaks every reader of `npcIds` and every seed at once.

### OQ-2 — When the declaration becomes a logged row (behaviour a player sees; AC #2, #3, #4)

The snapshot and the planner read presence from the log only (048). The planner fills `before`
from the projection, so a seed default the log does not hold would make the snapshot and the
gate disagree (an `arrived` on a seed-absent NPC would be refused as no change).

- **(a) Recommended.** Code writes seed rows at two recorded moments. At scene start: the
  opening beat's non-`present` NPCs (FR-006). At encounter start: `arrived` for NPCs the
  encounter's beat declares `present` (FR-007), before the initiative roll, so the NPC is not
  `absent` when the order and the plan gate read it. Any other beat's declaration is guidance
  only: a later arrival is a resolved presence effect from interpret or adjudicate (U2).
  *Why:* both moments are recorded facts (scene start; encounter start, which decision-0025
  §2.5 passes because initiative is a roll). Without the encounter-start row, an opening-absent
  Snag would be refused by the plan gate for the whole fight.
- **(b)** Scene start only. Every later arrival goes through a model-proposed presence effect.
  Fewer code paths, but the fight breaks if the model forgets to bring Snag in.
- **(c)** Log the Director's `pacing.beatId` as a new catalogued beat event and apply each
  beat's declaration on entry. Makes every beat binding, but it is a new event (frozen 028
  amendment) and lets a Director field drive presence, against 048 AC #5 and §2.5.
- **(d)** No rows: the snapshot defaults a seed NPC to its current beat's declaration.
  Rejected: there is no logged current beat, the planner's `before` would disagree with the
  snapshot, and AC #3 says presence changes only through the event.

### OQ-3 — Reasons on seed rows (event schema; AC #2)

- **(a) Recommended.** Reuse the closed list: `removed` for an opening `absent`, `conceded` for
  an opening `yielded`, `arrived` at encounter start (FR-009).
  *Why:* no event or frozen contract change, and 048 FR-002's rule "the reason fixes the value"
  still holds.
- **(b)** Add a reason `seeded` that takes its value from the seed. Reads honestly, but `seeded`
  does not fix a value, which breaks FR-002 of spec 048, and it amends the frozen 028 and 029
  contracts.

### OQ-4 — Visibility of scene-start seed rows (frozen 029 contract; behaviour a player sees)

The planner writes every `scene-presence.changed` row `public`. A public scene-start row "snag:
absent" tells every client, before the party meets him, that a Snag exists. As a landed presence
change it also becomes a narration fact, so the opening narration may mention him.

- **(a) Recommended.** The `scene-presence` proposal gains an optional `visibility` (`public`
  default, or `dm`). Scene-start seed rows use `dm`. Encounter-start arrivals stay `public`.
  Narration facts skip `dm` presence rows (FR-010). Amends
  `specs/029-proposal-gate/contracts/proposals.md` and `gate-api.md` §1 with an "Amended
  2026-10-27 (TASK-0142, operator ruling)" note; the event already allows `any` visibility.
  *Why:* it is the hidden-information rule F54 enforced; the DM projection still folds the row.
- **(b)** Keep rows `public`; filter only the narration facts. No frozen change, but the
  WebSocket frames and the public transcript export still name `snag` and `pell` at seq 1.
- **(c)** Write no scene-start rows (OQ-2 (b)-style). Avoids the leak and loses AC #2's
  "presence from the seed" at scene start.

### OQ-5 — One identity when an NPC's id differs from its combatant id (seed schema; AC #4)

The planner maps a non-party actor id straight to a combatant id. Spec 048 has no seed context
in the session model.

- **(a) Recommended.** The seed cross-check requires `identity.combatant`, when set, to equal
  the NPC `id` and to name an encounter monster (FR-016). Greyhollow Ford already conforms.
  *Why:* one id across seed, snapshot, log and engine; no frozen contract change.
- **(b)** Add `combatantId` to the `scene-presence` proposal so resolve passes the mapping.
  Allows different ids, but amends the frozen 029 proposal shape.
- **(c)** Give the session-model planner seed context. Crosses the session-model/DM boundary.

### OQ-6 — Seed-declared aliases (seed schema; AC #2)

The 040 contract's U8 row lists "seed-declared aliases". The card's AC #2 is met by today's
derived aliases ("Wenna Marsh", "Wenna", `wenna`). U3 (TASK-0143) will match prose such as
"the keeper" or "the goblin leader", which no derived alias covers.

- **(a) Recommended.** Add optional `identity.aliases` (at most 6, each at most 60 characters)
  to a seed NPC; the snapshot appends them after the derived terms, deduped. Greyhollow Ford
  gains author-chosen aliases (proposed: Wenna "the keeper"; Pell "the boy"; Snag "the goblin
  leader"), for the operator to confirm.
  *Why:* the contract assigns it here, U3 is the next consumer, and the field is small.
- **(b)** Defer to TASK-0143 (U3), which owns alias matching; the orchestrator notes it on that
  card.
