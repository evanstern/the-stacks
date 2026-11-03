# Implementation Plan: Engine opportunity attack

**Branch**: `task-0208-engine-opportunity-attack` | **Date**: 2026-11-02 | **Spec**: [spec.md](spec.md)

**Input**: `specs/079-engine-opportunity-attack/spec.md`, TASK-0208, runbook B
(`docs/design/m3-runbook-b-resolution-quality.md`, lane B1, spine #7, Lane notes on TASK-0208).

## Summary

The engine owns reactions: the encounter records spent reactions, `attack.roll` takes a
`reaction` flag that checks and spends one, and the turn start resets it. Interpret plans a PC's
pull-away as a new `move` step that names the hostiles left behind. Resolve turns each named
hostile into an engine opportunity attack, with numbers from the hostile's SRD record. The plan
gate refuses a foreign actor's step inside a party action. The fallback names the roller as the
subject of a roll's outcome. Narration facts carry a party member's open followUps into later
beats.

## Technical Context

**Language/Version**: TypeScript (Node 22), as the repo.
**Primary Dependencies**: Zod, Vitest. **No new runtime dependency** (checkpoint C5 not reached).
**Storage**: no migration. No new event type. Optional fields on two engine shapes (contract
below).
**Testing**: Vitest. Engine command tests with scripted dice; pure unit tests (plan gate, fallback,
audit, facts, narrate and interpret prompts, follow-ups); one DB integration test on the worktree
stack (`REQUIRE_DATABASE=1`). Fake gateway only; no paid run.
**Target Platform**: `packages/dnd5e-engine` and the server DM pipeline.
**Constraints**: frozen contracts untouched (`docs/wiki/ws-protocol.md` frames,
`specs/029-proposal-gate/contracts/`, `specs/030-play-route/contracts/proposal-seam.md`). A
`mechanics` proposal already carries any `EngineCommand`, so the new flag rides it unchanged.
`facts.ts` keeps importing no engine value (its import-closure test).
**Scale/Scope**: 4 engine source files, 12 server source files, 1 new server module, 1 web file,
3 new test files, about 12 extended test files, 6 contract amendments.

## Constitution Check

Against `.specify/memory/constitution.md` 2.0.0. Re-checked after design: unchanged.

- [x] **I. Agent-operable**: reactions are decided by code from engine state. No human-only path;
      a human DM seat sees the reaction as an ordinary `mechanics` proposal.
- [x] **II. Content contract**: no content shape changes. Seeds are read, not changed.
- [x] **III. Data planes**: session plane only. The open-followUp helper reads stored turn
      checkpoints (the DM plane's job rows) as specs/057 already does.
- [x] **IV. Event sourcing**: the spend and the reset are `encounter.changed` rows with before and
      after values. `evolve` writes the `after` slice; replay reproduces state. No new type.
- [x] **V. Citations**: the rule cites SRD 5.2.1 records `playing-the-game.actions.reactions` and
      `playing-the-game.combat.melee-attacks.opportunity-attacks`.
- [x] **VI. 5e engine boundary**: the engine refuses a spent or illegal reaction before any die. The
      reaction's bonus and damage come from the SRD record by code. No model writes them.
- [x] **VII. Structured first**: `move` is a typed step; `reaction` is a typed flag; open
      followUps are a typed fact list.
- [x] **VIII. Operator-owned content**: no book text. SRD data is CC-BY and already shipped.
- [x] **IX. Self-hostable**: no service, purpose or dependency.

**Stack conformance**: no departure. **Complexity Tracking**: none.

## Research

- **R1 — No positions.** `EngineState` holds combatants and an `encounter` (`round`, `turnIndex`,
  `order`). Nothing records distance, adjacency or a map. A reach test in the engine would need a
  positions model; OQ-1 (a) leaves adjacency to interpret's reading of the fiction.
- **R2 — Where the spend lives.** `Encounter` is the only per-encounter state, and
  `encounter.changed` is the existing state-change event for it (before and after `Encounter`,
  `combatantId`). Its catalog entry is `state-change`, its projection is the engine's `evolve`
  (`evolve.ts` writes `event.after`), and its ledger row is generic (`projections/ledger.ts`
  `default:`). An optional `reactionsSpent` on `EncounterSchema` therefore needs no session-model
  or catalog change. `encounter.ended` sets the encounter to null, which clears the list.
- **R3 — Run 1 replays.** goblin-2 is SRD `goblin-warrior` in both `greyhollow-ford` and
  `greyhollow-ford-reed-camp`. Its Scimitar is `attack: { type: "melee", bonus: 4, reach: 5,
  hit: [{ dice: "1d6 + 2", type: "Slashing" }, { dice: "1d4", condition: "if the attack roll had
  Advantage" }] }`. Run 1 rolled 1d20+4 and dealt 4 slashing, which 1d6+2 allows. The reed-camp
  seed seats Kestrel as `human`; the test world's default seed seats her as a companion. The
  replay uses the reed-camp seed with a second human seat, as `attack-anyone.integration.test.ts`
  does with the duo seed.
- **R4 — Foreign steps in scripts.** Every shipped and test DM script was scanned for `attack`
  steps. All party-action attacks name the action's own character except one:
  `test/dm/scripts/plan-approach.json` and `dm-scripts/greyhollow-plan-approach.json` put "Kestrel
  attacks Snag on Tamsin's signal" in Tamsin's action (step 3). The first-stage cut drops it in
  free mode before the plan gate sees it (`first-stage.ts` keeps the leading checks only), so
  FR-006 does not refuse that plan. A plan-gate unit test pins this. The goblin-2 attack in
  `runbook-a-reed-camp.json` is on the monster turn (`actionId: null`) and is not checked.
- **R5 — Fallback subject.** `rollSentences(rolls, subject)` passes the action's character name for
  every roll (`factualSummary`, action loop). `FactRoll.name` already holds the roller's name
  (`collectFacts`: `nameOf(row.roll.combatantId)`). The fix is to use `r.name` when it is a real
  name, else the subject. `nameOf(null)` returns "The scene", so a null roller keeps the subject.
- **R6 — Audit opposite-outcome check.** `deterministicChecks` pairs `a.characterName` with words
  opposite `a.outcomes[0]` when the action has one outcome. After this card a reaction attack can
  be an action's only outcome; its outcome belongs to the goblin. The check reads only rolls whose
  `name` is the action's character.
- **R7 — Why the free never ran.** Run 1's plan held one step (the goblin's attack) and parked the
  free as a followUp, so nothing of Kestrel's ran. With FR-006 that plan is refused whole
  (the OQ-4 code, before any step), and the action resolves `refused`. With
  FR-007 interpret plans a `move` step plus the free's own check. The free-mode first-stage cut
  keeps steps up to the first run of like checks, so a `move` then a check stays whole.
- **R8 — The later beat (seq 166).** `buildNarrationFacts` reads `followUps` from this turn's
  readings and rulings only. A later NPC turn has no reading for Kestrel's action, so its facts
  carry nothing. Earlier turn checkpoints hold every reading
  (`jobs.ts` `loadPriorTurnCheckpoints`, newest first; `TurnCheckpoint.interpret`). The
  projections hold each action's `characterId`, `declaredSeq` and `resolved` status
  (`ActionView`).
- **R9 — Prompt versions on `main` at authoring.** `dm.interpret-v5`, `dm.adjudicate-v4`,
  `dm.narrate-v8`, `dm.audit-v4`. TASK-0113 (spec 074) bumps interpret to v6, narrate to v8+1 and
  audit to v5; TASK-0205 (spec 077) bumps interpret again. The build bumps each changed prompt one
  past `main` at build time (runbook B "Prompt versions").
- **R10 — Refusal-code coverage.** `test/coverage.test.ts` requires each engine refusal code to be
  asserted by an `expectRefusal` call, except plan-gate-only codes listed in `PLAN_GATE_ONLY`.
  `REACTION_SPENT` gets an engine test. A plan-gate code added under OQ-4 joins `PLAN_GATE_ONLY`.
- **R11 — Spec 070 overlap.** Spec 070 (TASK-0127, spine #8) edits `attacks.ts` (`bandOf`, the
  `check.roll` handler), `nodes/schemas.ts` (the `check` step), `nodes/resolve.ts` (`case "check"`,
  `Submission`), `plan-gate.ts` (`stepTexts` and the id walk for `check`), `facts.ts` (`FactRoll`
  band fields), `fallback.ts` (`outcomeSentence`) and `prompts/narrate.ts` (`rollEntry`). This plan
  names its hunks in "Overlap" so 0127 rebases cleanly.

## Design

### D1 — Engine: reaction state and the flag (`packages/dnd5e-engine`)

`src/schema/state.ts`:

```ts
export const EncounterSchema = z.object({
  round: ..., turnIndex: ..., order: ...,
  // Combatants whose Reaction is spent until the start of their next turn (SRD 5.2.1 p. 10).
  reactionsSpent: z.array(CombatantIdSchema).optional(),
}).superRefine(/* existing turnIndex check */);
```

`src/schema/commands.ts`, the `attack.roll` option gains:

```ts
reaction: z.boolean().default(false),
```

`src/schema/events.ts`, the `attack.resolved` option gains:

```ts
reaction: z.boolean().optional(),   // present and true only on a reaction attack
```

`src/schema/refusals.ts`: `RefusalCodeSchema` gains `REACTION_SPENT`.

`src/commands/attacks.ts`, `handleAttackRoll`, after the existing named and unable checks and
before the AC check:

1. When `command.reaction`:
   - no encounter → `NO_ACTIVE_ENCOUNTER`;
   - `attackerId === null` → `INVALID_COMMAND` (message "a reaction needs an attacker");
   - attacker not in `encounter.order` → `UNKNOWN_COMBATANT`, details
     `{ combatantId, reason: "not-in-order" }` (as `initiative.leave`);
   - attacker in `reactionsSpent` → `REACTION_SPENT`, details `{ combatantId }`.
2. Roll as today. Emit `attack.resolved` with `reaction: true` (omit the key when false).
3. When `command.reaction`, append `encounter.changed` with `combatantId: attackerId`,
   `before: enc`, `after: { ...enc, reactionsSpent: [...(enc.reactionsSpent ?? []), attackerId] }`.

`src/commands/encounter.ts`:

- `handleTurnAdvance`: when the incoming combatant's id is in `reactionsSpent`, emit
  `encounter.changed` (`combatantId: incoming`, after with the id removed) right after
  `turn.advanced` and before the incoming `turn-start` expiries. Skipped dead combatants are not
  reset (a dead combatant takes no reaction).
- `handleInitiativeLeave`: the one `encounter.changed` it already emits drops the leaver's id from
  `reactionsSpent`, and the incoming id when the leave hands on the turn. No new event.
- `handleInitiativeJoin`: unchanged (its `after` spreads `enc`, so the list carries through).

`README.md` "Entry point" gains one bullet: "`attack.roll` with `reaction: true` spends the
attacker's Reaction. It refuses `REACTION_SPENT` until the start of that combatant's next turn."

### D2 — Engine event contract (binding)

The ledger is a contract (`specs/026-dnd5e-engine/contracts/events.md`). These shapes bind every
reader:

| Shape | Change | Old rows |
|---|---|---|
| `Encounter` (state, and `encounter.started` / `encounter.changed` / `encounter.ended` before and after) | `reactionsSpent?: CombatantId[]` | absent = none spent |
| `attack.roll` command | `reaction: boolean`, default `false` | absent = false |
| `attack.resolved` event | `reaction?: true` | absent = not a reaction |
| `encounter.changed` event | may now record a reaction spend (`combatantId` = the reactor) or a reset (`combatantId` = the incoming combatant), besides a join or leave | unchanged |
| Refusal codes | `REACTION_SPENT` | — |

Event `v` stays `1` on every shape. `ENGINE_SCHEMA_VERSION` stays `1`. No session-model catalog
entry changes. `apps/web/app/play/ledger-format.ts` reads `attack.resolved`: a reaction outcome
summary reads `Reaction: Hit (23 vs AC 14)`.

### D3 — The `move` step (`apps/server/src/dm/nodes/schemas.ts`, `prompts/step-grammar.ts`)

`StepSchema` gains, after `roll`:

```ts
z.object({
  step: z.literal("move"),
  reason: Reason,
  combatantId: CombatantIdSchema,
  leavesReachOf: z.array(CombatantIdSchema).max(6),
}),
```

`STEP_GRAMMAR` gains one line after the `roll` line:
`'{"step":"move","reason":str,"combatantId":id,"leavesReachOf":[id]}  (the mover moves; list each hostile it stands next to and moves away from without Disengage)'`.
The interpret and adjudicate prompts render the grammar, so both bump their version.

Every `switch (step.step)` gains the `move` case:

- `gates/plan-gate.ts` `stepIds`: `combatantId` and each `leavesReachOf[i]` (field
  `leavesReachOf[i]`); `stepTexts`: `reason`; `plannedDiff`: no effect.
- `nodes/resolve.ts` `runSteps`: D4. `presenceTargets`: no effect.
- `first-stage.ts`: no change (a `move` is not a check, so it is kept before the first check).

### D4 — Resolve runs the reaction (`apps/server/src/dm/nodes/resolve.ts`, new `apps/server/src/dm/reactions.ts`)

`dm/reactions.ts` holds pure code, unit-tested alone:

```ts
/** The reactor's SRD melee attack as engine inputs, else null. */
export function meleeAttackOf(monster: SrdRecord<"monster">): {
  name: string;
  expression: string;               // "1d20+4"
  components: { amount: { kind: "roll"; expression: string }; damageType: DamageType }[];
} | null;
// First action whose attack.type is "melee" or "melee-or-ranged". Damage parts with a
// `condition` (e.g. "if the attack roll had Advantage") are skipped. Dice strings lose spaces.

/** Which leavesReachOf ids may take an opportunity attack now. */
export function reactors(input: {
  moverId: string;
  leavesReachOf: readonly string[];
  engine: EngineState;
  partyCombatantIds: ReadonlySet<string>;
  encounterMonsters: ReadonlyMap<string, string>;   // combatantId -> srdMonsterId, from the seed
}): string[];
// Keep an id when: an encounter is active; moverId is a party combatant; the id is an
// encounter monster in engine.encounter.order; canAct(engine, id); id is not in
// reactionsSpent. Order and duplicates follow leavesReachOf (first wins).
```

`runSteps` `case "move"`:

1. Load fresh projections. Compute `reactors(...)` with the seed's encounter monsters.
2. For each id: look up the SRD record; `meleeAttackOf`; when null, log `dm.reaction.skipped`
   (`{ jobId, reactorId, reason: "no-melee-attack" }`) and continue.
3. Submit `run.mech(\`${key}:r${n}\`, { type: "attack.roll", attackerId: id, targetId:
   step.combatantId, expression, mode: "normal", targetAc: null, reaction: true },
   \`${reactorName} strikes as ${moverName} pulls away\`, actionId)`.
4. `applied` with outcome `hit` or `critical-hit`: submit `damage.apply` at key
   `${key}:r${n}:e0` with the components and `critical` set, through `effectCommand`'s damage
   branch. `applied` with a miss: nothing more.
5. `refused` with `REACTION_SPENT` (a reclaim race): treat as no reaction; continue.
6. Any other refusal of a reaction submission does not stop the mover's chain: the reaction is not
   the mover's step. `pending` or `suggested` (human DM seat) pauses the chain as today
   (`awaiting`).
7. The `move` step itself submits nothing. The mover's next step runs.

Reaction submissions go through the existing `take`-style bookkeeping so their batch ids join the
action's `batchIds` (the action's ledger rows then include the reaction, which narration needs).
They never set `firstRefusal`.

