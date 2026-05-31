# Session Agent Chat Graph Plan

## Goal

Evolve Ask Ikis from a single-turn grounded QA endpoint into a durable, session-based chat agent that can run a small graph/loop over user intent, retrieval, evidence evaluation, answer synthesis, citation validation, and persistence while preserving the existing grounded-citation contract.

The target end state is an actual agent for each chat session: a graph-driven loop that can inspect prior turns, decide whether to retrieve/refine/clarify/answer, call auditable corpus tools, and persist both the user-visible transcript and the internal step trace.

## Current State

- `app/routes/chat.tsx` is a thin UI/action boundary. It loads transcript state by `conversationId`, posts `{ corpusId, conversationId, question }`, and renders answer/source previews.
- `app/lib/conversations/grounded.server.ts` is the current turn orchestrator:
  - get or create conversation;
  - persist user message;
  - build grounded retrieval context;
  - call configured grounded answer provider;
  - validate citations;
  - persist assistant message;
  - persist retrieval run and cited-only citations;
  - return source previews.
- `app/lib/conversations/grounded-answer.server.ts` owns the provider boundary, prompt versioning, citation extraction/validation, no-evidence behavior, fake provider, and OpenAI-compatible provider.
- `app/lib/retrieval/context.ts` builds bounded evidence records from approved/indexed chunks with stable ordinals for citations.
- `app/lib/retrieval/lexical.ts` remains the retrieval baseline.
- `app/lib/conversations/repository.ts` is the persistence API for conversations, messages, retrieval runs, citations, and workflow runs.
- `app/lib/workflows/*` and `docs/langgraph-boundary.md` define the existing optional sidecar posture for LangGraph-style work:
  - SQLite/libSQL remains canonical;
  - sidecars use IDs, summaries, metadata, and deterministic thread IDs;
  - content-heavy corpus state does not become opaque graph-only state.
- `workflow_runs` already exists and can be used as an initial graph thread/step tracking bridge.
- There are no `Fabrique` references in this repo; the comparable local pattern is the optional workflow sidecar boundary.

## Target Behavior

Ask Ikis chat should become session-oriented rather than purely request-oriented.

For a user question like `can my goblin boss do X?`, the agent should be able to:

1. Load or create a durable chat session linked to the existing conversation.
2. Classify the turn intent, such as monster lookup, rules reference, adventure prep, comparison, or unclear request.
3. Decide which corpus search or session-memory tool to call.
4. Retrieve evidence from approved/indexed chunks.
5. Evaluate whether the evidence is sufficient, too broad, contradictory, or missing an obvious adjacent concept.
6. Optionally refine and retry retrieval within a bounded loop.
7. Ask a clarifying question instead of fabricating an answer when the user request is underspecified.
8. Synthesize a cited answer only from accepted evidence.
9. Validate citations against the evidence ordinals before presenting the answer as grounded.
10. Persist both the user-facing transcript and the graph trace.
11. Preserve source preview links and retrieval trace inspectability.

## Non-Goals

- Do not weaken the grounded-citation contract.
- Do not let the LLM browse SQLite or raw corpus tables directly.
- Do not move canonical conversation, message, retrieval, citation, or corpus storage into opaque graph checkpoints.
- Do not require LangGraph for the app to run in local/self-hosted mode.
- Do not build a broad autonomous research agent before reproducing the current grounded answer path in graph form.
- Do not add embeddings/vector search as part of the initial graph/session pivot.
- Do not introduce external telemetry or content-sharing behavior.
- Do not bundle copyrighted game corpus data; this remains a BYO private source-material system.

## Design Principles

### 1. Keep SQLite Canonical

The app's existing data model remains the source of truth:

- conversations;
- messages;
- retrieval runs;
- citations;
- sources/documents/chunks;
- review decisions;
- workflow/session trace records.

Graph checkpoints, if used, are resumability aids, not canonical product data.

Expected result: the chat UI, retrieval trace UI, and source preview routes continue to work from persisted relational data rather than graph internals.

