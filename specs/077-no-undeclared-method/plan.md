# Implementation Plan: No undeclared method

**Branch**: `task-0205-no-undeclared-method` | **Date**: 2026-11-02 | **Spec**: [spec.md](spec.md)

**Input**: `specs/077-no-undeclared-method/spec.md`, TASK-0205, runbook B
(`docs/design/m3-runbook-b-resolution-quality.md`, lane B1, spine #5).

## Summary

One pure function, `askUndeclared`, in `gates/plan-gate.ts` applies two rules to each human action's
plan. A manner skill (Stealth, Deception, Intimidation) the declaration does not state becomes a
clarify. A check or attack that rolls for another human's PC becomes a clarify. The runner calls it
in the post-planning step, after the free-mode cut and before spec 073's `clarifyHolds`, so the
turn holds and the player sees the question. No prompt, event, schema or engine change.

## Technical Context

**Language/Version**: TypeScript (Node 22), as the repo.
**Primary Dependencies**: Zod, Vitest. **No new runtime dependency** (checkpoint C5 not reached).
**Storage**: none. **No migration.** No event type, no event field.
**Testing**: Vitest. Pure unit tests (`plan-gate.test.ts`, `runner.test.ts`) and one new DB
integration test on the worktree stack (`REQUIRE_DATABASE=1`). Fake gateway only; no paid run.
**Target Platform**: the server's DM pipeline (runner post-planning step).
**Constraints**: frozen contracts unchanged (`ws-protocol.md` frames, `specs/029-proposal-gate/
contracts/`, `specs/030-play-route/contracts/proposal-seam.md`). `checkPlan` and `PlanVerdict` are
unchanged. No prompt file is touched, so no prompt version bumps.
**Scale/Scope**: 2 source files (0 new), 3 test files changed, 1 new test file, 1 new script
fixture, 1 contract amendment, 7 wiki notes plus `CAPSULES.md`/`INDEX.md`.

## Constitution Check

Against `.specify/memory/constitution.md` 2.0.0. Re-checked after design: unchanged.

- [x] **I. Agent-operable**: the rule runs in the DM pipeline. A playtest seat meets the same
      clarify a human sees. Tests drive it with no UI.
- [x] **II. Content contract**: no codex entity, no seed shape change.
- [x] **III. Data planes**: session plane only, read-side (snapshot and beat).
- [x] **IV. Event sourcing**: no new event or field. The clarify reading lives in the turn
      checkpoint, as spec 073's clarify does.
- [x] **V. Citations**: no library claim. The OQ-4 card cites SRD 5.2.1 Hide for later work.
- [x] **VI. 5e engine boundary**: the rule only removes steps before the engine runs. No number.
- [x] **VII. Structured first**: the questions are fixed code strings in a typed table.
- [x] **VIII. Operator-owned content**: no book text.
- [x] **IX. Self-hostable**: no service, purpose or dependency.

**Stack conformance**: no departure. **Complexity Tracking**: none.

## Research

- **R1 — Why code, not only a prompt line.** 0113's interpret line ("when the method matters and is
  not stated, ask") is prompt text. A fake-gateway test proves the text is present, never that a
  model obeys it. Run 1 is the model not obeying. The merge condition says "no Stealth check", so
  code must remove it. The rule turns the step into a clarify instead of refusing, because spec 073
  makes a human's clarify free and a refusal ("cannot do that here") reads as a no.
- **R2 — Why the runner, not `checkPlan`.** `checkPlan` returns a verdict; a refused verdict makes
  resolve submit `refused`, and in turn mode the turn then advances. Only a clarify reading reaches
  `clarifyHolds` (spec 073), and that runs in the runner's post-planning step
  (`pipeline/runner.ts`, the `adjudicate` branch). The function lives in `gates/plan-gate.ts`
  beside `checkPlan`, as the runbook's footprint names. The runner imports it.
- **R3 — Which skills.** The engine's `Skill` enum (`packages/dnd5e-engine/src/schema/state.ts`)
  holds 18 skills. Three name how a character presents itself: `stealth` (unseen),
  `deception` (false), `intimidation` (threat). The rest name a task the DM may call from a plain
  declaration (Athletics to cross mud, Perception to look, Sleight of Hand to untie). Spec OQ-3.
- **R4 — Who declared.** `BeatItem.actor` is the declaring user id, or `ai:companion:<id>` for a
  companion (`first-stage.ts` `clarifyHolds` reads the same prefix). Each party `SnapshotActor`
  carries `controller` (`{ kind: "player", userId }` or `{ kind: "ai-companion", actor }`). A roller
  is "another human's PC" when its party actor's controller is `player` and its `userId` differs
  from the declaring `actor`. One human with two PCs passes. A party-scope action skips the rule:
  group sign-off (spec 044) already took every present human's approval.
- **R5 — Which steps.** Roller rule: `check` with `kind: "ability-check"` (`combatantId`) and
  `attack` (`attackerId`). A saving throw is a reflex the dice decide (spec 074 research (e)). Effect
  targets are who is affected, not who acts. Manner rule: `check` with `kind: "ability-check"` and a
  manner `skill`. A saving throw never carries a manner choice.
- **R6 — Cue patterns are lexical.** Each manner row holds a word-boundary regex over the action
  text. `ponytail:` note in code: the ceiling is negation ("I don't sneak" matches) and synonyms
  outside the list; the upgrade path is an interpret-written `method` field the gate compares, if
  the playtest shows misses.
- **R7 — Questions reach the player.** `fallback.ts` `reasonSpeakable` refuses a body with a `?`
  before its end, a digit, or a `SYSTEM_WORDS` word. Each question below ends in its only `?`
  after the closing one is stripped, holds no digit and no system word. The audit's option-menu
  check exempts a closing clarify question (spec 073 D5), so the "or" questions pass.
- **R8 — Existing fixtures.** `plan-first-step.integration.test.ts` declares, as Tamsin, "I walk
  openly to the camp; Kestrel and Odo follow hidden." on the `greyhollow-ford-duo` seed, and
  `plan-approach.json` rolls Stealth for Kestrel, a human there. The roller rule now asks. The test
  moves to the `greyhollow-ford` seed, where Kestrel and Odo are companions (seats
  `{ tamsin: TAMSIN_USER }`); its assertions stay. The manner rule passes: "hidden" is a Stealth
  cue. Every other shipped script rolls only for the declarer, a companion or a monster (scan of
  `apps/server/test/dm/scripts/` and `apps/server/dm-scripts/`).
- **R9 — Live script `greyhollow-plan-approach`.** It shares `plan-approach.json`'s calls
  (`dm-scripts.test.ts`). On a duo table in script mode, its Kestrel step now asks. It is a
  scripted demo of the first-stage cut, run against `greyhollow-ford` in the TASK-0182 live check.
  It is left unchanged.
- **R10 — Spine.** The plan touches no file TASK-0113 (spec 074 plan "Files the build touches")
  or TASK-0208 touches. Only AC #3's tick waits for 0113 to merge. Under the runbook's rule ("a task
  may develop ahead of its turn when its plan.md shares no source file with the tasks ahead of
  it"), this task may develop now. The orchestrator decides.

## Design

### D1 — `askUndeclared` (`apps/server/src/dm/gates/plan-gate.ts`)

```ts
import type { Ruling } from "../nodes/adjudicate.js";
import type { BeatItem } from "../nodes/assemble.js";

/** Skills that name how a character presents itself (spec 077 OQ-3 (a)). */
export const MANNER_SKILLS = [
  {
    skill: "stealth",
    cues: /\b(sneak\w*|snuck|stealth\w*|hid|hide|hides|hiding|hidden|quiet\w*|silent\w*|unseen|unnoticed|undetected|creep\w*|crept|skulk\w*|tiptoe\w*|slink\w*|stalk\w*)\b/i,
    question: "Are you trying to stay unseen, or moving openly?",
  },
  {
    skill: "deception",
    cues: /\b(lie|lies|lying|lied|bluff\w*|deceiv\w*|trick\w*|pretend\w*|feign\w*|disguis\w*|mislead\w*|fake\w*|pose as|posing as)\b/i,
    question: "Are you being honest with them, or trying to mislead them?",
  },
  {
    skill: "intimidation",
    cues: /\b(intimidat\w*|threat\w*|menac\w*|scare\w*|frighten\w*|cow|bully\w*|glower\w*|loom\w*|snarl\w*)\b/i,
    question: "Are you trying to frighten them, or asking plainly?",
  },
] as const satisfies readonly { skill: Skill; cues: RegExp; question: string }[];

export const otherPlayerQuestion = (name: string) =>
  `${name}'s player decides what ${name} does. What do you do?`;

export interface Asked {
  actionId: string;
  stepIndex: number;
  rule: "manner" | "other-player";
  /** The manner skill, or the other PC's name. */
  detail: string;
}

export function askUndeclared(input: {
  snapshot: ActorSnapshot;                       // S0
  beat: readonly BeatItem[];
  readings: readonly InterpretReading[];
  rulings: readonly Ruling[];
  resumed: readonly string[];
}): { readings: InterpretReading[]; rulings: Ruling[]; asked: Asked[] };
```

Rules, per beat item with `status: "committed"` whose id is not in `resumed`:

1. The group's steps are its ruling's steps when a ruling names the action, else its reading's. A
   reading with `clarify` set is skipped. The NPC reading (`actionId: null`) is never visited.
2. Walk the steps in order. On each step, test the manner rule, then the other-player rule. The
   first failure asks; stop there.
3. **Manner** (skip when `actor` starts with `ai:`): a `check` step with `kind: "ability-check"` whose
   `skill` is a `MANNER_SKILLS` row fails when the row's `cues` does not match the item's `text`.
4. **Other player** (skip when `scope === "party"`): a `check` with `kind: "ability-check"` (field
   `combatantId`) or an `attack` (field `attackerId`) fails when the id names a `kind: "party"`
   actor `a` (`a.combatantId === id`, or `a.id === id` when `a.combatantId` is null) whose
   controller is `{ kind: "player" }` with `userId !== item.actor`. A null id passes.
5. On a failure, the reading becomes `{ ...reading, steps: [], followUps: [], clarify: question }`.
   The ruling for that action id is removed. One `Asked` record is pushed.
6. A reading or ruling with no failure is returned as the same object. No other field changes.

Put the `ponytail:` note of R6 on `MANNER_SKILLS`. `Skill` is the engine type `nodes/schemas.ts`
already imports.

### D2 — Runner wiring (`apps/server/src/dm/pipeline/runner.ts`)

In the `adjudicate` post-planning branch, between `cutPlans` and the `cutBeat`/`clarifyHolds`
lines:

```ts
const asked = askUndeclared({
  snapshot: assembledOut.snapshot,
  beat: assembledOut.beat,
  readings: cut.readings,
  rulings: cut.rulings,
  resumed: (assembledOut.resumed ?? []).map((p) => p.actionId),
});
```

`cutBeat`, `clarifyHolds`, the stored checkpoint and `ctx.results` then read `asked.readings` and
`asked.rulings` instead of `cut.*`. The `dm.plan.cut` log line gains `asked: asked.asked.length`.
`assembledOut` is the existing `ctx.results.assemble as NodeOutputs["assemble"]` cast, hoisted to
one `const`. The branch keeps running once per job (`cut: true` in the checkpoint), so a reclaim
does not ask again.

### D3 — Contract amendment (`specs/031-dm-runtime/contracts/nodes.md`)

Append "Amendment 2026-11-02 (specs/077-no-undeclared-method): the undeclared-method ask". State
D1's rules 1–6 and D2's order (cut, ask, `clarifyHolds`). Mark it "Amended by spec 077
(TASK-0205)". No prompt version changes.

## Tests

- **`apps/server/test/dm/plan-gate.test.ts`** (extend), `describe("askUndeclared (spec 077)")` on
  `buildSnapshot(greyhollowDuo())` (Tamsin `PLAYER_USER`, Kestrel `SECOND_USER`, Odo companion):
  1. Run 1 seq 24: Tamsin, "We move toward the reed camp until we see Goblins or they see us.",
     Stealth for Kestrel → clarify, `steps: []`, rule `manner` (step 0 fails the manner rule
     first).
  2. Same text, Stealth for Tamsin → clarify, manner question.
  3. "We sneak toward the reed camp.", Stealth for Kestrel → clarify, `otherPlayerQuestion("Kestrel")`.
  4. Same text, Stealth for Tamsin and for Odo → unchanged (same object).
  5. Run 1 seq 114: "I move towards Pell", Athletics for Tamsin → unchanged; Stealth → manner clarify.
  6. Party scope, Stealth for Kestrel, text with a cue → unchanged.
  7. A saving throw for Kestrel from Tamsin's action → unchanged.
  8. A heal and a damage effect on Kestrel from Tamsin's action → unchanged.
  9. An attack with `attackerId: "kestrel"` from Tamsin's action → other-player clarify.
  10. A companion's action (`actor: "ai:companion:odo"`), Stealth for Odo, no cue → unchanged.
  11. A ruling with a Stealth step replaces the reading → clarify on the reading; ruling removed.
  12. A resumed action id and a clarify reading → unchanged. The NPC reading → unchanged.
  13. One user holding two PCs (edit the snapshot) → a check for the second PC passes.
  14. Deception and Intimidation rows: a cue passes, no cue asks.
  15. Every `MANNER_SKILLS` question and `otherPlayerQuestion("Kestrel")` holds no digit, matches
      no `SYSTEM_WORDS` (import from `fallback.ts`), has one `?`, and is at most 200 characters.
- **`apps/server/test/dm/runner.test.ts`** (extend the "post-planning cut" describe): a free-mode
  beat item with no cue and a Stealth reading → resolve sees a clarify reading, the Director's turn
  move is held with `CLARIFY_HELD`, and the saved checkpoint stores the clarify. The stub
  `assembled()` default gains `snapshot: buildSnapshot(greyhollowDuo())`, so every existing runner
  test still passes. Its stub beat items carry no `status`, so rule 1 skips them; the new case
  passes a full `BeatItem`.
- **`apps/server/test/dm/no-undeclared-method.integration.test.ts`** (new, DB). Header names the
  source: run 1 seq 24–30, findings 4 and 14, rebuilt on `greyhollow-ford-duo` with no model. Follow
  `noncombatant-targets.integration.test.ts` (scene start, `mutate` the interpret reading):
  1. **Merge condition.** Tamsin commits run 1's text; the reading is run 1's (Stealth for Kestrel,
     `dex`, disadvantage, DC 13, `1d20+5`). Assert: no `check.resolved` row after the commit;
     `action.resolved` `no-effect`; the checkpoint's reading has `steps: []` and the Stealth
     question; no `turn.advanced` row.
  2. **Roller.** Text "We sneak toward the reed camp."; Stealth for Kestrel. Assert no
     `check.resolved` and the other-player question.
  3. **Control.** Same text; Stealth for Tamsin; dice `[12]`. Assert one `check.resolved` with
     `skill: "stealth"` and `combatantId: "tamsin"`; `action.resolved` `applied`.
- **`apps/server/test/dm/scripts/approach-reed-camp.json`** (new): director (free, `stay`, run 1's
  goal note "Approach beat: call Stealth (Kestrel leads, +5; Tamsin's mail and Wenna's boathook argue
  against quiet)"), interpret (run 1's reading), narrate (a short narration that ends on the
  question), audit (pass). Dice `[]`. Copy the call shapes from `exploration-check.json`.
- **`apps/server/test/dm/plan-first-step.integration.test.ts`** (fixture change, R8): seed
  `greyhollow-ford`, seats `{ tamsin: TAMSIN_USER }`. Remove the now-unused `KESTREL_USER`.
  Assertions unchanged.

## Files the build touches

Every path below is the full list. A build that needs another file stops and amends this list.

**Phase 1 — the rule (AC #1, #2)**
- `apps/server/src/dm/gates/plan-gate.ts` (`MANNER_SKILLS`, `otherPlayerQuestion`, `Asked`,
  `askUndeclared`)
- `apps/server/test/dm/plan-gate.test.ts`

**Phase 2 — wiring and the replay (AC #1 merge condition, #2)**
- `apps/server/src/dm/pipeline/runner.ts` (D2)
- `apps/server/test/dm/runner.test.ts`
- `apps/server/test/dm/no-undeclared-method.integration.test.ts` (new)
- `apps/server/test/dm/scripts/approach-reed-camp.json` (new)
- `apps/server/test/dm/plan-first-step.integration.test.ts` (seed and seats only)
- `specs/031-dm-runtime/contracts/nodes.md` (D3)

**Phase 3 — wiki**
- Review: `docs/wiki/dm-failure-and-gates.md` (pins `plan-gate.ts`, `runner.ts`),
  `docs/wiki/dm-runtime.md` (pins `runner.ts`), `docs/wiki/dm-narration-quality.md` (runbook list:
  the clarify the fallback voices).
- Re-pin after a check that the change does not alter what they state: `docs/wiki/output-claim-gate.md`
  and `docs/wiki/seed-npc-presence.md` (pin `plan-gate.ts`), `docs/wiki/dm-talk-triggers.md` and
  `docs/wiki/dm-turn-jobs.md` (pin `runner.ts`).
- `docs/wiki/CAPSULES.md`, `docs/wiki/INDEX.md`.

Not touched: `prompts/director.ts`, `prompts/interpret.ts` (TASK-0113 owns the prompt side),
`nodes/resolve.ts`, `fallback.ts`, `first-stage.ts`, `packages/dnd5e-engine`,
`apps/server/dm-scripts/` (R9), `.claude/`, `backlog/`.

## Overlap with tasks in implementation

- TASK-0113 (spec 074): no shared file. AC #3 cites its tests.
- TASK-0208 (spine #7): `resolve.ts`, `fallback.ts`, `interpret.ts`, `narrate.ts`, engine. Disjoint.
- TASK-0127 (spec 070): `plan-gate.ts`. 0127 merges after this task (spine #8) and rebases on
  `askUndeclared`. Its D-steps add fields to `check` steps; rule 3 and 4 read only `kind`, `skill`,
  `combatantId`, `attackerId`.
- TASK-0128: interpret step kinds for opposition and Help. When it adds a step kind with a roller,
  it extends rule 4. Note this in its spec.

## Risks

- **Lexical cues.** A player's synonym outside the list asks once; the answer names the manner.
  A negation passes. Both are the R6 ceiling. The playtest's "Undeclared method" row is the watch.
- **More clarify turns.** Each ask costs one round trip. Spec 073 holds the turn, so it costs no
  turn. The playtest reports the ask rate.
- **A downed or absent PC in the other-player question.** The fallback runs `checkClaims` on a
  clarify body. "Kestrel ... does" may fail it when Kestrel is down. The fallback then ships its
  stock "What does Tamsin Vale do?". The turn still holds.
