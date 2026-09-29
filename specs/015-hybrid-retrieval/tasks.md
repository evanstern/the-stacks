# Tasks: Hybrid retrieval

**Input**: Design documents from `/specs/015-hybrid-retrieval/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/retrieval.md

**Tests**: required. The spec's success criteria are test outcomes. Integration suites MUST run
(0 skipped) against a real pgvector database on this task's own stack. Every model call in a
test goes through the gateway's `fake` adapter; no network.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependencies)
- **[Story]**: user story (US1, US2, US3)

## Phase 1: Foundational — contract types, config, fusion

**Purpose**: the pure (no-DB) half of contracts/retrieval.md that every story builds on.

- [x] T001 Create `apps/server/src/library/retrieve.ts` with the exported types from
  contracts/retrieval.md exactly (`RetrievalMode`, `RetrievalConfig`, `RetrieveDeps`,
  `RetrieveRequest`, `PassageAnchor`, `SearchSignal`, `RetrievedPassage`, `RetrievalResult`),
  the constants `RRF_K = 60` and `CANDIDATES = 50` (each with a `ponytail:` comment naming
  TASK-0029 as the upgrade trigger; research R1, R7), and a header comment citing the contract.
  Import `Gateway` as a type only from `../ai/gateway.js` and `DbClient` from `./store.js`.
- [x] T002 In `retrieve.ts`, implement `loadRetrievalConfig(env = process.env)`: Zod-parse
  `RETRIEVAL_MODE` (enum, default `hybrid`), `RETRIEVAL_K` (coerced integer 1..50, default 8),
  `RETRIEVAL_EMBED_PURPOSE` (non-empty string, default `embedding`). On failure throw an
  `Error` naming the variable and the allowed values. Do not read `AI_PURPOSES` (research R5).
- [x] T003 In `retrieve.ts`, implement `fuseRrf({vector, fts}, rrfK = RRF_K)`: score
  `Σ 1/(rrfK + rank)` with 1-based ranks, one entry per distinct chunk id, sorted score desc
  then chunk id ascending (contract invariant 9).
- [x] T004 [P] Write `apps/server/test/library/retrieve.test.ts` (no DB): config defaults on an
  empty env; each invalid value (`RETRIEVAL_MODE=bogus`, `RETRIEVAL_K=0`, `51`, `abc`,
  `RETRIEVAL_EMBED_PURPOSE=""`) throws naming its variable; `fuseRrf` matches scores computed by
  hand for a fixed pair of lists (SC-004), dedupes a shared id, keeps single-list ids, orders
  equal scores by id, and returns identical output on a second call (SC-005).
- [x] T005 Edit `apps/server/src/index.ts`: call `loadRetrievalConfig(process.env)` once after
  `loadAiConfig`, so an invalid value fails boot (FR-004). Keep the result in a `const` with a
  `biome-ignore lint/correctness/noUnusedVariables` comment reserving it for TASK-0027, the
  same pattern as `aiGateway`.
- [x] T006 [P] Edit `.env.example`: add a "Retrieval (all optional)" block documenting the three
  `RETRIEVAL_*` variables, their values and defaults, and that `RETRIEVAL_EMBED_PURPOSE` must
  name the same `AI_PURPOSES` entry ingestion embeds with.
- [x] T007 Run `pnpm ci:check` in the worktree; it passes.

**Checkpoint**: contract types compile; config and fusion are proven without a database.

## Phase 2: User Story 1 — ask a question, get cited passages back (Priority: P1) 🎯 MVP

**Goal**: `retrieve` returns anchored passages. The MVP runs in `fts` mode, which needs no model.

**Independent Test**: store a synthetic book; ask a question naming a word in one passage; that
passage comes back first and its span slices back to its text.

- [x] T008 [US1] Write `apps/server/test/library/retrieve.integration.test.ts` with the repo's
  loud-skip harness (copy the header from `store.integration.test.ts`: `TEST_DATABASE_URL ||
  DATABASE_URL`, `probeReachable`, `REQUIRE_DATABASE=1` throws). Build a helper that stores a
  small synthetic `ParsedBook` (original text written in the test, each block with correct
  anchors) through `storeParsedBook`, embedding a per-test nonce word so results are isolated
  from other suites (research R9). US1 cases in `fts` mode: the nonce-word passage ranks first;
  every returned passage has `book`, `path`, `kind`, `text`, `start`, `end`, and
  `documentText.slice(start, end) === text` (SC-001, invariant 3); a question matching nothing
  returns `passages: []`; a question with `& | ! ( ) : * '` does not throw (invariant 7); a
  stop-word-only question returns `[]`; `EXPLAIN` of the keyword query with
  `enable_seqscan = off` names `library_chunks_tsv_idx`.