### D5 — Plan gate: no foreign actor in a party action (`apps/server/src/dm/gates/plan-gate.ts`)

`PlanInput` gains `actors: ReadonlyMap<string, string | null>`: action id → the acting
character's combatant id, `null` for a party-scope action. Resolve builds it from
`assembled.beat` and `assembled.projections.party`.

In `checkPlan`, for a group with a non-null `actionId`, before the id walk: each `attack` step's
non-null `attackerId` and each `move` step's `combatantId` must equal the actor's combatant; for a
party-scope action it must be a party member's combatant. On a mismatch the verdict is
`{ ok: false, code: <OQ-4 code>, failure: { stepIndex, field, id, reason: "not-the-actor" } }`.
`PlanFailureReason` gains `"not-the-actor"`. The monster turn (`actionId: null`) is not checked.

OQ-4 code: reuse the code spec 077 (TASK-0205) adds for its AC #2 rule. If spec 077 merged none,
add `STEP_ACTOR_MISMATCH` to `RefusalCodeSchema` and to `PLAN_GATE_ONLY` in
`test/coverage.test.ts`, with a `satisfies RefusalCode` constant beside `REASON_REFUSAL_CODE`.
The build reads `origin/main` and records which one it used in this file.

### D6 — Interpret prompt (`apps/server/src/dm/prompts/interpret.ts`)

