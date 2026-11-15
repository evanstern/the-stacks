# Tasks: A deed posted mid-narration is audited against the narration that tells it

**Spec**: `specs/115-deed-mid-narration/spec.md` | **Plan**: `specs/115-deed-mid-narration/plan.md`
**Rule**: one phase is one sonnet dispatch. Run `pnpm ci:check` green at the end of every phase.
Tests use the fake gateway only. DB tests run on the worktree's own stack (`REQUIRE_DATABASE=1`).
Do not edit the runtime (spec FR-009), `auditor/checks.ts`, `dm/prompts/react.ts` or `dm/nodes/schemas.ts`.

## Phase 1: Window export and cut-aware segments (FR-001–FR-006; AC #1)

- [ ] T001 In `apps/server/src/playtest/export.ts`, add optional `factsThrough` and `narrationSeqs` to `JobItem`. Fill them in `toJobItem` from the turn checkpoint (plan D1).
- [ ] T002 In `apps/server/src/playtest/auditor/segments.ts`, add `narrationCuts(jobs)` and the optional `cuts` argument to `segment` (plan D2). Keep the no-cuts result identical.
- [ ] T003 In `auditor/audit.ts`, pass `narrationCuts(input.jobs)` to `segment`. In `playtest/cli.ts`, pass the same cuts in the provider preflight count (plan D3).
- [ ] T004 Extend `apps/server/test/playtest/checks.test.ts` with the plan D4 unit cases 1–4, including the 8c7d506e shape (SC-001, SC-002).
- [ ] T005 Amend `specs/032-playtest-harness/contracts/auditor.md` "Segments" and `contracts/run-directory.md` `jobs.json`.

## Phase 2: The 8c7d506e replay (FR-007, FR-008; AC #2)

- [ ] T006 Move `pausing` from `test/dm/narration-stream-gate.integration.test.ts` into `test/dm/worker-world.ts` as an export. Import it back; leave the spec 108 test body unchanged.
- [ ] T007 Write `apps/server/test/dm/deed-mid-narration.integration.test.ts` per plan D4 steps 1–6: pause the monster narrate, submit the floor holder's `/attack` Intent, release, drain, assert the race shape, then audit code-only and assert `deeds-narrated` and `dice-lines` pass on every segment.
- [ ] T008 Add the step 7 control to the same file: with `factsThrough` stripped, `deeds-narrated` fails and cites the carrier.

## Phase 3: Wiki

Re-pin honestly with `/grounding-wiki:wiki-update`. Notes whose `sources:` this card touches (NEEDS-REVIEW):

- [ ] T009 `docs/wiki/playtest-harness.md` (`export.ts`, `auditor/audit.ts`, `auditor/segments.ts`, `cli.ts`): segments cut at each narration's facts window; `jobs.json` carries `factsThrough` and `narrationSeqs`.
- [ ] T010 Re-verify and re-pin `docs/wiki/m2-demo.md` (`cli.ts`). Change prose only if the diff says otherwise.
- [ ] T011 Add the new replay test to `docs/wiki/test-suite.md` beside the spec 108 `narration-stream-gate` line. Re-pin it if its sources list a touched file.
- [ ] T012 Update the `playtest-harness` lines in `docs/wiki/CAPSULES.md` and `docs/wiki/INDEX.md`. Run the freshness gate (prints `OK`) and the spec-bridge gate (exits 0).
