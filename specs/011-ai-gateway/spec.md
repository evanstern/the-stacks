# Feature Specification: AI Gateway — First Slice

**Feature Branch**: `task-0023-ai-gateway`

**Created**: 2026-09-28

**Status**: Draft

**Input**: User description: "AI gateway first slice (TASK-0023, architecture A7, decision-0002). One internal provider interface covering streaming chat and embeddings. Anthropic implements chat; an OpenAI-compatible HTTP endpoint implements embeddings at a fixed 1024 dimensions, and each embedding result carries its model and dim. Model choice per feature is configuration, not code. Every call records token usage and computed cost. Tests use a fake provider and never need a network key."

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

### User Story 3 - Choose models per purpose by configuration (Priority: P2)

The operator sets which model serves each purpose (for example a cheap model for extraction,
a strong model for answering) through configuration, without code changes.

**Why this priority**: A7 requires per-feature model selection; benchmarks (TASK-0029) need to
swap embedding models without code edits.

**Independent Test**: Start the gateway with two purposes mapped to different fake model
names; each purpose's call reports its own model.

**Acceptance Scenarios**:

1. **Given** two purposes mapped to two models, **When** each is called, **Then** each call uses and reports its own model.
2. **Given** a configuration with a malformed purpose mapping, **When** the server starts, **Then** startup fails with an error naming the bad entry.

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

### User Story 5 - Test without network keys (Priority: P1)

A developer or CI run exercises every gateway path using a fake provider that returns scripted
output, with no network access and no API key present.

**Why this priority**: The project's CI has no model keys; every later M1 task tests through this.

**Independent Test**: Run the gateway test suite with all provider keys unset and no network;
all tests pass.

**Acceptance Scenarios**:

1. **Given** no provider keys in the environment, **When** the test suite runs, **Then** every gateway test passes.
2. **Given** the real providers, **When** their request/response translation is tested, **Then** it is tested against recorded or constructed payloads, not live calls.

### Edge Cases

- Provider rate-limits or returns a server error: the error surfaces to the caller with its kind; this slice adds no retry policy beyond what the provider library already does.
- Provider key missing for a configured real provider: startup succeeds only if no purpose routes to that provider; otherwise startup fails naming the missing key.
- A stream produces no text: the caller receives zero text pieces and a usage summary.
- An embedding batch larger than the provider's per-request limit: the gateway splits it and preserves input order.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The gateway MUST expose one interface with two operations: streaming chat and batch embeddings.
- **FR-002**: Every call MUST name a purpose; the gateway resolves the purpose to a provider and model from configuration.
- **FR-003**: Streaming chat MUST deliver text incrementally, then one final usage summary, and MUST support caller cancellation.
- **FR-004**: Embeddings MUST return one vector per input, in input order, each of length exactly 1024, each labeled with model and dimension.
- **FR-005**: The gateway MUST reject any embedding result whose length is not 1024.
- **FR-006**: A chat provider backed by Anthropic and an embeddings provider backed by any OpenAI-compatible endpoint MUST exist behind the interface.
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
- **Provider**: A backend implementing chat, embeddings, or both (Anthropic, OpenAI-compatible, fake).
- **Usage record**: One per call — purpose, provider, model, token counts, cost or unknown, duration, outcome.
- **Price table**: Per-model input and output price, configured by the operator.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A downstream feature can obtain a streamed answer and a set of embeddings using one interface and no provider-specific code.
- **SC-002**: Switching the model for any purpose requires changing configuration only; zero source files change.
- **SC-003**: 100% of gateway calls in the test suite emit exactly one usage record.
- **SC-004**: The full gateway test suite passes with no network access and no provider keys set.
- **SC-005**: 100% of embeddings returned to callers have dimension 1024 and carry their model label.

## Assumptions

- Cost is recorded per call, not per campaign; campaigns do not exist until M2. Per-campaign attribution is added then.
- Usage records are emitted to the server log and an in-process sink for this slice. A persistent usage table is deferred so this task does not touch migrations while TASK-0022 owns that hotspot.
- Prompt-template versioning and agent tool loops are out of scope (A7's later slices).
- Retries and backoff beyond the provider client's defaults are out of scope.
- Voyage is reached through its OpenAI-compatible embeddings interface, per decision-0002; no Voyage-specific client.
- Prices are operator-supplied configuration; the gateway ships no hardcoded prices.