`OUTPUT_SHAPE`'s rule paragraph gains: "When a party member moves away from a hostile it stands
next to, without Disengage, plan a move step for it that lists that hostile in leavesReachOf. Plan
no attack for the hostile: the engine decides any reaction." The shape line's `intent` list is
unchanged. TASK-0113's `agencyRule("interpret")` line ("A monster's reaction is never a step of a
party member's action") stands; this card does not restate it. Version one past `main`.

### D7 — Facts, narrate, fallback and audit

`facts.ts` (no engine import):

- `FactRoll` gains `reaction?: boolean`. `collectFacts` sets `reaction: true` when the linked
  `attack.resolved` has `reaction === true`.
- `NarrationFacts` gains `openFollowUps?: { name: string; text: string }[]`.
  `BuildFactsInput` gains `openFollowUps?: { characterId: string; text: string }[]`;
  `buildNarrationFacts` maps ids to party names and sets the field when non-empty.

`prompts/narrate.ts`:

- `rollEntry` renders a reaction roll as `  reaction: <name> strikes at <target> as they pull away -> <outcome>`.
- `factEntries` renders each open followUp as `Earlier beat, not yet attempted: <name>: <text>`.
- The `RULES` line "A not-yet-attempted step has not happened. Stop before it; never show it start."
  becomes "A not-yet-attempted step has not happened, in this beat or an earlier one. Stop before
  it; never show it start or done." Version one past `main`.
