# Feature Specification: AI Gateway — First Slice

**Feature Branch**: `task-0023-ai-gateway`

**Created**: 2026-09-28

**Status**: Draft

**Input**: User description: "AI gateway first slice (TASK-0023, architecture A7, decision-0002, decision-0007). One internal provider interface covering streaming chat and embeddings. Providers are named configuration entries; an OpenAI-compatible adapter serves both operations. Embeddings are a fixed 1024 dimensions, each labeled with model and dim. Model choice per purpose is configuration, not code. Every call records token usage and computed cost. Tests use a fake provider and never need a network key."

**Revised 2026-09-28** per operator ruling decision-0007: the gateway is fully provider-agnostic. No vendor SDK, no privileged provider name.

## User Scenarios & Testing *(mandatory)*

The "users" of this slice are the server features that will call a model (the rules-answerer
in TASK-0027, ingestion in TASK-0024, benchmarks in TASK-0029) and the operator who configures
and pays for those calls.

### User Story 1 - Stream a chat answer through one interface (Priority: P1)

A server feature asks the gateway for a chat completion for a named purpose (for example
"answering") and receives the answer as a stream of text pieces, followed by a final summary
of how many tokens the call used.

**Why this priority**: Streaming answers are the M1 demo surface (TASK-0027, TASK-0028).
Nothing downstream can be built without it.

**Independent Test**: With the fake provider configured, request a chat for purpose
"answering"; the caller receives the fake's scripted text in order, then a usage summary.

**Acceptance Scenarios**:

1. **Given** the gateway configured with a chat provider, **When** a feature requests a chat for a configured purpose, **Then** it receives text pieces in order and one final usage summary.
2. **Given** a request for a purpose with no configured model, **When** the feature calls the gateway, **Then** the call fails immediately with a configuration error naming the purpose.
3. **Given** the provider fails mid-stream, **When** the caller is reading the stream, **Then** the stream ends with an error the caller can distinguish from normal completion.
4. **Given** the caller abandons the stream early, **When** it cancels, **Then** the upstream request is cancelled and no further text is delivered.

---

### User Story 2 - Embed text with model and dimension attached (Priority: P1)

A server feature sends a batch of texts to the gateway and receives one vector per text,
each exactly 1024 numbers long, each labeled with the model that produced it and its dimension.

**Why this priority**: Ingestion (TASK-0024) and retrieval (TASK-0026) need embeddings;
decision-0002 requires every stored vector to carry its model and dimension.

**Independent Test**: With the fake provider, embed three texts; receive three 1024-length
vectors labeled with the fake model name and dimension 1024.

**Acceptance Scenarios**:

1. **Given** an embeddings provider, **When** a feature embeds N texts, **Then** it receives N vectors in input order, each of length 1024, each labeled with model and dimension.
2. **Given** a provider returns vectors of any other length, **When** the gateway receives them, **Then** the call fails with an error naming the expected and actual dimension; no vector is returned.
3. **Given** an empty batch, **When** a feature embeds it, **Then** the gateway returns an empty result without calling the provider.

---

### User Story 3 - Name providers and choose models per purpose by configuration (Priority: P1)

The operator declares providers by name (for example a hosted service and a local model
server), each with an adapter kind, a base URL, and the name of the environment variable
holding its key. The operator then maps each purpose to a named provider and a model. No
provider name, vendor, or key variable is built into the code.

**Why this priority**: decision-0007 makes provider neutrality a requirement; benchmarks
(TASK-0029) swap providers and models without code edits; a self-hoster's local model must be
a config entry (constitution IX).

**Independent Test**: Declare two fake providers under arbitrary names, map two purposes to
them with different models; each call reports its own provider name and model.

**Acceptance Scenarios**:

1. **Given** two purposes mapped to two named providers and models, **When** each is called, **Then** each call uses and reports its own provider name and model.
2. **Given** a purpose naming a provider that is not declared, **When** the server starts, **Then** startup fails naming the purpose and the missing provider.
3. **Given** a purpose whose operation (chat or embeddings) its provider's kind does not support, **When** the server starts, **Then** startup fails naming both.
4. **Given** a provider whose declared key variable is unset, **When** a purpose uses that provider, **Then** startup fails naming the variable; an unused provider does not fail startup.

---

### User Story 4 - Record tokens and cost for every call (Priority: P2)

Every chat and embedding call produces a usage record: purpose, provider, model, input and
output tokens, computed cost, duration, and outcome. The operator can see what each call cost.

**Why this priority**: A7 requires cost accounting; the benchmarks (TASK-0029) report
embedding cost per configuration.

**Independent Test**: Make one chat and one embedding call against the fake; two usage
records are emitted with token counts matching the fake's and cost computed from the
configured price table.

**Acceptance Scenarios**:

1. **Given** a completed call, **When** it finishes, **Then** exactly one usage record is emitted with tokens and cost.
2. **Given** a failed or cancelled call, **When** it ends, **Then** a usage record is still emitted with its outcome and whatever tokens were reported.
3. **Given** a model with no configured price, **When** a call completes, **Then** the record carries tokens and marks cost as unknown rather than zero.

---

### User Story 5 - Survive transient provider failures (Priority: P2)

When a provider answers with a rate limit or a server error before any output has been
delivered, the gateway retries a bounded number of times with growing delays, then surfaces a
typed error.

**Why this priority**: every downstream feature would otherwise reimplement retry; a vendor
SDK used to provide it and was rejected (decision-0007).

**Independent Test**: A fetch double returns 429 twice then succeeds; the caller sees one
successful result and one usage record.

**Acceptance Scenarios**:

1. **Given** a 429 or 5xx response before any output, **When** retries remain, **Then** the gateway waits (honoring a `Retry-After` header when present) and retries.
2. **Given** retries are exhausted, **When** the last attempt fails, **Then** the caller receives an error of kind `rate_limit` or `upstream`.
3. **Given** a 400, 401, or 403, **When** it is received, **Then** the gateway does not retry and surfaces `config` or `auth`.
4. **Given** a stream has already delivered text, **When** it fails, **Then** the gateway does not retry; the stream ends with an error event.
5. **Given** the caller cancels during a backoff wait, **When** it aborts, **Then** no further attempt is made.

---

### User Story 6 - Test without network keys (Priority: P1)

A developer or CI run exercises every gateway path using a fake provider that returns scripted
output, with no network access and no API key present.

**Why this priority**: The project's CI has no model keys; every later M1 task tests through this.

**Independent Test**: Run the gateway test suite with all provider keys unset and no network;
all tests pass.

**Acceptance Scenarios**:

1. **Given** no provider keys in the environment, **When** the test suite runs, **Then** every gateway test passes.
2. **Given** the real providers, **When** their request/response translation is tested, **Then** it is tested against recorded or constructed payloads, not live calls.

### Edge Cases

- Provider rate-limits or returns a server error: bounded retry (US5), then a typed error.
- A provider's SSE stream is malformed or ends without a usage chunk: the stream ends with an `upstream` error; usage is recorded with whatever counts were seen, or zero.
- A local provider needs no key: `apiKeyEnv` is omitted and no authorization header is sent.
- A stream produces no text: the caller receives zero text pieces and a usage summary.
- An embedding batch larger than the provider's per-request limit: the gateway splits it and preserves input order.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The gateway MUST expose one interface with two operations: streaming chat and batch embeddings.
- **FR-002**: Every call MUST name a purpose; the gateway resolves the purpose to a provider and model from configuration.
- **FR-003**: Streaming chat MUST deliver text incrementally, then one final usage summary, and MUST support caller cancellation.
- **FR-004**: Embeddings MUST return one vector per input, in input order, each of length exactly 1024, each labeled with model and dimension.
- **FR-005**: The gateway MUST reject any embedding result whose length is not 1024.
- **FR-006**: Providers MUST be named configuration entries, each with an adapter kind, a base URL, and optionally the name of the environment variable holding its key. The code MUST NOT hard-code any provider name, vendor, or key variable.
- **FR-006a**: An `openai-compatible` adapter MUST serve both streaming chat and embeddings over plain HTTP, with no vendor SDK. A `fake` adapter MUST serve both for tests.
- **FR-006b**: Startup MUST validate that every purpose names a declared provider whose kind supports the purpose's operation.
- **FR-012**: The gateway MUST retry 429 and 5xx responses received before any output, a bounded number of times with growing delays, honoring `Retry-After`; it MUST NOT retry other 4xx responses or a stream that has already delivered output.
- **FR-007**: Every call MUST emit one usage record: purpose, provider, model, input tokens, output tokens, cost (or unknown), duration, outcome.
- **FR-008**: Cost MUST be computed from a configured price table per model; an unpriced model yields unknown cost, never zero.
- **FR-009**: A fake provider MUST exist that scripts chat text, usage, embeddings, and failures, for use by all tests.
- **FR-010**: Configuration errors (unknown purpose, missing key for a used provider, malformed mapping) MUST fail fast with an error naming the problem.
- **FR-011**: The gateway MUST NOT log prompt or completion text in usage records.

### Constitution-Driven Requirements *(mandatory)*

- **CR-001** (I. Agent-operable): Agents (TASK-0027 onward) MUST reach models only through this gateway interface — the same one every human-facing feature uses. The gateway is itself the agent-facing seam; it has no human-only path.
- **CR-003** (V. Citations): The gateway MUST NOT alter or drop content a caller supplies for citation; citation enforcement belongs to the rules-answerer (TASK-0027).
- **CR-005** (VIII. Operator-owned content): The gateway MUST send library text only to providers the operator configured, and MUST NOT persist prompt or completion text.

CR-002 (content contract) and CR-004 (system-agnostic) do not apply: this slice creates no codex entity and touches no game mechanics.

### Key Entities

- **Purpose**: A named use of a model (for example "answering", "extraction", "embedding"). Maps to one provider and one model.
- **Provider**: A named configuration entry — adapter kind (`openai-compatible` or `fake` this slice), base URL, optional key variable name. Serves chat, embeddings, or both, as its kind allows.
- **Usage record**: One per call — purpose, provider name, model, token counts, cost or unknown, duration, outcome.
- **Price table**: Per provider-and-model input and output price, configured by the operator.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A downstream feature can obtain a streamed answer and a set of embeddings using one interface and no provider-specific code.
- **SC-002**: Switching the provider or model for any purpose, or adding a new OpenAI-compatible provider, requires changing configuration only; zero source files change.
- **SC-003**: 100% of gateway calls in the test suite emit exactly one usage record.
- **SC-004**: The full gateway test suite passes with no network access and no provider keys set.
- **SC-005**: 100% of embeddings returned to callers have dimension 1024 and carry their model label.

## Assumptions

- Cost is recorded per call, not per campaign; campaigns do not exist until M2. Per-campaign attribution is added then.
- Usage records are emitted to the server log and an in-process sink for this slice. A persistent usage table is deferred so this task does not touch migrations while TASK-0022 owns that hotspot.
- Prompt-template versioning and agent tool loops are out of scope (A7's later slices).
- Retry covers only the request before output starts; mid-stream resumption is out of scope.
- Any vendor is reached through its OpenAI-compatible interface this slice. A native adapter kind (for example `anthropic`) can be added later behind the same Provider interface without changing callers.
- Prices are operator-supplied configuration; the gateway ships no hardcoded prices.