### 2. Treat Graph Execution As A Turn Engine

The graph should replace the orchestration inside `answerGroundedQuestion()` over time, not the whole data model.

Near-term seam:

- keep `app/routes/chat.tsx` thin;
- create a graph/session runner under `app/lib/conversations/agent/` or `app/lib/chat-agent/`;
- have `askGroundedQuestion()` delegate to the runner behind a feature flag;
- preserve the `GroundedConversationTurn` return contract until the UI is ready for richer agent trace data.

Expected result: `/chat` can switch from direct grounded QA to graph-backed sessions without a frontend rewrite.

### 3. Split Agent Reasoning From Grounded Answer Validation

The agent may loop, classify, refine, and decide. The final answer still goes through the same validation gate:

- supplied evidence records get stable citation ordinals;
- answer text must cite bracket markers like `[1]`;
- citation markers must correspond to supplied evidence;
- unsupported or uncited model output downgrades to explicit insufficient evidence;
- persisted citations are created only for cited evidence records.

Expected result: agentic behavior improves retrieval and interaction quality without allowing uncited claims.

### 4. Make Tools Narrow And Auditable

The agent should call explicit internal tools rather than direct database operations.

Initial tools:

```ts
type SearchCorpusTool = (input: {
  corpusId: string;
  query: string;
  candidateLimit?: number;
  maxContextRecords?: number;
}) => GroundedRetrievalContext;

type SynthesizeGroundedAnswerTool = (input: {
  question: string;
  evidence: GroundedEvidenceRecord[];
}) => Promise<GroundedAnswerResult>;

type LoadSessionTranscriptTool = (input: {
  conversationId: string;
}) => ConversationTranscript;
```

Later tools:

- `get_chunk(chunkId)`;
- `get_source_preview(citationId)`;
- `summarize_recent_session_facts(conversationId)`;
- `write_session_note(...)`;
- `compare_evidence_sets(...)`;
- `build_monster_reference(...)`.

Expected result: every model-mediated action is inspectable, testable, and replaceable.

## Session State Model

Define a graph state shape that is explicit enough for deterministic tests and persistence.

Initial state:

```ts
type ChatAgentState = {
  sessionId: string;
  conversationId: string;
  corpusId: string;
  userMessageId: string;
  question: string;
  messages: Array<{ role: "user" | "assistant" | "system"; content: string }>;
  intent: "corpus_lookup" | "rules_reference" | "comparison" | "prep" | "clarification_needed" | "unknown" | null;
  retrievalAttempts: Array<{
    query: string;
    trace: unknown;
    evidenceOrdinals: number[];
    noEvidenceReason?: string;
  }>;
  selectedEvidence: GroundedEvidenceRecord[];
  answerDraft: string | null;
  validation: {
    accepted: boolean;
    noEvidence: boolean;
    reason: string | null;
    citedOrdinals: number[];
  } | null;
  status: "running" | "waiting_for_user" | "completed" | "failed";
  loopCount: number;
  errors: Array<{ node: string; message: string }>;
};
```

Persisted state should avoid storing large duplicate corpus text unless needed for replay. Retrieval runs already persist selected context in `modelInputs.context`; agent steps can store summaries, IDs, trace metadata, and hashes.

Expected result: graph state can be resumed and audited without duplicating the whole corpus into agent memory.

## Graph Shape

Initial graph:

```text
receive_user_message
  -> classify_intent
  -> plan_retrieval
  -> retrieve_evidence
  -> evaluate_evidence
  -> route_decision
      -> refine_query -> retrieve_evidence
      -> ask_clarifying_question -> persist_waiting_turn -> end
      -> synthesize_answer -> validate_answer -> persist_completed_turn -> end
      -> persist_no_evidence_turn -> end
```

### Node Responsibilities

#### `receive_user_message`

- Get or create conversation/session.
- Persist the user message before tool/model work begins.
- Initialize graph state with corpus/conversation/session IDs.

Acceptance:

- User message exists even if later graph steps fail.
- Empty questions are rejected before graph execution.

#### `classify_intent`