- `prompts/audit.ts` renders `factEntries`, so its facts section changes: bump its version too.

`fallback.ts`, `rollSentences` only:

```ts
const who = r.name && r.name !== "The scene" ? spellDigits(r.name) : subject;
// reasonUsable and outcomeSentence take `who` in place of `subject`.
```

No other fallback function changes. `factualSummary`'s clarify loop (TASK-0209's) is untouched.

`nodes/audit.ts` `deterministicChecks`, the opposite-outcome loop: compute the outcomes from
`a.rolls.filter((r) => r.name === a.characterName && r.outcome)` instead of `a.outcomes`. The rest
of the loop is unchanged.

`nodes/narrate.ts`: pass `openFollowUps` (D8) into `buildNarrationFacts`. `withholdRefusedInputs`
filters open followUps through the same `refuse` as this turn's followUps.

### D8 — Open followUps from earlier beats (new `apps/server/src/dm/follow-ups.ts`)

```ts
/** Each party member's open followUps from its latest resolved action of an earlier turn. */
export function openFollowUps(
  p: SessionProjections,
  prior: readonly PriorTurn[],       // newest first
  thisBeat: readonly string[],       // action ids in this turn's beat
): { characterId: string; text: string }[];
```

For each party member with a `characterId`: find its latest action by `declaredSeq`. Skip when
that action is in `thisBeat`, or is not `resolved`. Find the newest prior checkpoint whose
`interpret` (or `adjudicate`, which wins) holds a reading or ruling for that action id; return its
`followUps`. At most 6 per member.