- [x] T009 [US1] Add to `retrieve.test.ts` (no DB): empty or whitespace `question`, `k = 0`,
  `k = 51`, and an unknown request `mode` each throw `ValidationError` before any db or gateway
  call. Inject a db double and a gateway double that fail the test if touched (invariant 1).
- [x] T010 [US1] Implement in `retrieve.ts`: request validation (Zod, `ValidationError` via the
  same `zodIssues` shape `store.ts` uses), and the keyword search per research R2 — one query
  joining `library_chunks` to `library_documents`, query
  `replace(plainto_tsquery('english', $q)::text, ' & ', ' | ')::tsquery`, `tsv @@ query`,
  `ts_rank_cd` desc then id asc, `LIMIT CANDIDATES`. Wire `retrieve` for `mode = "fts"`:
  zero gateway calls, `embeddingModel: null`, `candidates: {vector: null, fts: n}`, passages
  truncated to `k` with `rank`, `score` (the fts score), `fts` signal, `vector: null`
  (invariants 4, 10). Make T008 and T009 pass.

**Checkpoint**: keyword retrieval returns cited passages; no model involved.

## Phase 3: User Story 2 — choose the retrieval mode by configuration (Priority: P1)

**Goal**: `vector` mode works through the gateway, and mode/k come from config or per request.

**Independent Test**: the same question under `fts` and `vector`, set by config and by
override, returns results from the right search and makes the right number of embed calls.

- [x] T011 [US2] Add to `retrieve.integration.test.ts`: build the gateway with
  `createGateway({config, sink: memorySink(), adapters: {fake: () => fake}})` where `config`
  declares a `fake`-kind provider and an `embed` purpose with a per-test model name, and `fake`
  is a `FakeProvider` the test holds. Attach vectors under that model with `attachEmbeddings`,
  plus a decoy vector under a second model equal to the question vector. Cases: `vector` mode
  scripts `fake.scriptEmbed({vectors: [q]})` and returns the nearest chunk first, never a chunk
  whose only vector is the decoy model's (invariant 5, US2 AC3); `fake.embedCalls.length` is
  1 in `vector` mode and 0 in `fts` mode (SC-003); config `mode: "fts"` with request
  `mode: "vector"` runs vector, and a request `k` overrides config `k` (US2 AC4, SC-002); an
  unknown embed purpose throws an `Error` naming `RETRIEVAL_EMBED_PURPOSE` with the gateway
  error as `cause`, and runs no search (invariant 6); `EXPLAIN` of the vector query, with
  `enable_seqscan`, `enable_bitmapscan`, and `enable_sort` off, names
  `library_embeddings_embedding_idx`.
- [x] T012 [US2] Implement the vector search in `retrieve.ts` per research R3 and R4: call
  `deps.gateway.embed({purpose: config.embedPurpose, texts: [question], signal})` once; take
  `vectors[0].model`; in one transaction `SET LOCAL hnsw.iterative_scan = strict_order` and
  `SET LOCAL hnsw.ef_search = 100`, then select chunks joined to documents
  `WHERE e.model = $model ORDER BY e.embedding <=> $vec, c.id LIMIT CANDIDATES`, score
  `1 - distance`. Wrap an embed failure per invariant 6. Resolve `mode` and `k` from request
  then config. Wire `mode = "vector"`. Make T011 pass.