- Classify the turn into a small set of modes.
- Keep classification cheap and deterministic where possible.
- Initial implementation may be rules-based or fake-provider-backed for tests.

Acceptance:

- Common monster/rules questions route to `corpus_lookup` or `rules_reference`.
- Ambiguous requests can route to `clarification_needed`.

#### `plan_retrieval`

- Turn user intent into one or more search queries.
- Strip conversational filler such as `tell me about`.
- Carry session context only when it changes retrieval meaning.

Acceptance:

- `tell me about goblins` produces a noun-focused query that can retrieve goblin evidence.
- Follow-up questions can reference previous topic once session memory is added.

#### `retrieve_evidence`

- Call the existing `buildGroundedRetrievalContext()` tool.
- Append attempt metadata to graph state.
- Do not call the answer provider here.

Acceptance:

- Retrieval attempts are persisted or later visible in agent trace.
- No direct corpus DB calls occur inside model prompts.

#### `evaluate_evidence`

- Decide whether evidence is sufficient, missing, too broad, or likely needs query refinement.
- Use deterministic heuristics first:
  - evidence count;
  - no-evidence classification;
  - repeated chunk/source diversity;
  - strong noun overlap;
  - max loop count.
- Optionally use a model evaluator later.

Acceptance:

- The graph can retry retrieval at most a bounded number of times.
- The graph exits to no-evidence or clarification rather than looping indefinitely.

#### `refine_query`

- Generate a narrower or broader query from the previous attempt.
- Keep refinements inspectable in state.
- Avoid speculative expansion into unrelated game systems.

Acceptance:

- Refinement improves retrieval for broad/underspecified queries in tests.
- Max loop count prevents runaway behavior.

#### `synthesize_answer`

- Call the existing grounded answer provider with selected evidence.
- Preserve the evidence-only prompt contract.

Acceptance:

- Tests can run with deterministic fake provider.
- Real provider is only used when configured.

#### `validate_answer`

- Reuse `validateGroundedAnswer()`.
- Reject unknown or missing citations.
- Decide whether to persist final answer or no-evidence fallback.

Acceptance:

- All existing citation validation tests still pass.
- Cited-only persistence remains exact.

#### `persist_completed_turn`

- Persist assistant message.
- Persist retrieval run with graph/session metadata.
- Persist citations for cited evidence only.
- Persist workflow/agent step trace.

Acceptance:

- Existing `SourcePreview` contract remains intact.
- Retrieval trace still resolves from the assistant message/retrieval run.

#### `ask_clarifying_question`

- Persist an assistant message that asks one clear question.
- Mark session/graph state as `waiting_for_user`.
- Do not create citations unless the clarifying question cites evidence.

Acceptance:

- Ambiguous questions do not produce fake grounded answers.
- Next user turn can resume the same conversation/session.

## Persistence Plan

### Phase 1: Reuse Existing Persistence

Use current tables first:

- `conversations` remains the user-visible session/thread.
- `messages` stores user and assistant messages.
- `retrieval_runs` stores selected evidence context and final answer metadata.
- `citations` stores cited source records.
- `workflow_runs` stores graph/session execution metadata.

Add metadata fields inside existing JSON columns before adding tables:

- message metadata: `agentSessionId`, `agentStatus`, `intent`, `validation`;
- retrieval run modelInputs: `agentGraphVersion`, `agentStepIds`, `retrievalAttempts`, `routeDecision`;
- workflow run metadata: deterministic `threadId`, graph name/version, node summaries, linked conversation/message/retrieval IDs.

Acceptance:

- No migration is required for the first graph-backed prototype unless existing JSON columns are insufficient.

### Phase 2: Add Agent Tables If Needed

If `workflow_runs` becomes too coarse, add explicit tables:

```sql
agent_sessions(
  id,
  conversation_id,
  corpus_id,
  status,
  mode,
  graph_version,
  thread_id,
  created_at,
  updated_at
)

agent_steps(
  id,
  session_id,
  node_name,
  status,
  input_summary_json,
  output_summary_json,
  tool_calls_json,
  error_json,
  started_at,
  finished_at
)
```