`nodes/narrate.ts` calls `openFollowUps` with prior turns from `ctx.deps.loadPriorTurns`
(already wired by the worker; absent in unit contexts means none). It loads them only when some
party member's latest action is resolved and outside this beat. That is one extra job-table read
per narrate on most combat turns. Mark it in code with a `ponytail:` comment: the ceiling is a
session with many turn jobs; the upgrade is a `limit` on `loadPriorTurnCheckpoints`.

### D9 — Ledger display (`apps/web/app/play/ledger-format.ts`)

`outcomeSummary` `attack.resolved`: prefix `Reaction: ` when `o.reaction === true`.

## Contracts (additive amendments)

Mark each change "Amended by spec 079 (TASK-0208)". None of these is a frozen contract.

- `specs/026-dnd5e-engine/contracts/engine-api.md`: `Encounter` gains `reactionsSpent`.
- `specs/026-dnd5e-engine/contracts/commands.md`: "Attacks, checks and saves" gains `reaction` and
  its refusals; "Initiative and turns" gains the reset.
- `specs/026-dnd5e-engine/contracts/events.md`: `attack.resolved` gains `reaction`;
  `encounter.changed` gains the spend and reset uses (D2 table).
- `specs/026-dnd5e-engine/contracts/refusals.md`: `REACTION_SPENT` (and the OQ-4 code when added).
- `specs/031-dm-runtime/contracts/resolve.md`: "Plan gate" gains the actor rule; "Action group"
  gains the `move` step and the reaction attack.
