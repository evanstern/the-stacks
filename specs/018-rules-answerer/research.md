# Research: Rules answerer

Each entry: Decision, Rationale, Alternatives considered. Direction from decision-0004 (SSE from
an HTTP route) and decision-0007 (gateway, named purposes, no vendor SDK) is taken as given.

## R1 — Citations: inline markers, verified against the stored passage text

**Decision.**

1. The model receives the relevant passages numbered `p="1"`…`p="n"`. It is told to state each
   claim in its own words, then append a marker `<cite p="N">exact words copied from passage N</cite>`
   that holds only the supporting quote, and nothing else in that syntax.
2. A streaming parser (`apps/server/src/library/cite.ts`) splits the model's text into plain
   text and markers. It holds back a trailing fragment that could be the start of `<cite` or
   `<refuse`, so a marker split across two streamed pieces is still recognized. Text inside a
   marker is never emitted as answer text.
3. Each marker is verified before it is emitted. Verification is a pure function
   `locateQuote(passageText, quote)`:
   - **Exact**: `passageText.indexOf(quote)`. First occurrence wins.
   - **Normalized** (repair): if exact fails, compare normalized forms. Normalization collapses
     every whitespace run to one space, maps curly single and double quotes to straight ones,
     maps en and em dashes to `-`, and trims. Both strings are normalized with a per-character
     index map back to the original. A normalized match maps back to the original passage
     offsets. This is the only repair: the emitted quote is always the passage's own text
     sliced by those offsets, never the model's text.
   - **Reject**: no match; an unknown or non-numeric `p`; an unterminated marker (stream ended,
     or more than 1000 characters without `</cite>`); a normalized quote under 12 characters
     or under 3 words, unless it equals the whole normalized passage. Case must match. An
     ellipsis that elides text cannot match a contiguous span and is rejected.
4. The book span is `anchor.start + offsetInPassage`. This is exact because retrieval invariant 3
   guarantees `documentText.slice(anchor.start, anchor.end) === passage.text`, and the passage
   text is the stored chunk text read in this request. No second read is needed.
5. A rejected marker is dropped silently from the stream and counted in `done.dropped`. The
   claim text around it still streams. Identical verified spans share one citation number.

**Rationale.** Constitution V requires an exact quote span; A9 says every answer is verifiable.
The model can invent or paraphrase quotes, so trust comes only from string-matching against
stored text. Repairing only whitespace and typography recovers the common harmless drift
(models re-flow line breaks and "smarten" quotes) while never emitting words the book does not
contain. XML-like tags are the syntax chat models follow most reliably, and `</cite>` does not
occur in rulebook prose.

**Alternatives considered.**
- *Provider-native citations / structured output.* Not available through the
  `openai-compatible` adapter; decision-0007 defers native kinds until a feature needs them.
  The inline scheme works on every provider.
- *Model returns JSON at the end.* Breaks streaming (answer text would arrive in one lump).
- *Fuzzy matching (edit distance).* Would emit spans the model did not quote; harder to explain
  and to test. Rejected: a dropped citation is safer than a wrong one.
