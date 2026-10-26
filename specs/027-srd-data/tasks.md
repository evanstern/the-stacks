# Tasks: First Scene — SRD 5.2.1 baseline data with attribution

**Input**: Design documents from `specs/027-srd-data/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md.
**Phase 2 is blocked** until the orchestrator records on TASK-0043 the operator's answers to
plan.md checkpoints C1 (data source, PENDING OPERATOR APPROVAL) and C3 (go-ahead to fetch the
PDF and the dataset). Phases 1, 3 and 4 do not depend on C1's answer; Phase 3 needs Phase 2's
data to finish its whole-data tests.

**Tests**: requested by the card (AC #5, AC #6) and the spec (FR-002, FR-011, FR-021). Each
phase writes its tests with its code.

**Phases**: each phase is one implementer dispatch and ends with one commit.

**Standing rules for every phase**:
- Run `cd /Users/evanstern/projects/the-stacks/.worktrees/task-0043 && pwd && git branch --show-current` first. Expect `task-0043-srd-data`. On any other branch, STOP.
- Add no package beyond plan.md's New dependencies table. Any other package needs the operator. STOP and report.
- `packages/srd` imports only `zod` and Node built-ins. Never import `@the-stacks/dnd5e-engine`, `@the-stacks/shared`, or any app. Never edit `packages/dnd5e-engine/` (TASK-0042 owns it).
- Never read, copy, or commit anything from `/Volumes/evan/dnd-sourcebooks` or `fixtures/private/` (constitution VIII).
- Never commit the SRD PDF or the upstream dataset checkout. Keep them in a scratch directory outside the repo.
- Never put game content in a record, fixture or test that is not in SRD 5.2.1. Schema fixtures use neutral placeholders ("Fixture Monster"), never invented or third-party game prose.
- Never add a modal, `<dialog>`, `showModal`, `AlertDialog`, or a Sheet used as a modal. Use a route.
- Take screenshots in Brave, not Chrome.
- Never use the backlog MCP tools. Do not edit the card; the orchestrator owns it.
- Commit per phase with a `TASK-0043:` subject and the `Co-Authored-By` trailer. Use `git -C /Users/evanstern/projects/the-stacks/.worktrees/task-0043` in its own Bash call; stage in a separate call. Run `git pull --no-rebase`, then push. Never rebase, amend, or force-push.
- Defer nothing as prose. Work this spec does not build is named in plan.md C2 or in a board card.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependencies)
- **[Story]**: user story from spec.md (US1 lookups, US2 attribution, US3 compact, US4 provenance)

---

## Phase 1: Package scaffold, schemas, attribution, estimator (one dispatch)

**Purpose**: everything that does not need the real data. Ends with `pnpm ci:check` green on
an empty data set.

- [x] T001 Create `packages/srd/package.json`: name `@the-stacks/srd`, private, `type: module`, `main`/`types` at `dist/index.js`/`dist/index.d.ts`, `exports` for `"."` and `"./attribution"` (`dist/attribution.js` + types), `files` listing `dist`, `data`, `ATTRIBUTION.md`; scripts `build: tsc -b`, `typecheck: tsc -b`, `test: vitest run`; dependency `zod: ^4.6.5`; devDependency `vitest: ^5.0.1`.
- [x] T002 Create `packages/srd/tsconfig.json` (extends `../../tsconfig.base.json`, `rootDir: src`, `outDir: dist`, `include: ["src"]`) and `packages/srd/test/tsconfig.json` (`noEmit: true`, `include: ["."]`, references `..`), following `apps/server/test/tsconfig.json`.
- [x] T003 Add `{ "path": "packages/srd" }` and `{ "path": "packages/srd/test" }` to root `tsconfig.json` references.
- [x] T004 In `biome.json`, add `!packages/srd/data` and `!packages/srd/provenance` to `files.includes`, and add the `packages/srd/**` override from plan.md "Boundary rule".
- [x] T005 [P] Create `fixtures/boundary-violations/packages/srd/src/bad.ts` importing `@the-stacks/dnd5e-engine`; confirm `pnpm check:boundaries` reports it flagged.
- [x] T006 [P] Write the schemas exactly as `contracts/records.md` in `packages/srd/src/schema/common.ts`, `monster.ts`, `spell.ts`, `class.ts`, `equipment.ts`, `condition.ts`, and re-export them from `packages/srd/src/schema/index.ts` with `RecordSchemas`, `SrdKind` and `SrdRecord`.
- [x] T007 [P] Write `packages/srd/src/attribution.ts` per `contracts/attribution.md`: `SRD_ATTRIBUTION` (exact text, U+201C/U+201D quotes), `SRD_CHANGE_NOTICE`, and `SRD_DATA_SOURCE` set to `null` until Phase 2 fills it. The module imports nothing.
- [x] T008 [P] Write `packages/srd/ATTRIBUTION.md` per `contracts/attribution.md` (statement, change notice; data-source line added in Phase 2). No other mention of Wizards.
- [x] T009 [P] Write `estimateTokens` in `packages/srd/src/tokens.ts` per `contracts/compact.md`.
- [x] T010 [P] Write `packages/srd/test/tokens.test.ts`: the golden table in `contracts/compact.md`, whitespace-only input is 0, repeated calls return equal values.
- [x] T011 [P] Write `packages/srd/test/attribution.test.ts` per `contracts/attribution.md`: file missing fails; statement absent or altered fails; the constant differs from the test's golden string fails; "Wizards" outside the statement fails.
- [x] T012 [P] Write `packages/srd/test/schema-fixtures.test.ts`: one minimal valid record per kind with neutral placeholder values (name "Fixture Monster", text "fixture"; no game prose of any origin), plus one invalid case per rule (unknown field rejected by `.strict()`, bad id, page 0, missing `source`). Real-data validation arrives in Phase 2 (T024).
- [x] T013 Create `packages/srd/src/index.ts` exporting schemas, `estimateTokens`, and attribution constants (loader exports land in Phase 3).
- [x] T014 Update `Dockerfile`: copy `packages/srd/package.json` beside `packages/shared/package.json` in both install stages; in the runtime stage copy `packages/srd/dist`, `packages/srd/data` and `packages/srd/ATTRIBUTION.md`. Confirm `docker build .` succeeds.
- [x] T015 Run `pnpm install && pnpm ci:check`. Green. Commit `TASK-0043: srd package scaffold, schemas, attribution, estimator`.

**Checkpoint**: the package builds, attribution is guarded, the boundary rule fires.

---

## Phase 2: Provenance index and converted data — US4 then US1 (one dispatch)

**Blocked on**: C1 and C3 recorded on the card. The steps below assume C1 = Candidate C
(Open5e). If C1 picks A or B, the orchestrator amends T018–T019 before dispatch.

**Goal**: the five data files exist, every record is traceable to a page of the official PDF,
and nothing outside SRD 5.2.1 is present.

**Independent Test**: `pnpm --filter @the-stacks/srd test` passes the provenance, source-ref
and whole-data schema tests.

- [x] T016 [US4] Fetch the PDF from `https://media.dndbeyond.com/compendium-images/srd/5.2/SRD_CC_v5.2.1.pdf` into a scratch directory outside the repo. Check its SHA-256 is `8974902d109d6e63672d7c490bde9ccf052410503d9cfa768237154fbc5e3d87`. On mismatch, STOP and report.
- [x] T017 [US4] Write `packages/srd/scripts/extract-index.mjs <pdf>`: run `pdftotext` per page; collect names and pages per kind (stat-block index plus embedded stat blocks in Magic Items, spell headers on pages 107–175, the 12 classes and their subclasses, Equipment-chapter items on pages 89–103, `[Condition]` entries); write `packages/srd/provenance/srd-5.2.1-index.json` per `data-model.md`. Run it and commit the output.
- [x] T018 [US1] Clone `https://github.com/open5e/open5e-api` into the scratch directory and check out one commit on `staging`; record its SHA. Read only `data/v2/wizards-of-the-coast/srd-2024/`.
- [x] T019 [US1] Write `packages/srd/scripts/convert-open5e.mjs <checkout-dir> <commit>`: join the srd-2024 files into our record shapes (`contracts/records.md`); parse monster `attack` and `save` from the action text, ignoring `CreatureActionAttack`; keep conditional damage clauses verbatim; keep one record per stat block; derive ids per `data-model.md`; set `source.page` and `source.section` from the index; validate every record with its schema; write `packages/srd/data/{monster,spell,class,equipment,condition}.json` and `packages/srd/provenance/source.json`. Fail on any record not in the index.
- [x] T020 [US4] Write `packages/srd/scripts/verify-against-pdf.mjs <pdf>`: check the SHA-256; for each record confirm its name and key numbers (monster AC, HP, CR; spell level and school; weapon damage dice; armor AC) appear on `source.page`; write `packages/srd/provenance/verification.json` as `{ pdfSha256, records: [{ kind, id, page, ok, missing: [] }] }`. Fix converter defects until zero records have `ok: false`. Never hand-edit a data file to pass.
- [x] T021 [US4] Fill `SRD_DATA_SOURCE` in `packages/srd/src/attribution.ts` and the data-source line in `packages/srd/ATTRIBUTION.md` from `provenance/source.json` (Open5e, repository URL, commit, "CC-BY-4.0").
- [x] T022 [P] [US4] Write `packages/srd/test/provenance.test.ts`: every record's normalized name is in the index for its kind; every page lies in the kind's range (`data-model.md`); per-kind counts equal index counts; the index's `pdfSha256` equals the constant; `verification.json` has zero `ok: false` and covers every record.
- [x] T023 [P] [US4] Write `packages/srd/test/source-ref.test.ts`: every shipped record has a valid `source` with `document: "SRD 5.2.1"`; a record copy with `source` deleted fails the schema (AC #6).
- [x] T024 [P] [US1] Write `packages/srd/test/schema.test.ts`: every shipped record validates; ids unique per kind; the `Attack Roll:` → `attack` and `Saving Throw: DC` → `save` rules; every `Spell.classes` id names a shipped class.
- [x] T025 Run `pnpm ci:check`. Green. Commit `TASK-0043: SRD 5.2.1 index, converted records, verification report`.

**Checkpoint**: AC #1 and AC #7 have their artifacts; AC #6's source-ref half is guarded.

---

## Phase 3: Loader and compact forms — US1 and US3 (one dispatch)

**Goal**: callers get typed records by id and name, and an at-most-120-token compact form.

**Independent Test**: `pnpm --filter @the-stacks/srd test` passes loader, tokens and compact
tests over all shipped data; quickstart step 3 prints the expected values.

- [x] T026 [US1] Write `packages/srd/src/loader.ts` per `contracts/loader.md`: `list`, `getById`, `getByName`, `normalizeName`, `SrdDataError`; read `../data/<kind>.json` relative to `import.meta.url` with `node:fs`; validate once per kind; cache arrays and the two maps; throw on duplicate id or normalized name.
- [x] T027 [P] [US1] Write `packages/srd/test/loader.test.ts`: one record per kind by id and by name; case, curly apostrophe and extra-space variants resolve; unknown id and name give `undefined`; "Shield" resolves per kind without crossing kinds; a temp data dir with one invalid record throws `SrdDataError` naming the id and path (inject the data directory through an internal, non-exported option).
- [x] T028 [US3] Write `toCompact` in `packages/srd/src/compact.ts` per `contracts/compact.md`, including the truncation rule, and export `compact(kind, idOrName)` from the loader.
- [x] T029 [P] [US3] Write `packages/srd/test/compact.test.ts`: every shipped record's compact form is at most 120 estimated tokens; log per-kind median and maximum; header and footer shape; deterministic; truncated forms end with `+<n> more`; one snapshot per kind (Goblin Warrior, Fire Bolt, Fighter, Longsword, Prone).
- [x] T030 Export the loader and compact API from `packages/srd/src/index.ts`.
- [x] T031 Run quickstart steps 1–4. Run `pnpm ci:check`. Green. Commit `TASK-0043: SRD loader and compact lookup forms`.

**Checkpoint**: AC #4 and AC #5 met.

---

## Phase 4: About page — US2 (one dispatch)

**Goal**: every signed-in user reaches the exact attribution in one click.

**Independent Test**: `pnpm --filter @the-stacks/web test` passes the new `/about` SSR case
and `no-dialog`.

- [ ] T032 [US2] Add `"@the-stacks/srd": "workspace:*"` to `apps/web/package.json` and `{ "path": "../../packages/srd" }` to `apps/web/tsconfig.json` references.
- [ ] T033 [US2] Create `apps/web/app/routes/about.tsx`: import `SRD_ATTRIBUTION`, `SRD_CHANGE_NOTICE` and `SRD_DATA_SOURCE` from `@the-stacks/srd/attribution` only; render a heading "About", the statement verbatim in its own block, the change notice, and the data source; use the existing page styling of `routes/settings.tsx`. No modal.
- [ ] T034 [US2] Add `route("about", "routes/about.tsx")` to `apps/web/app/routes.ts`.
- [ ] T035 [US2] In `apps/web/app/shell/shell.tsx`, add an "About" `NavLink` to `/about` in the footer block, visible to every role (Settings stays operator-only), with the same collapsed-sidebar label handling as Settings.
- [ ] T036 [P] [US2] Add a case to `apps/web/test/ssr.test.mjs`: the signed-in SSR HTML of `/about` contains the statement (React's HTML escaping applied) and contains no `<dialog`.
- [ ] T037 [US2] Confirm the client bundle holds no SRD data: after `pnpm --filter @the-stacks/web build`, `grep -rl "Goblin Warrior" apps/web/build/client` finds nothing.
- [ ] T038 [US2] Run the app in this worktree (`pnpm env:up`, `pnpm dev`), sign in as operator and as a player, open About from the shell, and take a Brave screenshot of each. Save them under the PR's evidence, not in the repo. Run `pnpm env:down`.
- [ ] T039 Run `pnpm ci:check`. Green. Commit `TASK-0043: About page shows the SRD 5.2.1 attribution`.

**Checkpoint**: AC #2 met.

---

## Phase 5: Close-out (one dispatch)

**Purpose**: prove the whole feature against the card and leave evidence for review.

- [ ] T040 Run every quickstart.md step. Record outputs (test counts, compact medians and maximums per kind, verification mismatch count) in `specs/027-srd-data/ci-evidence.txt`.
- [ ] T041 Spot-check five records per kind against the PDF pages they cite. Record kind, id, page and result in `specs/027-srd-data/ci-evidence.txt` (research.md R4 review layer).
- [ ] T042 Confirm `git grep -n "dnd-sourcebooks\|fixtures/private" -- packages/srd apps/web` returns nothing, and `git ls-files packages/srd | grep -i "\.pdf$"` returns nothing.
- [ ] T043 Map each card AC #1–#7 to its proving artifact in `specs/027-srd-data/ci-evidence.txt` (test file, data file or page).
- [ ] T044 List in `specs/027-srd-data/ci-evidence.txt` the wiki-pinned sources this branch changed (plan.md "Wiki re-grounding") for the sweep's post-merge re-ground.
- [ ] T045 Run `pnpm ci:check`. It MUST be green. Commit `TASK-0043: close-out evidence`.

---

## Dependencies and execution order

- Phase 1 has no dependency.
- Phase 2 depends on Phase 1 and on C1 and C3 being recorded on the card.
- Phase 3 depends on Phase 2 (its whole-data tests read the shipped data).
- Phase 4 depends on Phase 1 only. It may run before Phase 2 if C1 is still pending; then
  T033 renders `SRD_DATA_SOURCE` as absent, and Phase 2's T021 fills it.
- Phase 5 depends on all others.

Within a phase, tasks marked [P] touch different files and can run in either order.

## Implementation strategy

MVP is Phases 1–3: the engine and DM runtime get data, lookups and compact forms. Phase 4
completes the license duty and is required before merge (AC #2). Phase 5 is the merge gate.
One PR carries all five phases (one task, one PR).

## Deviations

- Phase 1 (T001): added `@types/node` ^22.20.4 to `packages/srd` devDependencies. The tests import `node:fs`, `node:path` and `node:url`. The version already exists in `apps/server`, so no new third-party package enters the repository. The plan's New dependencies table omits it.
- Phase 1 (T014): added `RUN pnpm --filter "@the-stacks/srd" run build` to the Dockerfile build stage. The existing server filter does not build `packages/srd`, so `COPY --from=build .../srd/dist` failed without it.
- Phase 1 (T014): committed `packages/srd/data/.gitkeep` so the Dockerfile `COPY` of `packages/srd/data` succeeds before Phase 2 fills the directory.
- Phase 2 (T017): the monster names and pages come from the PDF's "Index of Stat Blocks" (PDF pages 2–4), plus Giant Fly (page 222). Spell names come from `pdftotext -raw` order, because default order separates 18 titles from their headers. The class entries carry an extra `subclass` field `{ name, page }`. A superset of the `data-model.md` shape.
- Phase 2 (T017): the equipment index lists the items in the Equipment chapter's tables and entries: 38 weapons, 13 armor, 37 tools (including the four Gaming Set and ten Musical Instrument variants), 94 adventuring-gear entries (including ammunition, Arcane Focus, Druidic Focus, Holy Symbol, Potion of Healing and the two Spell Scrolls), and 24 mounts, tack, drawn vehicles and large vehicles. The category rows "Ammunition", "Arcane Focus", "Druidic Focus" and "Holy Symbol" and the service row "Stabling per day" are not items and are excluded.
- Phase 2 (T019): `convert-open5e.mjs` takes a third argument, the PDF path. It reads the PDF for what the dataset lacks or gets wrong: stat-block header lines (size, tags, alignment, AC, initiative, HP, speed, abilities, saves, skills, resistances, immunities, gear, senses, languages, CR, XP, lair XP, PB), legendary-action header text, all spell header fields (the dataset's casting times are coarse, for example "1minute" for 10-minute spells), and the whole Equipment chapter.
- Phase 2 (T019): equipment records come from the PDF tables and entries, not from the dataset. The dataset's equipment descriptions are not SRD text ("A longsword.", invented vehicle blurbs), and it lacks the arcane focuses, so shipping them would break AC #7.
- Phase 2 (T019): the dataset has defects. The converter repairs each one and records it under `repairs` in `provenance/source.json`: Awakened Tree "Slam" and Axe Beak "Beak" damage differ from the PDF (text taken from the PDF), Black Pudding's reaction is named "Parry" (renamed "Split" from its upstream key), and five class-feature names carry typos (Unarmoed Movement, Studdied Attacks, Magic Cunning, Cleric Subclasses, Improved Brutal Strike (Enhanced)); the Druid Wild Shape column is mislabeled "Cantrips Known". `verify-against-pdf.mjs` confirms every repaired name appears in the PDF.
- Phase 2 (T019): `MonsterAttack` parsing follows the dataset wording ("Melee Attack Roll: +4, reach 5 ft. 5 (1d6 + 2) Slashing damage ...", without the PDF's "Hit:" label). Roper's Tentacle deals no damage and has `hit: []`.
- Phase 2 (T019): `speed` drops form-specific walking and climbing speeds ("40 ft. (bear form only)") for the four lycanthropes, and sets both `climb` and `fly` for Swarm of Insects ("Climb or Fly 20 ft."). The schema holds one number per mode. The PDF prints one Young White Dragon save without its sign; the converter repairs it from the modifier.
- Phase 2 (T019): `acNote` is omitted. The dataset's `armor_detail` is wrong for at least one record (Goblin Warrior reads "natural armor") and the PDF prints no note.
- Phase 2 (T019): the `Text` fields turn the dataset's Markdown into plain text. Table rows become `a | b` lines under a `Table: <name>` line. Four spells (Augury, Confusion, Control Weather, Creation) carry their tables flattened onto one line upstream; the converter restores the rows.
- Phase 2 (T020): the verification covers more than the task lists. It also checks spell header fields and class lists, every damage expression, attack bonus and save DC in monster text, every number in monster, spell and class text, class feature and column names, and equipment cost, weight, damage and AC.