- `specs/034-narration-quality/contracts/fallback-summary.md`: the outcome sentence names the
  roller; `narration-facts.md`: `reaction` and `openFollowUps`.

## Tests

- `packages/dnd5e-engine/test/commands/reactions.test.ts` (new): a reaction attack resolves with
  `reaction: true` and spends; a second refuses `REACTION_SPENT` before any draw; null attacker,
  no encounter and not-in-order refuse before any draw; `turn.advance` to the reactor resets it;
  `initiative.leave` drops the leaver and resets an incoming reactor; `encounter.end` clears it;
  replay of the emitted events from `emptyState()` equals the live state.
- `packages/dnd5e-engine/test/execute.test.ts` or `replay.test.ts`: an old-shape encounter with no
  `reactionsSpent` parses and replays (unchanged fixtures stay green).
- `apps/server/test/dm/reactions.test.ts` (new): `meleeAttackOf` for `goblin-warrior` (1d20+4,
  1d6+2 slashing, the advantage part skipped), `goblin-minion` (melee-or-ranged) and a ranged-only
  record (null); `reactors` keeps an unspent able encounter monster and drops a spent one, a party
  member, a captive NPC combatant, an unable one, and every id with no encounter.
- `apps/server/test/dm/opportunity-attack.integration.test.ts` (new, DB): the merge condition. The
  header names the source: run 1 seq 151–161, finding 19, rebuilt on `greyhollow-ford-reed-camp`
  with Kestrel seated human. Cases:
  1. Turn mode, Kestrel active, goblin-2 unspent. Plan: `move` (`leavesReachOf: ["goblin-2"]`)
     then a check for Kestrel to cut Pell's bonds. Rows in seq order: `attack.resolved`
     (`attackerId: goblin-2`, `targetId: kestrel`, `reaction: true`), `hp.changed` on Kestrel,
     `encounter.changed` (spend), then `check.resolved` for Kestrel. The action resolves `applied`.
  2. The same move again before goblin-2's turn writes no attack row.
  3. Run 1's original plan (an `attack` step by goblin-2 in Kestrel's action) is refused by the
     plan gate; no attack row is written.
  4. The turn advances to goblin-2: an `encounter.changed` row removes it from `reactionsSpent`.
- `apps/server/test/dm/plan-gate.test.ts`: the foreign `attackerId` and foreign `move`
  `combatantId` refusals; a party-scope action naming a party member passes; the monster turn is
  not checked; `plan-approach.json`'s plan after the first-stage cut passes (R4).
- `apps/server/test/dm/fallback.test.ts`: new `run 1 seq 154-161` case (US3 scenario 1); an own
  check still names the character; the property test still passes.
- `apps/server/test/dm/audit.test.ts`: an action whose only outcome is a reaction hit does not
  pair its character with the opposite words.
