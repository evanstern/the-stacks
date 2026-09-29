# Tasks: Rules answerer

**Input**: Design documents from `specs/018-rules-answerer/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/ask-sse.md,
contracts/answer.md, quickstart.md

**Tests**: required. The card's AC #4 and the spec's success criteria are test outcomes. Every
model call in a test goes through the gateway's `fake` adapter (`adapters: { fake: () => fake }`,
`fake.scriptChat(...)`); no network. DB suites MUST run (0 skipped) on this task's own stack.
Seed books with `storeParsedBook` / `attachEmbeddings` directly. Never enqueue ingestion jobs
in these tests: the worktree app's ingest worker can claim them (TASK-0033).

**No new runtime dependency.** `streamSSE` comes from `hono/streaming`, part of installed `hono`.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependencies)
- **[Story]**: user story (US1, US2, US3)

## Phase 1: Foundational — citation parser, quote verification, config

**Purpose**: the pure half of contracts/answer.md. Every story builds on it. No DB, no gateway.

- [ ] T001 Create `apps/server/src/library/cite.ts` with `locateQuote(passageText, quote)`
  per research R1 step 3: exact `indexOf` first; else a normalized match (collapse whitespace
  runs to one space; curly single/double quotes to straight; en/em dash to `-`; trim), using a
  per-character index map so the match maps back to original passage offsets. Return `null`
  when there is no match, or when the normalized quote is under 12 characters or under 3 words
  and is not the whole normalized passage. Matching is case-sensitive. First occurrence wins.
- [ ] T002 In `cite.ts`, implement `createCiteParser()` returning `{push, end}` per
  contracts/answer.md. Tokens: `text`, `cite {p, quote}`, `malformed`, `refuse`. Recognize
  `<cite p="N">…</cite>` and `<refuse/>` (tolerate `<refuse />`). Hold back any trailing
  fragment that could begin a marker, so a marker split across `push` calls parses the same as
  unsplit. An open `<cite` that exceeds 1000 characters, or is still open at `end()`, yields
  `malformed` and none of its text. A lone `<` that cannot start a marker is plain text.
- [ ] T003 Write `apps/server/test/library/cite.test.ts`: exact match offsets; whitespace
  drift (newline vs space, double spaces) repaired to the passage's own offsets; curly vs
  straight quotes repaired; a paraphrase returns `null`; a case change returns `null`; a quote
  of 2 words returns `null`, but the whole passage when it is short matches; first occurrence
  wins. Parser: a marker split at every possible character boundary of one fixed string yields
  identical tokens (loop over split points); unterminated marker at `end()` is `malformed`; an
  oversized marker is `malformed`; `<refuse/>` is `refuse`; plain `<` and `a < b` stay text.
- [ ] T004 Create `apps/server/src/library/answer.ts` with the constants and types from
  contracts/answer.md (`ANSWER_PURPOSE = "answering"`, `PROMPT_VERSION = "answer-v1"`,
  `QUESTION_MAX = 2000`, `AnswerConfig`, `AnswerDeps` incl. the optional `retrieve` seam,
  `AnswerRequest`, `AnswerEvent` union with `delta`, `citation`, `done`, `refusal`, `error`
  exactly as the payloads in contracts/ask-sse.md). Implement `loadAnswerConfig(env)`: Zod-parse
  `ASK_MIN_SIMILARITY` as a number 0..1, default `0.3`, with a `ponytail:` comment naming
  TASK-0029 as the calibration trigger; throw naming the variable on an invalid value.
  Implement `isRelevant(p, min)`: `p.fts !== null || (p.vector !== null && p.vector.score >= min)`.
- [ ] T005 [P] Add pure cases to a new `apps/server/test/library/answer.test.ts`:
  `loadAnswerConfig` default on an empty env; `-0.1`, `1.1`, `abc` each throw naming
  `ASK_MIN_SIMILARITY`; `isRelevant` for fts-only, vector above, at, and below the floor, and
  both-null.
- [ ] T006 Edit `apps/server/src/index.ts`: call `loadAnswerConfig(process.env)` once beside
  `loadRetrievalConfig`, so a bad value fails boot. Edit `.env.example`: add an "Answering (all
  optional)" block documenting `ASK_MIN_SIMILARITY` (range, default, what it gates) and that
  the answerer uses the `AI_PURPOSES` entry named `answering` (op `chat`).
- [ ] T007 Run `pnpm ci:check` in the worktree; it passes.

**Checkpoint**: quote verification and marker parsing proven without a model or database.

## Phase 2: User Story 1 — streamed answer with verified citations (Priority: P1) 🎯 MVP

**Goal**: `answer()` and `POST /library/ask` stream `delta`, verified `citation`, and `done`.

**Independent Test**: seed a synthetic book; script the fake chat to answer with one real quote
and one invented quote; the stream has exactly one citation whose span slices back to its
quote, and `done.dropped` is 1.

- [ ] T008 [US1] In `answer.ts`, build the prompt per research R6: a system prompt stating the
  `<cite p="N">exact words</cite>` syntax, "answer only from the passages", "say where they are
  silent", and "output `<refuse/>` if the passages do not answer the question", naming no game
  system; a user message of `<passage p="N" book="…" section="A › B">text</passage>` blocks,
  numbered from 1 over the relevant passages in retrieval order, then the question.
- [ ] T009 [US1] In `answer.ts`, implement `answer(deps, req)` as an async generator: validate
  the question (trim, 1..`QUESTION_MAX`, else throw `ValidationError` before any call); call
  `(deps.retrieve ?? retrieve)({db, gateway, config: deps.retrieval}, {question, signal})`;
  filter with `isRelevant`; stream `gateway.chat({purpose: ANSWER_PURPOSE, system, messages,
  signal})` through `createCiteParser`. For each `text` token yield `delta` (skip empty). For
  each `cite` token, resolve `p` to a passage, run `locateQuote`, and build the citation per
  data-model.md (quote sliced from the passage, book span = `anchor.start + offset`); assign
  `n` by first appearance of `(chunkId, start, end)`, reusing `n` for repeats. Count unknown
  `p`, failed `locateQuote`, and `malformed` as dropped. On chat `done` with ≥ 1 citation,
  yield `done {citations, dropped, passages, promptVersion}`. Log nothing containing question,
  passage, or answer text.
- [ ] T010 [US1] In `answer.test.ts`, test `answer()` with a stubbed `retrieve` (scripted
  `RetrievalResult` of 2–3 passages with fts signals) and a gateway built by `createGateway`
  over a `FakeProvider`: (a) one real quote + one invented quote → one `citation`, `done.dropped`
  1, and no `delta` contains `<cite`, `</cite>`, or `<refuse`; (b) a whitespace-drifted quote
  is emitted with the passage's exact words; (c) a marker split across three `text` events
  parses; (d) an unknown `p="9"` is dropped; (e) the same quote twice reuses `n`; (f) the
  chat request's purpose is `answering` and its user message numbers only relevant passages;
  (g) exactly one terminal event, last. For every emitted citation assert the three
  guarantees in contracts/ask-sse.md.
- [ ] T011 [US1] Edit `apps/server/src/routes/library.ts`: `CreateLibraryRoutesOptions` gains
  optional `answer?: Omit<AnswerDeps, "db">`. Add `POST /ask`: `requireOperator(c)`; parse the
  JSON body with Zod (`{question: string}`), mapping a parse failure or a bad question to
  `ValidationError` so it returns the 400 JSON before any stream opens; if `answer` deps are
  absent, the stream yields `error{config}`. Otherwise `return streamSSE(c, async (stream) =>
  …)`: create an `AbortController`, abort it in `stream.onAbort`, iterate `answer()`, and write
  each event as `{event: type, data: JSON.stringify(payloadWithoutType)}`. Validate the question
  before `streamSSE` so `answer()` never throws after the stream opens.
- [ ] T012 [US1] Edit `apps/server/src/app.ts`: `CreateAppOptions.library` gains optional
  `answer` deps, passed through to `createLibraryRoutes`. Edit `index.ts`: pass `{gateway:
  aiGateway, retrieval: retrievalConfig, config: answerConfig}`; remove the `biome-ignore`
  comment reserving `retrievalConfig` for TASK-0027.
- [ ] T013 [US1] Write `apps/server/test/library/ask.integration.test.ts` with the repo's
  loud-skip harness (copy the header from `retrieve.integration.test.ts`; `REQUIRE_DATABASE=1`
  throws on skip). Seed a synthetic book via `storeParsedBook` with original text and a per-test
  nonce word (research R7 there). Build the app with `createApp({…, library: {answer: {gateway,
  retrieval: {mode: "fts", k: 8, embedPurpose: "embedding"}, config: {minSimilarity: 0.3}}}})`
  over a scripted `FakeProvider`; sign in as operator via the real route (copy
  `signInCookie` from `uploads.integration.test.ts`). Add a small SSE reader that splits the
  body on blank lines into `{event, data}`. Case: real + hallucinated quote → content type
  `text/event-stream`, one `citation`, `done.dropped` 1, and the stored document text (read
  from `library_documents`) sliced by `citation.span` equals `citation.quote` (SC-001, SC-002).
- [ ] T014 [US1] Run `pnpm ci:check` and the DB suites (`REQUIRE_DATABASE=1`); green.

**Checkpoint**: card AC #1, #2, #4 have passing tests.

## Phase 3: User Story 2 — refuse when nothing is relevant (Priority: P1)

**Goal**: the three refusal reasons in contracts/ask-sse.md.

**Independent Test**: a question sharing no word with the library yields one
`refusal{nothing_relevant}` event and zero chat calls.

- [ ] T015 [US2] In `answer.ts`: when no passage is relevant, yield
  `refusal{reason:"nothing_relevant"}` and return before any `chat` call. When the parser yields
  `refuse`, or chat yields `error` of kind `refusal`, abort the chat call (a per-call
  `AbortController` chained to `req.signal`) and yield `refusal{model_declined}`. When chat ends
  `done` with zero verified citations, yield `refusal{unverified}`. Messages are fixed strings
  per reason (`nothing_relevant`: "The library has nothing relevant to this question.";
  `model_declined`: "The library passages found do not answer this question.";
  `unverified`: "No answer could be verified against the library.").
- [ ] T016 [US2] In `answer.test.ts`: empty retrieval → one refusal, `fake.chatCalls.length`
  0; passages all failing the floor (vector-only, score 0.1) → same; `<refuse/>` after some
  text → `refusal{model_declined}` last; chat `error{kind:"refusal"}` → `model_declined`; an
  answer with only invented quotes → `refusal{unverified}` and no `done`.
- [ ] T017 [US2] In `ask.integration.test.ts`: a question of words absent from the seeded book
  → one `refusal{nothing_relevant}` event, zero chat calls (SC-003). Add a `vector`-mode case:
  seed embeddings with `attachEmbeddings` using scripted vectors (as in
  `retrieve.integration.test.ts`) so the question's similarity to every chunk is below 0.3 →
  `nothing_relevant`; then one chunk above the floor → the model is called.

**Checkpoint**: card AC #3 has passing tests.

## Phase 4: User Story 3 — failures, auth, and cancellation (Priority: P2)

**Goal**: every non-happy terminal state is defined and tested.

**Independent Test**: a scripted mid-stream `error{upstream}` yields the text so far, then one
`error` event, then close.

- [ ] T018 [US3] In `answer.ts`: map chat `error{kind}` (not `refusal`, not `cancelled`) to
  `error{kind}` with a fixed message per kind (contracts/ask-sse.md table); wrap the
  `retrieve()` call so a throw yields `error{kind:"retrieval"}`; any other throw after the first
  yield becomes `error{kind:"internal"}`, logged with `console.error` (no question text). On
  `req.signal` abort, or chat `error{cancelled}`, return with no further yield.
- [ ] T019 [US3] In `answer.test.ts`: mid-stream `error{upstream}` → deltas then one `error`;
  an unconfigured purpose (gateway config without `answering`) → one `error{config}` and a
  `UsageRecord`-free sink; a throwing stubbed `retrieve` → `error{retrieval}`; aborting the
  signal mid-stream → no terminal event and the fake stops yielding.
- [ ] T020 [US3] In `ask.integration.test.ts`: no cookie → 401 JSON; player cookie → 403 JSON
  and zero chat calls (SC-005); `{}` body, `{"question":"  "}`, and a 2001-character question →
  400 JSON `validation`; a non-JSON body → 400; the route with no `answer` deps → one
  `error{config}` event.
- [ ] T021 [US3] Run `pnpm ci:check` and the DB suites (`REQUIRE_DATABASE=1`); green.

**Checkpoint**: all spec acceptance scenarios have passing tests.

## Phase 5: Polish, re-grounding, and gates

**Purpose**: the runbook's per-PR gates (`docs/design/m1-wave2-sweep-runbook.md`).

- [ ] T022 Merge `origin/main` into the branch (never rebase). Re-run T021 if anything merged.
- [ ] T023 Run the full gate with the database required on this worktree's stack (`pnpm env:up`
  first; `TEST_DATABASE_URL` from `.env`): `REQUIRE_DATABASE=1 pnpm ci:check`. The ask, retrieve,
  and store integration suites report 0 skipped. TASK-0033 caveat: if `worker.integration`
  flakes because the app container's ingest worker claimed a test job, record it and re-run;
  this task's own suites never enqueue jobs. No host-run script or host-imported module is
  added, so `check:host-scripts` is unchanged; state that in the PR body. Save the summary to
  `specs/018-rules-answerer/ci-evidence.txt`.
- [ ] T024 Wiki review with honest re-pins (`/grounding-wiki:wiki-update`). Classify each note
  whose sources changed as RE-PIN-ONLY or NEEDS-REVIEW against `git diff <old-pin>..HEAD --
  <sources>`; amend prose before bumping a NEEDS-REVIEW pin. Expected: `ai-gateway` (its
  `index.ts`/`.env.example` sources; `chat()` now has a caller), `server-entrypoint-and-app`
  (`index.ts`, `app.ts`), `retrieval` (`retrieve()` now called; `index.ts`), `ingestion`
  (`routes/library.ts`), `configuration` and `compose-stack` (`.env.example`), `overview`,
  `static-serving`.
- [ ] T025 Write a new note `docs/wiki/rules-answerer.md` (kind: component; sources:
  `apps/server/src/library/answer.ts`, `apps/server/src/library/cite.ts`,
  `apps/server/src/routes/library.ts`, `.env.example`) covering: the route and SSE events
  (link `specs/018-rules-answerer/contracts/ask-sse.md`), the relevance rule and
  `ASK_MIN_SIMILARITY`, the three refusal reasons, the cite-marker syntax and verification
  rule, the `answering` purpose, operator-only auth and why (constitution VIII), and the
  `answer()` agent seam. Pin it to HEAD. Add `[[rules-answerer]]` to `docs/wiki/INDEX.md`
  under Library and update INDEX's state line.
- [ ] T026 Regenerate `docs/wiki/CAPSULES.md`: `node
  ~/.claude/plugins/cache/praxisflux/grounding-wiki/0.65.3/scripts/capsules.mjs . docs/wiki`
  (a note was added; any changed `description:` must match).
- [ ] T027 Run `node ~/.claude/plugins/cache/praxisflux/grounding-wiki/0.65.3/gates/cli.mjs
  freshness . docs/wiki`. It must print `OK`. Never run `gates/freshness.mjs`.
- [ ] T028 Run `node ~/.claude/plugins/cache/praxisflux/spec-bridge/0.65.3/gates/cli.mjs check .`.
  It must exit 0. Tick this file's completed tasks.
- [ ] T029 Run `pnpm env:down`, then `pnpm env:prune --check`. The prune check must exit 0.

## Dependencies & Execution Order

- Phase 1 blocks everything. Within it: T001 → T002 (same file) → T003; T004 then T005;
  T006 after T004; T007 last.
- Phase 2 (US1) needs Phase 1. T008 → T009 → T010; T011 → T012 → T013; T014 last.
- Phase 3 (US2) needs Phase 2's `answer()` and test helpers.
- Phase 4 (US3) needs Phase 2; it may run beside Phase 3 only if one implementer owns
  `answer.ts` (both edit it). Default: run it after Phase 3.
- Phase 5 needs Phases 1–4.
- Dispatch: one implementer per phase, re-grounded from this spec dir and the branch commits.

## Parallel Examples

- Phase 1: T005 (tests) beside T006 (index.ts, .env.example) once T004 lands.
- Phase 2: T010 (pure tests) beside T011 (route) once T009 lands.

## Implementation Strategy

MVP is Phase 1 + Phase 2: a streamed, verified, cited answer. Phase 3 completes the card
(refusal). Phase 4 hardens the contract the UI (TASK-0028) renders. Phase 5 is the per-PR gate.
