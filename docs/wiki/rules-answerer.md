---
name: rules-answerer
description: POST /library/ask (specs/018-rules-answerer) — the SSE contract, citation-marker parsing and quote verification, the relevance rule and ASK_MIN_SIMILARITY, the three refusal reasons, operator-only auth, and cancellation. Load for any "how does the rules answerer / chat / /library/ask" question.
kind: component
sources:
  - apps/server/src/library/answer.ts
  - apps/server/src/library/cite.ts
  - apps/server/src/routes/library.ts
  - .env.example
verified_against: 7a36c9e9e90450f473fc5e54a082d0ce7c083727
---

# Rules answerer

`POST /library/ask` (contracts/ask-sse.md) turns a question into a streamed, cited answer:
[[retrieval]] finds passages, the model answers only from them, and every claim it cites is
verified against the stored text before being shown. `apps/server/src/library/answer.ts`'s
`answer()` is the pure async-generator core; `routes/library.ts`'s `POST /ask` handler is a
thin SSE adapter over it.

## How it works

**Auth**: operator-only (constitution VIII/A9 — a player never queries the rules directly).
`requireOperator(c)` runs before the stream opens: no session throws `UnauthorizedError`
(401), a non-operator role throws `ForbiddenError` (403) — both the standard JSON
`{error:{kind,message}}` shape ([[error-contract]]), not SSE. Body validation (`question`
1-2000 characters after trimming, `QUESTION_MAX`) also runs before the stream opens and fails
the same way (400 `validation`). Only once auth and validation pass does the handler call
`streamSSE` — everything after that point is an SSE event, never a JSON error response.

**Relevance and `ASK_MIN_SIMILARITY`**: `answer()` calls `retrieve()` ([[retrieval]]) with the
boot-time config, no per-call override, then filters `result.passages` with `isRelevant(p,
minSimilarity)`: a passage is relevant if it has any `fts` hit (keyword search carries no
similarity score, so it always counts) or its `vector.score >= minSimilarity`. `minSimilarity`
is `ASK_MIN_SIMILARITY` (`.env.example`, "Answering" section), Zod-coerced to a number 0-1,
default `0.3`, loaded by `loadAnswerConfig(env)` and validated at boot by `index.ts` alongside
[[retrieval]]'s own config (see [[configuration]], [[server-entrypoint-and-app]]). No relevant
passage means `refusal{reason:"nothing_relevant"}` — the model is never called.

**The `answering` purpose**: `answer()` calls `deps.gateway.chat({purpose: ANSWER_PURPOSE,
...})` where `ANSWER_PURPOSE = "answering"` is a fixed code constant, not an env var (research
R3) — map it to any provider/model via `AI_PURPOSES` (see [[ai-gateway]]). An unconfigured
purpose surfaces as `chat()`'s own `{type:"error", kind:"config"}` event, mapped straight to a
terminal SSE `error` event, never a boot-time or route-time crash.

**Citation markers and verification** (`cite.ts`, research R1, pure — no I/O): the model is
instructed (system prompt) to state each claim in prose, then mark citations as `<cite p="N">exact quote</cite>` (the cite holds only the supporting quote) against the
1-based index of the numbered passage list it was given, and to emit exactly `<refuse/>` (and
nothing else) if the passages don't answer the question. `createCiteParser()` is an
incremental parser: `push(text)` splits streamed text into `{type: "text"|"cite"|"malformed"|
"refuse"}` tokens, holding back any trailing fragment that could still become a marker so a
`<cite ...>`/`<refuse/>` split across any number of chunks parses identically to unsplit;
`end()` flushes the buffer, emitting `malformed` for an open marker that never closed.
`verifyCitation()` resolves `p` to `relevant[p-1]` (an out-of-range or non-numeric `p` drops
the citation) and calls `locateQuote(passage.text, quote)`: exact substring match first,
otherwise a normalized match (whitespace runs collapsed to one space, curly quotes and en/em
dashes mapped to straight ASCII, each output character keeping a span back to the original
string) — rejecting a too-short quote (under 12 characters or 3 words) unless it is the whole
passage, and rejecting no match at all. A dropped citation (unresolvable `p`, unverifiable
quote, or a `malformed` token) increments `dropped` and emits nothing; it is not an error and
does not end the stream. Citations are deduplicated by `${chunkId}:${span.start}:${span.end}`
— a repeated span reuses its original `n` (first-appearance order) rather than incrementing.