- `apps/server/test/dm/facts.test.ts`: `reaction: true` is set from the outcome row;
  `openFollowUps` names map to party names.
- `apps/server/test/dm/follow-ups.test.ts` (new): US4 scenarios 1 and 3; the ruling's list wins;
  an unresolved latest action carries nothing.
- `apps/server/test/dm/narrate.test.ts`: pin the new version; the reaction line, the open
  followUp line, and the amended rule text.
- `apps/server/test/dm/interpret-prompt.test.ts`: pin the new interpret and adjudicate versions;
  the step-grammar inline snapshot gains the `move` line; the new rule sentence is present.
- `apps/server/test/dm/rules-terms.test.ts` and `dm-scripts.test.ts`: still green (every script
  reply parses against the widened `StepSchema`).
- `apps/web/test/play/ledger-format.test.mjs`: the `Reaction: ` prefix.

## Files

| File | Change |
|---|---|
| `packages/dnd5e-engine/src/schema/state.ts` | `Encounter.reactionsSpent` (D1) |
| `packages/dnd5e-engine/src/schema/commands.ts` | `attack.roll.reaction` (D1) |
| `packages/dnd5e-engine/src/schema/events.ts` | `attack.resolved.reaction` (D1) |
| `packages/dnd5e-engine/src/schema/refusals.ts` | `REACTION_SPENT`; the OQ-4 code if added (D1, D5) |
| `packages/dnd5e-engine/src/commands/attacks.ts` | `handleAttackRoll` reaction checks and spend (D1) |
| `packages/dnd5e-engine/src/commands/encounter.ts` | `handleTurnAdvance` reset; `handleInitiativeLeave` list upkeep (D1) |
| `packages/dnd5e-engine/README.md` | one bullet (D1) |
| `packages/dnd5e-engine/test/commands/reactions.test.ts` | new |
| `packages/dnd5e-engine/test/coverage.test.ts` | `PLAN_GATE_ONLY` gains the OQ-4 code only if added (D5) |
| `apps/server/src/dm/nodes/schemas.ts` | `move` step (D3) |
| `apps/server/src/dm/prompts/step-grammar.ts` | `move` line (D3) |
| `apps/server/src/dm/prompts/interpret.ts` | rule sentence, version (D6) |
| `apps/server/src/dm/prompts/adjudicate.ts` | version only (renders the grammar) (D3) |
| `apps/server/src/dm/reactions.ts` | new: `meleeAttackOf`, `reactors` (D4) |
| `apps/server/src/dm/nodes/resolve.ts` | `runSteps` `case "move"`; `presenceTargets` `move` no-op; plan-gate `actors` input (D3, D4, D5) |
| `apps/server/src/dm/gates/plan-gate.ts` | `move` in `stepIds`/`stepTexts`; actor rule; `not-the-actor` (D3, D5) |
| `apps/server/src/dm/facts.ts` | `FactRoll.reaction`, `openFollowUps` (D7) |
| `apps/server/src/dm/follow-ups.ts` | new: `openFollowUps` (D8) |
| `apps/server/src/dm/nodes/narrate.ts` | load prior turns, pass and withhold open followUps (D7, D8) |
| `apps/server/src/dm/prompts/narrate.ts` | reaction line, open followUp line, rule text, version (D7) |
| `apps/server/src/dm/prompts/audit.ts` | version only (renders `factEntries`) (D7) |
| `apps/server/src/dm/fallback.ts` | `rollSentences` names the roller (D7) |
| `apps/server/src/dm/nodes/audit.ts` | opposite-outcome check reads own rolls (D7) |
| `apps/web/app/play/ledger-format.ts` | `Reaction: ` prefix (D9) |
| `apps/server/test/dm/reactions.test.ts`, `follow-ups.test.ts`, `opportunity-attack.integration.test.ts` | new |
| `apps/server/test/dm/plan-gate.test.ts`, `fallback.test.ts`, `audit.test.ts`, `facts.test.ts`, `narrate.test.ts`, `interpret-prompt.test.ts` | extended |
| `apps/web/test/play/ledger-format.test.mjs` | extended |
| `specs/026-dnd5e-engine/contracts/engine-api.md`, `commands.md`, `events.md`, `refusals.md` | additive amendments |
| `specs/031-dm-runtime/contracts/resolve.md` | additive amendment |
| `specs/034-narration-quality/contracts/fallback-summary.md`, `narration-facts.md` | additive amendments |
| `docs/wiki/dnd5e-engine.md`, `dm-runtime.md`, `dm-failure-and-gates.md`, `dm-narration-quality.md`, `CAPSULES.md`, `INDEX.md`, plus re-pins of every other note that lists a touched file | re-ground (wiki phase) |