Only add this once the graph trace UI or debugging needs exceed `workflow_runs`.

Acceptance:

- New tables link to existing conversations/messages/retrieval runs.
- Source previews and retrieval traces do not depend on graph checkpoint internals.

## Implementation Phases

### Phase 0: Plan Review And Boundary Lock

- Review this plan against `docs/langgraph-boundary.md`.
- Confirm whether to use actual LangGraph immediately or implement a local graph-like runner first.
- Confirm feature flag name, likely `IKIS_CHAT_AGENT_ENABLED` or reuse an existing LangGraph enable flag only if semantically correct.

Acceptance:

- Momus approves plan or all blocking ambiguities are resolved.
- The chosen feature flag and storage posture are explicit.

QA:

- Review: run Momus against `/home/coda/projects/the-stacks/hostable-corpus-workspace-langgraph/.omo/plans/session-agent-chat-graph.md`; expect `[OKAY]` or only non-blocking suggestions.
- Static check: read `docs/langgraph-boundary.md`, `app/lib/workflows/boundary.ts`, and `app/lib/conversations/grounded.server.ts`; expect the implementation slice to preserve SQLite canonical storage and the existing `GroundedConversationTurn` API.
- Config check: inspect `.env.example` or startup env handling if adding a flag; expect a documented default where chat remains functional with the agent disabled.

### Phase 1: Extract Current Turn Into A Graph-Compatible Runner

- Add `app/lib/conversations/agent/` module.
- Define `ChatAgentState` and `ChatAgentTurnResult`.
- Implement a deterministic local runner with the same behavior as current `answerGroundedQuestion()`:
  - receive user message;
  - retrieve evidence;
  - synthesize answer;
  - validate;
  - persist.
- Keep `answerGroundedQuestion()` as the public API and have it delegate when enabled.
- Do not add a retrieval loop yet.

Acceptance:

- Existing conversation/retrieval/e2e tests pass unchanged or with minimal expectation updates.
- A new test proves graph-backed and direct grounded paths produce equivalent persisted artifacts with the fake provider.
- Feature flag disabled path remains current behavior.

QA:

- Vitest: add `tests/db/chat-agent.test.ts`; seed approved Markdown; run a graph-backed `tell me about three brass lamps` turn with `createExtractiveGroundedAnswerProvider()`; expect one user message, one assistant message, one retrieval run, cited-only citations, and source previews matching the direct grounded path.
- Vitest: run the same question with `IKIS_CHAT_AGENT_ENABLED` unset/false through `answerGroundedQuestion()`; expect the current non-agent path still persists a valid cited answer.
- Command: `pnpm exec vitest run tests/db/chat-agent.test.ts tests/db/conversation.test.ts tests/db/retrieval.test.ts`; expect all tests pass.
- Typecheck: `pnpm typecheck`; expect no TypeScript errors.

### Phase 2: Persist Agent Step Trace

- Record graph/session metadata using `workflow_runs`.
- Add deterministic thread/session IDs linked to `conversationId`.
- Store node summaries, not full raw corpus text, except where retrieval run context already stores evidence for replay.
- Expose trace metadata in retrieval/inspection tests before UI work.

Acceptance:

- Tests can inspect the node order and statuses for a completed turn.
- Failed nodes persist enough detail to debug without leaking unrelated content.

QA:

- Vitest: seed approved Markdown and run a successful graph-backed turn; inspect `workflow_runs` via repository helpers or SQL; expect node summaries in order: `receive_user_message`, `classify_intent`, `plan_retrieval`, `retrieve_evidence`, `synthesize_answer`, `validate_answer`, `persist_completed_turn`.
- Vitest: inject a provider that throws from `synthesize_answer`; expect user message persisted, workflow/step trace marks the failed node, no fabricated assistant citation rows are created, and the error is inspectable without raw unrelated corpus text.
- Command: `pnpm exec vitest run tests/db/chat-agent.test.ts tests/db/conversation.test.ts`; expect all tests pass.

