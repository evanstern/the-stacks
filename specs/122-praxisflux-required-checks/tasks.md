# Tasks: praxisflux gates as required GitHub checks

**Spec**: `specs/122-praxisflux-required-checks/spec.md` | **Plan**: `plan.md`
**Rule**: one phase is one sonnet dispatch. Run `pnpm ci:check` green at the end of every phase.

## Phase 1: Gates and scope script (FR-001–FR-005, FR-008)

- [x] T001 Add `scripts/check-spec-scope.mjs`, `-lib.mjs` and `-lib.test.mjs`; the test is picked up by `check:scripts`.
- [x] T002 Add `.spec-bridge.json` with `requireDispatchRecord: true`.
- [x] T003 Add `.github/workflows/gates.yml` with the four jobs.
- [x] T004 Re-pin `docs/wiki/hosted-dev.md`; wiki freshness gate exits 0.

## Phase 2: Enforcement and proof (FR-006, FR-007)

- [ ] T005 Mark the four checks required on `main`, or open the question card to Evan naming them.
- [x] T006 Open the non-compliant PR, show CI blocks it, close it unmerged; open the compliant PR and show it passes; link both on the card.
