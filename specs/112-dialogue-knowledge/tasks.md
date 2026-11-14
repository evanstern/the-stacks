# Tasks: Dialogue knowledge

**Spec**: `specs/112-dialogue-knowledge/spec.md` | **Plan**: `specs/112-dialogue-knowledge/plan.md`
**Rule**: one phase is one sonnet dispatch. Run `pnpm ci:check` green at the end of every phase.
Tests use the fake gateway only. DB tests run on the worktree's own stack (`REQUIRE_DATABASE=1`).
Keep the `checks.ts` diff inside the hidden-info block (TASK-0337 edits the same file).

## Phase 1: Knowledge model and the speech check (US1, US2, AC #1)

- [x] T001 Add `met: boolean` and `knows: string[]` to `SnapshotActor` in `dm/snapshot/types.ts`. Derive both in `dm/snapshot/build.ts` per plan D1, with the `ponytail:` comment on the `removed` rule.
- [x] T002 Fix every test-side `SnapshotActor` literal the typecheck flags. Add `met` and `knows`; keep each test's intent.
- [x] T003 In `dm/narration-check.ts`, add `speechLeaks`, `CheckInput.speakerId`, kind `unmet-actor`, the optional `inner` field and `dropPlan` per plan D2. Life-state and dice-language keep the masked text.
- [x] T004 Extend `dropSentences` with the inner-sentence map per plan D3. Drop the whole sentence when its quote has no inner sentence left.
- [x] T005 Use `dropPlan` in `dm/nodes/check.ts`, `dm/narration-stream.ts` and `dm/talk-turn.ts`. In `talk-turn.ts`, pass `react.speaker` for a `reply` only (plan D4).
- [x] T006 Write `apps/server/test/dm/fixtures/r1-spine-0106e608.json` per plan D6 and D7. Replace the human user id with `PLAYER_USER`. Add a `_header` naming the source.
- [x] T007 Write `apps/server/test/dm/dialogue-knowledge.test.ts`. Assert `met` and `knows` at seq 20 (Wenna met, Pell and Snag unmet; Wenna knows Pell). Replay seq 21 and seq 30 per spec US1 and US2 with the exact shipped texts.
- [x] T008 Update `narration-check.test.ts` per plan D6. Add a fogged-zone-in-quote case and an unknown-speaker case. Add one quoted-leak case to `narration-stream.test.ts`; the prefix property test stays green.
- [x] T009 Add a seq 21 reply case to `talk-turn.integration.test.ts` (fake gateway, `REQUIRE_DATABASE=1`). Assert the shipped narration text and one `dm` correction naming Snag.

## Phase 2: Prompts see only met names (US3, AC #2)

- [x] T010 In `dm/snapshot/render.ts`, export `visibleActors(snapshot, view)`. Drop unmet actors in the `seat` and `fiction` views, including the compressed path (plan D5).
- [x] T011 In `dm/prompts/narrate.ts`, index `characterSections` by `visibleActors`. Bump to `dm.narrate-v25`. Bump `dm/prompts/react.ts` to `dm.react-v5`.
- [x] T012 In `dm/prompts/companion.ts`, keep only relationships to met actors. Bump to `dm.companion-v10`.
- [x] T013 Write `apps/server/test/dm/dialogue-knowledge-prompts.test.ts`. Build Odo's companion prompt and the react prompt from the fixture at seq 20 and with corrected seq 21. Assert no Snag alias in either; assert Pell appears only after corrected seq 21.
- [x] T014 Update version strings and render cases in `react-prompt.test.ts`, `narrate.test.ts`, `companion-addressee.test.ts`, `talk-turn.integration.test.ts` and the snapshot render tests.

## Phase 3: Auditor mirrors the runtime rule (US4, card note)

- [ ] T015 In `playtest/auditor/checks.ts`, add the speech finding inside the hidden-info block per plan D8. Import `project`, `buildSnapshot` and `speechLeaks`.
- [ ] T016 In `test/playtest/checks.test.ts`, replay the fixture transcript with the original seq 21 text: `hidden-info` fails at seq 21 and the finding names Snag, not Pell. With the corrected text it passes.
- [ ] T017 Confirm the clean and doctored auditor fixtures keep their verdicts. Record any changed finding in the card notes.

## Phase 4: Wiki re-pin

- [ ] T018 Re-verify and re-pin `docs/wiki/dm-narration-quality.md` (speech rule, `unmet-actor`, inner cuts, prompt versions), `actor-snapshot.md` (`met`, `knows`, view filter), `dm-talk-triggers.md` (reply speaker, `dm.react-v5`) and `playtest-harness.md` (hidden-info speech finding). Pin to the phase-3 commit.
- [ ] T019 Re-pin the other notes that list a changed source with no semantic change: `dm-runtime.md`, `output-claim-gate.md`, `seed-npc-presence.md`, `dm-turn-jobs.md`, `debug-view.md`. Re-pin each only after reading the diff of its sources.
- [ ] T020 Update `CAPSULES.md` and the `INDEX.md` state line for spec 112. Run the freshness gate: `node ~/.claude/plugins/cache/praxisflux/grounding-wiki/<version>/gates/cli.mjs freshness . docs/wiki` prints `OK`.

## Dependencies

Phase 1 → Phase 2 → Phase 3 → Phase 4. Phase 3 needs `speechLeaks` and the snapshot fields from Phase 1, not Phase 2.

## Constitution compliance

- III: T007, T013 and T016 are the hidden-information tests for this change.
- VII: the check never blocks; T009 asserts the reply ships with a correction.