### Phase 3: Add Evidence Evaluation And One Retrieval Refinement Loop

- Add `evaluate_evidence` and `refine_query` nodes.
- Bound loops with `maxRetrievalAttempts`, initially 2 or 3.
- Keep first implementation heuristic-driven:
  - no evidence -> refine once if strong terms exist;
  - too many duplicate chunks -> diversify/narrow;
  - still no evidence -> no-evidence fallback.

Acceptance:

- Tests show a broad query can be refined into a better retrieval query.
- Tests show max-loop protection.
- Tests show no-evidence fallback when refinement cannot find evidence.

QA:

- Vitest: seed a document where the first broad query intentionally misses but a refined noun query hits; run the graph; expect two retrieval attempts, final answer cites the refined attempt evidence, and `modelInputs.retrievalAttempts` records both queries.
- Vitest: configure `maxRetrievalAttempts=2` with a corpus that cannot answer the question; expect exactly two attempts, no citations, and the exact insufficient-evidence sentence.
- Vitest: seed duplicate/near-duplicate chunks; ask a broad query; expect evaluation marks low diversity or narrows retrieval, and final selected evidence remains bounded.
- Command: `pnpm exec vitest run tests/db/chat-agent.test.ts tests/db/retrieval.test.ts`; expect all tests pass.

### Phase 4: Add Clarification Path

- Add an `ask_clarifying_question` route for underspecified user turns.
- Persist assistant clarification messages with `waiting_for_user` session status.
- Resume the same session when the user answers.

Acceptance:

- Ambiguous questions produce one clear clarification question.
- Follow-up answers can resume and complete the session turn.
- No citations are fabricated for clarification text.

QA:

- Vitest: submit an underspecified question such as `what about that one?` with no usable prior topic; expect assistant message asks one clarifying question, session status is `waiting_for_user`, no retrieval run citations are created, and no source previews are returned.
- Vitest: continue the same conversation with `I mean goblins`; expect the graph resumes from the waiting session, retrieves goblin evidence, and persists a completed cited answer.
- E2E: run `pnpm e2e` after routing `/chat` through the graph; expect upload/review/approve/chat still completes and citation source preview opens.

### Phase 5: Introduce Actual LangGraph Sidecar If Still Needed

- Decide whether the local runner should be replaced by or wrapped in LangGraph.
- If using LangGraph:
  - keep SQLite canonical;
  - use a checkpointer only for resumability;
  - keep graph state limited to IDs, summaries, tool outputs, and selected evidence references;
  - mirror important user-visible outputs into current tables.
- Preserve a deterministic non-LangGraph path for self-hosted deployments where LangGraph is disabled.

Acceptance:

- `LANGGRAPH_ENABLED=false` or equivalent keeps local chat working.
- LangGraph-enabled path produces the same persisted conversation/retrieval/citation artifacts.
- Sidecar failures degrade to deterministic local behavior or explicit failure, not silent bad answers.

QA:

- Vitest: run a chat turn with LangGraph disabled; expect deterministic local runner or current grounded path produces a cited answer.
- Vitest/integration: run the same seeded turn with LangGraph enabled and a fake/checkpoint-backed graph; expect the same user-visible messages, retrieval run, and cited-only citation rows as the local runner.
- Fault injection: make the LangGraph sidecar/checkpointer unavailable; expect either explicit failure with persisted error trace or configured fallback to deterministic local behavior, never an uncited answer.
- Command: `pnpm exec vitest run tests/db/chat-agent.test.ts tests/db/conversation.test.ts && pnpm typecheck`; expect success.

### Phase 6: Chat UI And Trace Improvements

- Keep `/chat` mostly unchanged initially.
- Add optional agent trace link or retrieval trace section showing:
  - intent;
  - retrieval attempts;
  - route decisions;
  - validation result;
  - final status.
- Consider streaming only after graph execution and persistence are stable.

Acceptance:

- The user can inspect why the agent searched/refined/answered.
- Citation source previews remain the primary audit path for claims.

