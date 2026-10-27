# Live check — TASK-0100 Phase 2 (Brave, 2026-10-27)

Stack: `stacks-task-0100` (app :3100), built from the Phase 1 tree (f32aa03), both databases migrated by hand.
Accounts: one operator (seated as the human DM) and two players, random passwords kept in an untracked creds
file outside the repo. Browser: Brave, launched by `executablePath` through playwright-core loaded from outside the repo.

Each run seeds one session from the `dm-approvals` fixture with `seed-suggest.mjs` (operator mapped to the DM seat;
P3, the scene suggestion, stays pending). `shoot-suggest.mjs` then drives the live route `/play/:id` and the fixture
route `/play/fixtures/dm-approvals` (viewer DM, last step) at 1280 and 390 px, light and dark.

Result: 68 PASS, 0 FAIL.

- Both routes: the scene row shows the "Suggestion" label and Dismiss only, no Approve. The two `ask` rows (hidden tracker, table mode) keep Approve and Reject.
- Live route: before Dismiss, zero `proposal.rejected` rows exist for `prop-3`. After Dismiss the row leaves the list and exactly one row exists: seq 20, payload `{"reason": null, "proposalId": "prop-3"}`.
- Fixture route: Dismiss removes the row at once.
- No `<dialog>` in the DOM in any state. No horizontal overflow at 390 px (0 px).

Screenshots: 16 files in `shots/` (`suggest-{live,fixture}-{before,after}-{1280,390}-{light,dark}.png`).

Notes:
- The fixture already holds one `proposal.rejected` row (prop-2, with a reason); the check counts rows for `prop-3` only.
- The test database holds rows for each run's sessions; the stack stays up for the orchestrator.
- No finding.
