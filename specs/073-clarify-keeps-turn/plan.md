# Implementation Plan: Clarify keeps the turn

**Branch**: `task-0209-clarify-keeps-turn` | **Date**: 2026-11-02 | **Spec**: [spec.md](spec.md)

**Input**: `specs/073-clarify-keeps-turn/spec.md`, TASK-0209, runbook B
(`docs/design/m3-runbook-b-resolution-quality.md`, spine #2, re-split R1).

## Summary

A clarify reading from a human's action holds the beat: resolve skips the turn advance group and
the runner holds the Director's turn-entry, tracker and scene-end moves. The question reaches the
player: the fallback voices it, narrate v8 ends on it, and the option-menu check exempts it. No
event, proposal or frame shape changes.

## Technical Context

**Language/Version**: TypeScript (Node 22), as the repo.
**Primary Dependencies**: Zod, Vitest. **No new runtime dependency.**
**Storage**: none. No migration. No event shape change.
**Testing**: Vitest. Pure unit tests (fallback, audit, narrate, first-stage, interpret prompt) and
one DB integration test on the worktree stack (`REQUIRE_DATABASE=1`).
**Target Platform**: server DM pipeline (runner, first-stage, resolve, fallback, audit, narrate).
**Constraints**: no frozen contract changes (`docs/wiki/ws-protocol.md`, `specs/029-proposal-gate/
contracts/`, `specs/030-play-route/contracts/proposal-seam.md` untouched). `action.resolved` keeps
outcome `no-effect`. The `fallback.ts` change stays small and local (see Overlap).
**Scale/Scope**: 6 source files, 1 new test file, 5 extended test files, 4 contract amendments.

## Constitution Check

Against `.specify/memory/constitution.md` 2.0.0. Re-checked after design: unchanged.

- [x] **I. Agent-operable**: the hold is code over checkpointed readings. An agent seat answers with
      the same `action.declare` and `action.commit` proposals a human uses.
- [x] **II. Content contract**: no codex entity. N/A.
- [x] **III. Data planes**: no new state. The hold is derived per turn from interpret output.
- [x] **IV. Event sourcing**: no event changes. Fewer rows are written on a clarify beat; no row
      shape changes.
- [x] **V. Citations**: no library claim. N/A.
- [x] **VI. 5e engine boundary**: no mechanic changes. A clarify runs no engine command.
- [x] **VII. Structured first**: the hold is a typed set of action ids; the question is a typed
      fact field rendered by code.
- [x] **VIII. Operator-owned content**: no content change.
- [x] **IX. Self-hostable**: no new service or dependency.

## Research

- **R1 — Why the turn advances.** `resolve`'s turn advance group runs when `done` is true. Its third
  disjunct is "a beat item for the active character has a result whose outcome is not
  `awaiting-dm`". A clarify resolves `no-effect`, so `done` is true and `turn.advance` runs
  (`nodes/resolve.ts`, the group after the closing moves).
- **R2 — Why the question is lost.** `factualSummary` (`fallback.ts`) closes each clarify with
  "What does <who> do?" and never reads `c.question`. Narrate v7 asks for "one short open question
  in your own words" and forbids either-or endings; the model wrote the question as given, and
  `EITHER_OR_END` refused it three times (run 1 seq 176–182).
- **R3 — Director moves on a clarify beat.** The runner's post-adjudicate step (`pipeline/
  runner.ts`) already holds turn-entry, tracker and scene-end moves for a cut beat through
  `holdDirector` (`first-stage.ts`, specs/064). The same mechanism holds them for a clarify beat.
  The step runs once per job (`checkpoint.cut`), so a reclaim reuses the held director.
- **R4 — The next submission.** Interpret's user prompt holds "Recent transcript" (the last 20
  entries from `assemble.transcriptTail`, `prompts/common.ts` `transcriptEntries`) and "Beat items".
  The original declaration and the shipped narration are transcript entries. The answer arrives as
  a fresh beat item. No prompt change is needed for interpret to read it (OQ-1 (a)).
- **R5 — nextJob.** `nextJob` in turn mode reads `local.newTableMode`, which only the advance group
  and Director mode moves set. With no advance and the turn-entry move held, it stays null. The
  test asserts it; no code change.
- **R6 — Floor paths.** `dm/floor.ts` and the floor proposal never read readings. End turn, Pass,
  Take floor and the absence pass are unchanged (FR-009).

## Design

### D1 — `dm/first-stage.ts`: the clarify hold (FR-001, FR-004)

- Add `clarifyHolds(beat, readings, rulings): Set<string>`. Pure. An action id is held when its
  beat item is `committed`, its `actor` does not start with `ai:`, its reading has `clarify !==
  null`, and no ruling names it.
- Give `holdDirector` an optional third parameter `reason` (default today's `HELD`). Export
  `CLARIFY_HELD = "held: an action awaits an answer"`.

### D2 — `dm/pipeline/runner.ts`: hold the Director (FR-004)

In the post-adjudicate step, after `cutPlans`, compute `clarifyHolds` over the assembled beat and
the cut readings and rulings. Apply `holdDirector(held, clarified.size > 0, CLARIFY_HELD)` after the
cut hold. Log `clarified` (the count) on the existing `dm.plan.cut` line. The checkpoint save is
unchanged.

### D3 — `dm/nodes/resolve.ts`: skip the advance (FR-002, FR-003)

- Before the action groups, compute `held = clarifyHolds(assembled.beat, readings, rulings)`
  (empty under `hold`).
- In the turn advance group's `done` test, the third disjunct ignores results whose `actionId` is
  in `held`. The reclaim disjunct (`advance` in the checkpoint) and the NPC disjunct are unchanged.
- `actionGroupSteps`, `resolveAction` and the `no-effect` resolution are unchanged.

### D4 — `dm/fallback.ts`: voice the question (FR-005)

In the closing clarify loop only: strip the question's trailing `?`, spell its digits, and push
`${body}?` when `reasonSpeakable(body, state)` is true. Otherwise push today's
"What does <who> do?". `reasonSpeakable` refuses a `?` in its input, which is why the mark is
stripped first. No other function changes.

### D5 — `dm/nodes/audit.ts`: exempt the clarify question (FR-006)

In `deterministicChecks`, skip the option-menu issue when the either-or match came from
`EITHER_OR_END` and the normalized prose ends with a normalized clarify question. Normalize:
lowercase, `spellDigits`, strip quotes, collapse whitespace. `LIST_LINE` still fires. The "facts ask
a question" check is unchanged. `audit-words.ts` is unchanged.

### D6 — `dm/prompts/narrate.ts`: narrate v8 (FR-007)

- `PROMPT_VERSION` becomes `dm.narrate-v8`.
- Replace the unclear-intent rule with: "When an intent is unclear, describe the moment, then end
  with the Unclear intent question exactly as written."
- Replace the closing rule with: "End on something that demands a response. Do not end with an
  either-or question, except the Unclear intent question."
- Every other rule and every fact line is unchanged. The audit prompt (`dm.audit-v4`) already says
  ending on the facts' question is correct (definition 3); no audit prompt change.

## Contracts (additive amendments)

Mark each change "Amended by spec 073 (TASK-0209)". None of these is a frozen contract.

- `specs/031-dm-runtime/contracts/resolve.md`: "Action group" step 1 adds that a held clarify does
  not count as the active actor's resolved action; "Turn advance group" adds the skip.
- `specs/031-dm-runtime/contracts/director.md`: the legality table gains the clarify-beat row.
- `specs/034-narration-quality/contracts/fallback-summary.md`: the last row voices the question,
  with "What does <Name> do?" when it is not speakable.
- `specs/034-narration-quality/contracts/audit-criteria.md`: the option-menu row gains the
  exemption.
- `specs/034-narration-quality/contracts/narration-facts.md`: rule 4 text becomes the v8 rule.

## Tests

- `apps/server/test/dm/clarify-keeps-turn.integration.test.ts` (new, DB): the merge condition. The
  file header names the source: run 1 seq 172–176, finding 21, rebuilt on the `greyhollow-ford`
  seed (spec Assumptions). Cases:
  1. Turn mode, Tamsin active. A clarify reading for "I attack Pell" resolves `no-effect`. No
     `turn.advanced` or `table-mode.changed` row follows; `encounter.activeCombatantId` is still
     `tamsin`; `nextJob` is null.
  2. Tamsin's answer ("I swing my longsword at Pell") resolves with an attack step. Exactly one
     `turn.advanced` row follows.
  3. Control: the same declaration with a `none` step and no clarify advances the turn.
- `apps/server/test/dm/first-stage.test.ts`: `clarifyHolds` selects a human's clarify, skips a
  companion's, a ruled item and a `resolved` item. `holdDirector` with `CLARIFY_HELD` records that
  reason and never holds `free`.
- `apps/server/test/dm/fallback.test.ts`: the existing "Which door?" case now ends with
  "Which door?". New `run 1 seq 172–176` case: the fallback ends with "Longsword in melee, or the
  light crossbow at range?" and holds no "moves next". An unspeakable question ("Roll for it?")
  keeps "What does Ana do?". The property test still passes.
- `apps/server/test/dm/audit.test.ts`: prose ending with the clarify question passes; a different
  either-or ending with a clarify present still fails; a list line still fails.
- `apps/server/test/dm/narrate.test.ts`: pin `dm.narrate-v8`; the system prompt holds both v8 rules.
- `apps/server/test/dm/interpret-prompt.test.ts`: an answer turn's interpret prompt holds the
  original declaration and the narration ending with the question under Recent transcript.

## Files

| File | Change |
|---|---|
| `apps/server/src/dm/first-stage.ts` | `clarifyHolds`, `CLARIFY_HELD`, `holdDirector` reason (D1) |
| `apps/server/src/dm/pipeline/runner.ts` | applies the clarify hold to the Director (D2) |
| `apps/server/src/dm/nodes/resolve.ts` | held ids skip the turn advance (D3) |
| `apps/server/src/dm/fallback.ts` | the closing clarify loop voices the question (D4) |
| `apps/server/src/dm/nodes/audit.ts` | option-menu exemption for the clarify question (D5) |
| `apps/server/src/dm/prompts/narrate.ts` | narrate v8, two rule texts (D6) |
| `apps/server/test/dm/clarify-keeps-turn.integration.test.ts` | new: run 1 seq 172–176 replay, the merge condition |
| `apps/server/test/dm/first-stage.test.ts`, `fallback.test.ts`, `audit.test.ts`, `narrate.test.ts`, `interpret-prompt.test.ts` | extended |
| `specs/031-dm-runtime/contracts/resolve.md`, `director.md` | additive amendments |
| `specs/034-narration-quality/contracts/fallback-summary.md`, `audit-criteria.md`, `narration-facts.md` | additive amendments |
| `docs/wiki/dm-failure-and-gates.md`, `dm-runtime.md`, `turn-floor.md`, `dm-narration-quality.md`, `dm-turn-jobs.md`, `dm-talk-triggers.md`, `party-panel.md`, `seed-npc-presence.md`, `CAPSULES.md`, `INDEX.md` | re-ground (wiki phase) |

**Migrations**: none. **New runtime dependencies**: none.

## Overlap

- **`fallback.ts` is edited later by TASK-0208, 0127, 0207, 0212, 0213 and 0214.** The runbook's
  fallback sequence merges 0209 first. D4 touches only the closing clarify loop in
  `factualSummary`. It does not touch `plannedSentence`, `rollSentences`, `changeSentence`,
  `eventSentences` or `reasonSpeakable`, so later cards rebase onto an unchanged surface.
- **TASK-0113 (spine #3, develops beside 0209)** edits `prompts/narrate.ts`, `prompts/audit.ts` and
  `nodes/audit.ts`. This plan edits two rule strings and the version in `prompts/narrate.ts`, and
  one guard in `nodes/audit.ts`. It does not edit `prompts/audit.ts`. 0113 rebases after 0209
  merges and takes `dm.narrate-v9` (runbook "Prompt versions"). Per the runbook's rule at dispatch,
  the orchestrator decides whether 0113 develops ahead or draft-holds (spec OQ-4).
- **TASK-0205 (spine #5)** makes interpret clarify more often. It edits `prompts/interpret.ts`; this
  plan does not (OQ-1 (a)). 0205 depends on this task's hold.
- **`nodes/resolve.ts`** is edited by 13 later cards. D3 changes one predicate in the turn advance
  group and adds one local; `resolveAction` and `actionGroupSteps` are unchanged.
- **`pipeline/runner.ts` and `first-stage.ts`** are not in any other runbook B footprint.

## Open questions

OQ-1 to OQ-4 are in spec.md with recommended defaults (a). This plan implements the defaults.
