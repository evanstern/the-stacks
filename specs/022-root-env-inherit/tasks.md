# Tasks: Root .env inheritance

**Input**: Design documents from `/specs/022-root-env-inherit/`

**Prerequisites**: plan.md, spec.md, research.md, contracts/env-cli.md, quickstart.md

**Tests**: required. `scripts/env-lib.test.mjs` covers the merge inside `pnpm ci:check`.
`pnpm check:env` covers Docker end to end, locally.

**Standing rules for every phase**:
- Run `cd /Users/evanstern/projects/the-stacks/.worktrees/task-0034 && pwd && git branch --show-current` first. Expect `task-0034-root-env-inherit`. On any other branch, STOP.
- NEVER read, print, or copy a value from `/Users/evanstern/projects/the-stacks/.env`. List key names only (`cut -d= -f1`). Tests use synthetic fixtures.
- Add no dependency. Change no file under `apps/`.
- Never use the backlog MCP tools. Use the `backlog` CLI inside the worktree for any card change.
- Commit per phase with a `TASK-0034:` subject and the Co-Authored-By trailer. Run `git pull --no-rebase`, then push. Never rebase, amend, or force-push.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependencies)
- **[Story]**: user story from spec.md (US1–US4)

## Phase 1: Merge seam (US1, US2, US3)

- [x] T001 [US2] In `scripts/env-lib.mjs`, export `DERIVED_KEYS = ["APP_PORT", "DB_PORT", "STACKS_ENV", "TEST_DB_PORT", "TEST_DATABASE_URL"]` (research R5).
- [x] T002 [US1] Extend `mergeEnvFile(exampleText, existingText, derived, sharedText)`. Parse `sharedText ?? ""` with `parseEnvKeys` and drop every `DERIVED_KEYS` key. Per example key, pick derived, then shared, then existing, then the example default. Append keys absent from the example in this order: derived, shared, existing; write each key once. Copy values verbatim. Add a `ponytail:` comment naming two ceilings: no multi-line values (upgrade: extend `parseEnvKeys`), no per-worktree override (upgrade: a `.env.local` layer between derived and shared, research R2). Update the JSDoc.
- [x] T003 [US1] In `scripts/env-lib.test.mjs`, add cases with synthetic fixtures only: (a) shared beats existing for an example key; (b) shared supplies a key absent from example and existing; (c) all five `DERIVED_KEYS` in shared never reach the output, including `TEST_DATABASE_URL` when `derived` lacks it (env:main shape); (d) `sharedText` undefined and `""` both give output identical to the three-argument call; (e) a JSON value with `=`, `{`, `:`, and `"` round-trips verbatim; (f) a key in both shared and existing, absent from example, appears exactly once with shared's value. Keep the two existing cases green unchanged.

## Phase 2: Wiring, output, contract (US1, US3)

- [x] T004 [US1] In `scripts/env.mjs` `writeEnvFile`, read `path.join(rootToplevel(toplevel), ".env")` when it exists and pass its text as `sharedText`. Leave `env:main`'s path through `runUp` unchanged, so it inherits (research R4). Never write that file.
- [x] T005 [US3] In `runUp`, after `writeEnvFile`, print `inherited from <root .env path>: <KEY, KEY>` listing shared key names minus `DERIVED_KEYS`. Print nothing when the list is empty. Never print a value. Have `writeEnvFile` return the names so `runUp` does not re-parse.
- [x] T006 [P] [US3] Fold contracts/env-cli.md's section into `specs/010-worktree-stacks/contracts/env-cli.md` under "`.env` keys written by `up`", with a line citing spec 022.
- [x] T007 [US3] In `scripts/env.test.mjs`, replace `assert.match(envText, …)` with a check whose failure message cannot contain `.env` text (for example `assert.ok(envText.includes(expected), "TEST_DATABASE_URL does not name testDbPort")`). The self-test worktree inherits the real root `.env`, so a failure message must never dump the file. Add one assertion: `up.stdout` names inherited keys only when a root `.env` exists; assert on key names, never values.

## Phase 3: Documentation, verification, re-grounding, cleanup (US4)

- [x] T008 [P] [US4] In `.env.example`, add a header paragraph: secrets and shared config (API keys, `AI_PROVIDERS`, `AI_PURPOSES`, `AI_PRICES`) live in the root checkout's `.env`; `pnpm env:up` copies every non-derived key into the worktree `.env`; root wins; derived keys stay per worktree; rerun `env:up` after changing root. Add one line under the AI gateway block pointing at that header.
- [x] T009 Run `pnpm ci:check` in the worktree. Expect exit 0.
- [x] T010 Run `pnpm check:env` with Docker up. It self-skips when any other labeled stack runs; record a skip with its reason rather than stopping other stacks. When it runs, expect all cases pass.
- [x] T011 Wiki re-pin with `/grounding-wiki:wiki-update`: `runtime-stacks` (the shared layer, the precedence, `env:main` inherits, names-only output, the `POSTGRES_PASSWORD` volume caveat) and `configuration` (where secrets and shared keys live; the root `.env`). Re-verify `ai-gateway`, `compose-stack`, `retrieval`, and `rules-answerer` only if the plan step flags them (they cite `.env.example`). Regenerate `docs/wiki/CAPSULES.md` if any `description:` changed.
- [x] T012 Run `node ~/.claude/plugins/cache/praxisflux/grounding-wiki/0.65.3/gates/cli.mjs freshness . docs/wiki`. Expect `OK`.
- [x] T013 Run `node ~/.claude/plugins/cache/praxisflux/spec-bridge/0.65.3/gates/cli.mjs check .`. Expect exit 0.
- [x] T014 Run `pnpm env:down` if this worktree's stack is up, then `pnpm env:prune --check`. Expect exit 0 from both.

## Dependencies

Phase 1 → Phase 2 → Phase 3. T006 and T008 are independent of code and may run early.