**Refusal rules** (`RefusalReason`, terminal, `reason` + fixed display-safe `message`):
`nothing_relevant` (no passage cleared the relevance rule — model never called), `model_declined`
(a `<refuse/>` marker, or the model's stream itself reports `{kind:"refusal"}` — provider-level
refusal), `unverified` (the model answered but every citation was dropped, so
`citationsByKey.size === 0` at `done`). On any refusal, `answer()` yields nothing more; the
contract requires the UI discard already-received `delta` text, since it is an unverified claim
attached to no surviving citation.

**Error kinds** (`AnswerErrorKind`, terminal, fixed `message` per kind): `config` (purpose
unconfigured or its key missing — also the value `routes/library.ts` sends when the whole
`library.answer` wiring is absent, i.e. no `answer` deps at app-construction time),
`auth`, `rate_limit`, `upstream` (all three passed through unchanged from `chat()`'s own
`{type:"error"}` event kinds), `retrieval` (a thrown `retrieve()` call, caught and mapped —
[[retrieval]]), `internal` (anything else). Only genuine bugs or a failed `retrieve()`/`chat()`
call reach `error`; a caught exception is logged server-side only, never in `message`.

**Cancellation**: `routes/library.ts` wires `stream.onAbort()` to an `AbortController` passed
as `answer()`'s `req.signal`; `answer()` chains a second, per-call controller to it so a
`<refuse/>` marker can abort just the in-flight `chat()` call independently of the caller's
own cancellation. Closing the connection cancels the model call and the server writes nothing
more — there is no terminal event for a cancelled stream, matching `chat()`'s own
`{kind:"cancelled"}` event, which `answer()` returns on without yielding anything.

**The SSE contract** (contracts/ask-sse.md, decision-0004; binds the chat UI, TASK-0028):
grammar `(delta | citation)* terminal`, exactly one terminal event (`done`, `refusal`, or
`error`) per stream, events in answer order — a `citation` arrives directly after the claim it
supports. `done` reports `{citations, dropped, passages, promptVersion}` (`PROMPT_VERSION =
"answer-v1"`, a code constant bumped when the prompt template changes, for reproducing a past
answer). A `citation` event carries enough to render and highlight the source inline with no
second request: `quote`/`span` (whole-book UTF-16 offsets), the full `passage.text`/`passage.span`/
`passage.kind`, and `quoteInPassage` (offsets of `quote` within `passage.text`) — guaranteed
`passage.text.slice(quoteInPassage.start, quoteInPassage.end) === quote`.

## Connections

Reads via [[retrieval]]'s `retrieve()` (its first HTTP caller); answers via [[ai-gateway]]'s
`chat()` under the `"answering"` purpose (its second caller, after [[ingestion]]'s `embed()`).
Config validated at boot by [[server-entrypoint-and-app]]'s `index.ts` alongside
[[configuration]]'s `loadConfig` and [[retrieval]]'s own config; wired into `createApp` as
`library.answer` ([[server-entrypoint-and-app]]). Errors before the stream opens use
[[error-contract]]'s JSON shape; auth follows the same operator/player role split as
`/library`'s upload and job routes ([[ingestion]]). Storage it reads from is
[[library-schema]]'s `library_chunks`, by way of [[retrieval]].

## Operational notes

`ASK_MIN_SIMILARITY` unset defaults to `0.3`; an out-of-range or non-numeric value throws at
boot, same failure mode as a bad `RETRIEVAL_*` value. A player session gets 403 on `/ask`, not
a refusal or error event — the distinction matters for the UI: 403 is a JSON response with no
stream at all. `dropped > 0` at `done` is not a failure; it means the model cited something
that couldn't be verified and the server silently removed it rather than showing an unverified
claim.