- *Cite the whole passage, no quote.* Fails "exact quote span" (card AC #2).
- *Drop the whole sentence around a bad citation.* Needs sentence segmentation; the dropped
  count in `done` lets the UI flag the answer instead. `ponytail:` claim-level coverage is not
  checked; add a coverage rule when evals show uncited claims matter.

## R2 — Relevance rule and refusal

**Decision.** A retrieved passage is **relevant** when either:
- its keyword signal is present (`passage.fts !== null`): the question's terms literally occur in
  it; or
- its vector signal meets the floor (`passage.vector.score >= ASK_MIN_SIMILARITY`).

If no passage is relevant, the answerer emits `refusal{reason:"nothing_relevant"}` and never
calls the model. Only relevant passages go to the model, in retrieval order. Two further
backstops end in a refusal after the model runs:
- `model_declined`: the model is told to output `<refuse/>` when the passages do not answer the
  question. On seeing it, the answerer cancels the model call and emits the refusal. A gateway
  `error` of kind `refusal` (the provider refused) maps to the same reason.
- `unverified`: the model finished but zero citations survived R1. An answer with no verified
  source is not shown as rules truth.

`ASK_MIN_SIMILARITY` is an optional env var, a number in [0, 1], default `0.3`, parsed by
`loadAnswerConfig(env)` and validated at boot beside `loadRetrievalConfig`.

**Rationale.** Retrieval applies no threshold (contract, "Obligations": TASK-0027 judges from
`passages.length` and the per-search signals). Vector search always returns its nearest rows,
however far, so a vector-only hit needs a floor. A keyword hit is lexical evidence. It can be
weak under OR semantics, which is why the model-side `model_declined` and `unverified` backstops
exist. Two cheap independent checks beat one tuned threshold. The rule is per-signal, so it
works in all three retrieval modes: `fts` mode uses only the first clause, `vector` only the
second.

**Default 0.3.** Cosine similarity between unrelated texts under current general embedding
models sits well below this, and related texts above it. It is deliberately permissive,
because the model backstops catch false positives, while a false negative silently refuses a
good question. `ponytail:` the floor is a guess; calibrate it from TASK-0029's benchmark
(refusal precision and recall per model) and change the default by config.

**Alternatives considered.**
- *Threshold on the RRF score.* RRF scores are rank-derived and carry no absolute meaning.
- *Threshold on `ts_rank_cd`.* Unnormalized; depends on passage length.
- *A model-graded relevance pass before answering.* One extra model call per question for a
  judgment the answering call already makes (`<refuse/>`).
- *No floor, rely on the model only.* Would call the model on every question, including ones
  the library plainly does not cover, which breaks SC-003 and the card's "refuse" AC.

## R3 — Purpose name: `answering`

**Decision.** The answerer calls `gateway.chat({purpose: "answering", …})`. The name is a code
constant `ANSWER_PURPOSE = "answering"`, not an env var.

**Rationale.** `.env.example`'s `AI_PURPOSES` example already names `answering` (TASK-0023). A7
says per-feature model selection happens by purpose: the operator maps `answering` to any
provider and model in `AI_PURPOSES`, so an env var naming the purpose would add indirection with
no new capability. Retrieval's embed purpose is configurable only because ingestion and
retrieval must agree on it; nothing else shares this one. If `answering` is not configured, the
gateway fails before any provider call and the stream ends with `error{kind:"config"}`.

**Alternatives considered.** `ASK_PURPOSE` env var (YAGNI; add when a second answering profile
is needed). Names `rules`, `chat` (less specific; `answering` is already documented).

## R4 — Who may ask: operator only

**Decision.** `POST /library/ask` requires an operator session. No session → 401
`unauthorized`; a player → 403 `forbidden`. This is the same `requireOperator` check the other
`/library` routes use.

**Rationale.** Constitution VIII (NON-NEGOTIABLE): "Generated output MUST NOT reproduce book text
beyond quoted citations shown to the operator who supplied that book." Architecture A9's
licensing posture says the same. Upload is operator-only (spec 017), and the install is single
tenant, so every book was supplied by the operator. Vision item 1 frames the story as "As a DM,
I ask a rules question". Player-facing rules lookups arrive in M6 as session events
(decision-0004's revisit clause) and would need a constitution amendment on VIII first.

**Status.** Settled by existing artifacts. Not an operator checkpoint. Opening the route to
players is a constitution amendment, not a spec decision.

## R5 — Streaming mechanics

**Decision.**
- Write the stream with Hono's `streamSSE` from `hono/streaming`, part of the installed `hono`
  package. **No new runtime dependency.**
- Auth and body validation run before the stream opens, so those failures are the standard JSON
  error contract (status 400/401/403). Everything after the stream opens is an event.
- One `AbortController` per request is aborted when the client disconnects (`stream.onAbort`).
  Its signal goes to `retrieve()` and `gateway.chat()`. After abort, nothing more is written.
- The route is a thin adapter over `answer(deps, req): AsyncIterable<AnswerEvent>`. The route
  writes each event as `event: <type>` plus `data: <json>`. An agent calls `answer()` directly
  and gets the same sequence (constitution I).
- Error events carry a fixed message per kind. Provider messages and exception text are logged
  server-side, never sent, matching the error contract's internal-error policy.
- The request is one question, no history. A UI conversation is a sequence of independent asks.

**Alternatives considered.** Hand-rolled `ReadableStream` (more code for the same bytes);
the WebSocket gateway (ruled out by decision-0004); `GET` with a query string for `EventSource`
compatibility (puts the question in URLs and logs; `fetch` streaming is the UI's reader).

## R6 — Prompt and versioning

**Decision.** A system prompt states the citation syntax, the `<refuse/>` rule, "answer only from
the passages", and "say where the passages are silent". The user message holds the passages as
`<passage p="N" book="…" section="A › B">text</passage>` followed by the question. The prompt has a
constant `PROMPT_VERSION = "answer-v1"`, reported in `done` (A7: prompt-template versioning).
The prompt names no game system (constitution VI).

## R7 — Tests use the fake provider; seed chunks directly

**Decision.** Every test builds the gateway with `adapters: { fake: () => fake }` and scripts
`fake.scriptChat(...)`. Scripts cover: a real quote plus a hallucinated quote (proves R1 drops it),
a whitespace-drifted quote (proves repair), a marker split across events, `<refuse/>`, no
citations, a mid-stream `error` event, and an unconfigured purpose. Integration tests seed
books with `storeParsedBook` (and `attachEmbeddings` with scripted vectors for the vector-floor
case). They never enqueue ingestion jobs: the worktree app's ingest worker can claim jobs from
the shared table (TASK-0033). DB suites run on the task's own stack with `REQUIRE_DATABASE=1`.

## R8 — Dependencies

No new runtime dependency. `hono/streaming` ships in `hono` ^4.13; `zod`, `drizzle-orm`, and the
gateway are installed. No migration: the answerer reads through `retrieve()` and writes nothing.