**Checkpoint**: all single-search modes selectable; model filter proven.

## Phase 4: User Story 3 — hybrid fuses both lists (Priority: P1)

**Goal**: `hybrid` runs both searches and orders by `fuseRrf`.

**Independent Test**: a chunk found by both searches outranks single-list chunks; single-list
chunks still appear; the order matches `fuseRrf` computed from the two candidate lists.

- [x] T013 [US3] Add to `retrieve.integration.test.ts`: arrange chunk A matched by both keyword
  (nonce word) and vector (scripted nearest), chunk B by keyword only, chunk C by vector only.
  In `hybrid`: A ranks first; B and C both appear; each appears once (invariant 8); every
  passage's `vector`/`fts` signals are set or `null` correctly and `score` equals the RRF score
  (US3 AC4); two runs return identical results (SC-005). With no vectors stored for the
  question's model, hybrid returns keyword results and `candidates.vector === 0` (research R6).
- [x] T014 [US3] Implement `mode = "hybrid"` in `retrieve.ts`: run both searches (the keyword
  query may run concurrently with the embed call), fuse their id lists with `fuseRrf`, truncate
  to `k`, and attach both signals from the candidate lists. Make T013 pass.

**Checkpoint**: card ACs #1–#3 all demonstrated by tests.

## Phase 5: Polish and gates

- [x] T015 Run the full gate with the database required on this worktree's stack
  (`pnpm env:up` first): `REQUIRE_DATABASE=1 pnpm ci:check`. The retrieval and store
  integration suites report 0 skipped. Save the summary to
  `specs/015-hybrid-retrieval/ci-evidence.txt`.
- [x] T016 Wiki: add `docs/wiki/retrieval.md` (sources: `apps/server/src/library/retrieve.ts`,
  `apps/server/src/index.ts`, `.env.example`) describing modes, RRF k = 60, OR-semantics keyword
  query, iterative scan, the model filter, and the TASK-0024 embedding obligation. Review
  `library-schema` (its "retrieval out of scope" note now points at `[[retrieval]]`) and
  `configuration` (new `RETRIEVAL_*` variables) against this branch's diff; amend where the
  text changed; re-pin honestly. Also review `ai-gateway` and `server-entrypoint-and-app`
  because `index.ts` and `.env.example` are among their sources. Add `[[retrieval]]` to
  `docs/wiki/INDEX.md` under Library, and update INDEX's "state of the codebase" line.
  Regenerate `docs/wiki/CAPSULES.md` because a note was added and any changed `description:`
  must match.
- [x] T017 Freshness: `node ~/.claude/plugins/cache/praxisflux/grounding-wiki/0.65.3/gates/cli.mjs freshness . docs/wiki`
  prints `OK`.
- [x] T018 `pnpm env:down`; `pnpm env:prune --check` exits 0.
- [ ] T019 After merge: tick this file and run `spec-bridge:sync`.

## Dependencies & Execution Order

- Phase 1 blocks everything.
- US1 (Phase 2) blocks US2 and US3: they reuse its validation, row mapping, and test helpers.
- US2 (Phase 3) blocks US3 (Phase 4): hybrid needs the vector search.
- Phase 5 after Phases 2–4.
- Within Phase 1: T004 and T006 can run beside T001–T003 once T001 fixes the types.

## Parallel Opportunities

- T004 (unit tests) and T006 (`.env.example`) touch different files from T002/T003.
- The stories are sequential by design: each adds one search path to the same module.

## Implementation Strategy

MVP = Phases 1–2: keyword retrieval with citable anchors, no model needed. Phase 3 adds the
model-backed path; Phase 4 adds fusion. One implementer per phase, re-grounded from this spec
dir and the branch's commits. The contract (contracts/retrieval.md) is binding from the first
commit, so TASK-0027 and TASK-0029 can build against it before Phase 2 lands.