**Migrations**: none. **New runtime dependencies**: none. **New event types**: none.

## Overlap

- **TASK-0113 (spec 074, spine #3)** edits `prompts/interpret.ts` (system gains `agencyRule`, the
  goal-note user line), `prompts/narrate.ts`, `prompts/audit.ts`, `nodes/audit.ts` (two new
  deterministic checks), `facts.ts` (`FactRoll.band?`, `involuntary`) and `doctrine.ts`. This plan
  adds one sentence to `OUTPUT_SHAPE`, one field to `FactRoll`, one field to `NarrationFacts`, two
  render lines and one rule text in `narrate.ts`, and one filter in the opposite-outcome loop. It
  does not touch `doctrine.ts` or 0113's new checks. 0113 merges first; this card rebases.
- **TASK-0205 (spec 077, spine #5)** edits `prompts/director.ts`, `prompts/interpret.ts` and
  `gates/plan-gate.ts` (a check rolls for the declaring PC). D5 extends that rule to `attack` and
  `move` steps and reuses its code and its actor map if spec 077 adds one (OQ-4). 0205 merges
  first; this card rebases and reconciles D5 with 0205's helper rather than adding a second one.
- **TASK-0209 (merged, #113)** changed `fallback.ts`'s closing clarify loop only. This plan edits
  `rollSentences` only. The fallback order holds: 0209 → **0208** → 0127.
- **TASK-0127 (spec 070, spine #8, builds after this card)**. This card's hunks in its files:
  - `nodes/schemas.ts`: a new `move` option appended after `roll`. The `check` and `attack`
    options are untouched.
  - `nodes/resolve.ts`: a new `case "move"` in `runSteps`; one no-op branch in `presenceTargets`;
    one new `actors` argument to `checkPlan`. `case "check"`, `Submission`, `findLanded`,
    `outcomeOf` are untouched.
  - `gates/plan-gate.ts`: `move` cases in `stepIds` and `stepTexts`; the actor rule before the id
    walk. The `check` cases are untouched.
  - `packages/dnd5e-engine/src/commands/attacks.ts`: `handleAttackRoll` only; `handleCheckRoll`
    and spec 070's `bandOf` are untouched.
  - `facts.ts`: `FactRoll.reaction?` beside 070's band fields; `collectFacts`' attack branch only.
  - `fallback.ts`: `rollSentences`' subject only. 070 edits `outcomeSentence`; its signature
    `(name, outcome)` is kept.
  - `prompts/narrate.ts`: `rollEntry` gains a reaction branch; 070 adds band and consequence to
    the non-reaction branch.
  0127's tasks.md re-check (runbook B Lane notes) reads these hunks before its dispatch.
- **TASK-0104 (spine #13)** derives model-step attack numbers from stats. The reaction attack
  reads its numbers from the SRD record in `reactions.ts`; 0104 may route it through its own
  derivation. This card does not touch the `attack` step's `expression` or `targetAc`.
- **TASK-0170, 0207, 0214** later edit `facts.ts`, `prompts/narrate.ts` and `fallback.ts`. Each
  rebases on this card's small hunks.

## Open questions

OQ-1 to OQ-6 are in spec.md with recommended defaults (a). This plan implements the defaults. The
deferrals the orchestrator cards: OQ-1 (b) engine engagement, only if wanted; OQ-3 a party
member's opportunity attack offered to its player; OQ-5 (b) if runbook B's playtest shows the miss;
OQ-6 spell and trait reactions after TASK-0105.