QA:

- Playwright/e2e: route `/chat` through the graph-backed runner; upload and approve fixture Markdown; ask `What does the approved corpus say about three brass lamps and the chalk mark?`; expect cited answer, visible sources, citation preview opens, and no browser console errors.
- Playwright/manual 5174: with EPUB-only Monster Manual corpus approved, ask `tell me about goblins`; expect cited answer, agent/retrieval trace shows intent and retrieval attempts, and each citation preview resolves.
- Build: run `pnpm build`; expect production client/server build succeeds.

## Testing Strategy

Add or update tests around these surfaces:

- `tests/db/conversation.test.ts` for graph-backed turn persistence and cited-only citations.
- `tests/db/retrieval.test.ts` for retrieval context/refinement behavior.
- New `tests/db/chat-agent.test.ts` if the runner grows beyond `grounded.server.ts`.
- `e2e/ikis-flow.ts` once `/chat` routes through the graph-backed runner.

Required cases:

1. Graph-backed turn persists user and assistant messages.
2. Graph-backed answer creates retrieval run and cited-only citations.
3. Invalid provider citations are rejected after graph synthesis.
4. Retrieval loop stops after max attempts.
5. No-evidence persists no citations.
6. Clarification path persists `waiting_for_user` without citations.
7. Feature flag disabled path remains current behavior.

## Verification Commands

Run after implementation phases:

```bash
pnpm exec vitest run tests/db/retrieval.test.ts tests/db/conversation.test.ts tests/db/review-queue.test.ts
pnpm typecheck
pnpm build
pnpm e2e
```

For hosted verification:

```bash
docker compose --env-file .env -p ikis-docling -f docker-compose.docling.yml up -d --build app redis ocr-worker
```

Then verify on 5174 with the clean EPUB-only corpus:

- ask `tell me about goblins`;
- ask a follow-up that depends on session context;
- inspect citations and retrieval/agent trace;
- verify source preview links resolve.

## Risks And Mitigations

### Risk: Agent Loop Weakens Grounding

Mitigation:

- Keep final validation mandatory.
- Persist no citations for invalid/uncited output.
- Treat graph decisions as orchestration, not proof.

### Risk: LangGraph Becomes Canonical Store

Mitigation:

- Use SQLite for user-visible product data.
- Use graph checkpoints only for resumability.
- Mirror final outputs into existing tables.

### Risk: Too Much Complexity Before Value

Mitigation:

- Phase 1 reproduces current behavior behind a feature flag.
- Phase 3 adds exactly one bounded loop.
- Clarification and actual LangGraph integration come later.

### Risk: Duplicate Trace Systems

Mitigation:

- Reuse `workflow_runs` first.
- Add `agent_sessions` / `agent_steps` only when UI/debugging needs require them.

### Risk: Private Source Material Leakage

Mitigation:

- Keep self-hosted/BYO posture.
- Store only necessary selected context in retrieval run metadata.
- Make outbound provider use explicit.
- Do not add sourcebook text to fixtures.

## Open Questions

1. Should Phase 1 use actual LangGraph immediately, or a local graph-like runner that mirrors LangGraph state/nodes until the workflow is stable?
2. Should chat agent enablement use a new `IKIS_CHAT_AGENT_ENABLED` flag or reuse `LANGGRAPH_ENABLED`?
3. Should `workflow_runs` be the long-term trace store, or should `agent_sessions` / `agent_steps` be added once the graph shape stabilizes?
4. Which first follow-up behavior should prove session memory: pronoun/topic carryover, clarification resume, or mode switching?
5. How much selected evidence context should be stored in graph trace versus only in `retrieval_runs.modelInputs.context`?

## Recommended First Slice

Implement a local graph-compatible chat runner behind `IKIS_CHAT_AGENT_ENABLED` that reproduces the current grounded turn with explicit nodes and state, persists a minimal `workflow_runs` trace, and returns the same `GroundedConversationTurn` shape.

This creates the architectural seam for a real agent loop without destabilizing the working cited-answer path.
