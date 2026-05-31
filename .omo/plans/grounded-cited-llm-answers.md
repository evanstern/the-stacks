# Grounded Cited LLM Answers Plan

## Goal

Get Ikis from the current extractive citation prototype to a single Ask Ikis turn where a user can ask `tell me about goblins` and receive a well-formatted, accurate answer grounded only in approved corpus evidence, with citations that resolve back to persisted source previews.

## Current State

- `app/routes/chat.tsx` posts the question to `askGroundedQuestion()` and renders the returned answer plus source previews.
- `app/lib/conversations/grounded.server.ts` persists conversations, messages, retrieval runs, and citations.
- `answerGroundedQuestion()` currently calls `retrieveLexicalChunks()` and builds an extractive answer from the top retrieved snippets.
- `app/lib/retrieval/lexical.ts` uses SQLite FTS `bm25(chunk_fts)` over approved/indexed chunks, with `OR` between query tokens and a default limit of 5.
- Citations already persist `chunkId`, `documentId`, `sourceId`, rank, score, quote, and stable chunk ID metadata.
- Review approval now indexes documents asynchronously from the UI path, so loaded data may briefly be approved but not yet retrievable.

## Target Behavior

For a question like `tell me about goblins`, Ask Ikis should:

1. Retrieve a larger candidate set of approved indexed chunks likely to mention goblins.
2. Build a bounded evidence context from the best candidates.
3. Send the question and context to an LLM.
4. Require the LLM to answer only from the supplied context.
5. Require citation markers such as `[1]`, `[2]` that correspond to supplied evidence records.
6. Persist the LLM answer, retrieval run, model inputs, model output metadata, and citation rows.
7. Return `The corpus does not contain enough evidence to answer that question.` when retrieval or answer validation cannot support a grounded answer.

## Non-Goals

- Do not add embeddings/vector search in this plan.
- Do not build multi-turn conversational memory beyond the existing conversation transcript.
- Do not let the LLM browse or query the database directly.
- Do not fabricate citations to chunks that were not included in the evidence context.
- Do not block user data loading work; this plan assumes more approved/indexed data will appear while implementation proceeds.
- Do not conflate upstream text extraction experiments with downstream answer synthesis; Qwen-style OCR output must enter through import/review before Ask Ikis cites it.

## Design

### 0. Keep Ingestion Experiments Upstream Of Grounded Answers

The user is setting up a Hugging Face-hosted Qwen 3.6 27B instance on GCP to experiment with pseudo-OCR: page images in, extracted text out. Treat this as an import adapter / extraction candidate source, not as part of the Ask Ikis answer-generation loop.

Near-term posture:

- Add Qwen OCR as an experimental PDF/page extraction path only after the grounded answer path is underway or in parallel with it.
- Normalize Qwen output into the same `NormalizedDocument` / review item path used by Docling and other adapters.
- Preserve page/source provenance so citations can still resolve to the original PDF/page/chunk.
- Store extraction metadata such as provider URL/model name, page number, image settings, prompt version, and confidence/self-check fields if available.
- Require human review/approval before Qwen-extracted text becomes retrievable corpus evidence.
- Compare Qwen output against Docling output on the same pages before treating it as better than Docling.

Expected result: Qwen can improve the quality of imported text, but Ask Ikis remains grounded in approved indexed corpus chunks regardless of which extractor produced them.

### 1. Separate Retrieval Candidates From Answer Evidence

Create a retrieval preparation layer that can retrieve more than the final citation count.

- Add a function near `retrieveLexicalChunks()` or in a new `app/lib/retrieval/context.ts` module.
- Retrieve a candidate pool, for example 20-30 chunks, using existing lexical FTS.
- Deduplicate or diversify candidates so one long document section does not crowd out all other useful evidence.
- Select a smaller final context set, initially 6-10 records, bounded by character/token budget.
- Preserve original score/rank and assign `contextOrdinal` values that map to citation labels `[1]`, `[2]`, etc.

Expected result: the answer model receives a broader but still bounded evidence packet, and persisted citations can map exactly to that packet.

### 2. Build Evidence Context Records

Define a stable context record shape:

```ts
type GroundedEvidenceRecord = {
  ordinal: number;
  chunkId: string;
  documentId: string;
  sourceId: string;
  documentTitle: string;
  sourceLabel: string;
  headingPath: string[];
  score: number;
  rank: number;
  text: string;
};
```

The prompt should include enough provenance for the model to cite accurately, but citations should be ordinal-only in the answer. The UI already resolves ordinals to source previews.

Expected result: model inputs are inspectable and replayable from `retrieval_runs.modelInputs`.

### 3. Add Grounded Answer Provider

Create `app/lib/conversations/grounded-answer.server.ts` or similar.

Responsibilities:

- Read provider configuration from environment.
- Support at least one real provider using existing available keys, likely OpenAI first because `.env`/compose already expose `OPENAI_API_KEY`.
- Keep a deterministic fallback or test provider for unit tests.
- Return a structured result:

```ts
type GroundedAnswerResult = {
  answer: string;
  citedOrdinals: number[];
  model: string;
  promptVersion: string;
  rawText?: string;
};
```

Prompt requirements:

- Answer only from provided evidence.
- If evidence is insufficient, use the exact insufficient-evidence sentence.
- Cite factual claims with `[n]` markers.
- Do not cite evidence numbers that were not supplied.
- Prefer concise RPG-reference style prose with short paragraphs or bullets when useful.

Expected result: LLM synthesis is isolated behind a provider boundary and easy to fake in tests.

### 4. Validate LLM Output Before Persisting As Grounded

Add a lightweight validator before accepting the LLM answer.

Validation rules:

- If retrieval found no evidence, do not call the LLM; return insufficient evidence.
- If LLM returns the insufficient-evidence sentence, persist `noEvidence: true` and no citations.
- Extract citation markers with `/\[(\d+)\]/g`.
- Reject or downgrade to insufficient evidence if the answer cites an ordinal outside the provided context.
- Reject or downgrade if the answer makes no citations despite evidence being supplied.
- Persist citations only for actually cited evidence records, not every retrieved context record.

Expected result: the system never presents uncited LLM prose as grounded corpus evidence.

### 5. Update `answerGroundedQuestion()` Flow

Replace the current extractive answer build with:

1. Persist user message.
2. Retrieve candidate chunks.
3. Build evidence context.
4. If no evidence, persist insufficient-evidence assistant message/retrieval run.
5. Call grounded answer provider.
6. Validate cited ordinals.
7. Persist assistant message using model/provider metadata.
8. Persist retrieval run with:
   - `retrievalMode`, initially `lexical-fts-context-v1`;
   - `modelInputs.mode`, initially `llm-grounded-answer`;
   - prompt version;
   - selected context records;
   - candidate counts and score/rank metadata;
   - validation result.
9. Persist citation rows for cited ordinals.
10. Return source previews for cited records.

Expected result: UI behavior stays mostly unchanged, but answer text becomes synthesized by the LLM and citations reflect the actual cited context.

### 6. Improve The Retrieval Baseline Just Enough For `goblins`

Before adding embeddings, make lexical retrieval less brittle:

- Increase candidate pool size from 5 to a configurable value for grounded answers.
- Consider an `AND`/phrase fallback strategy:
  - first exact quoted terms/phrase when the query has strong noun terms;
  - then OR fallback if exact retrieval is empty.
- Keep `OR` broadness under control by filtering weak scores and deduping near-identical chunks.
- Add trace metadata explaining retrieval strategy and thresholds.

Expected result: a broad query like `tell me about goblins` pulls several relevant goblin chunks without being dominated by irrelevant matches to `tell`, `me`, or `about`.

### 7. UI/Trace Updates

Keep the main Ask Ikis UI simple.

- The answer card should render LLM markdown/plain text with citation markers left visible.
- The sources panel should list only cited sources in citation order.
- The retrieval trace page should expose:
  - candidate count;
  - final context count;
  - cited ordinal list;
  - prompt/model metadata;
  - insufficient-evidence or validation failure reason when applicable.

Expected result: the user can inspect why an answer was produced and where each citation came from.

## Implementation Phases

### Phase 1: Context Builder And Tests

- Add evidence context builder around lexical retrieval.
- Add tests for candidate pool size, final context cap, citation ordinal mapping, and empty retrieval behavior.
- Keep existing extractive answer behavior temporarily.

Acceptance:

- Unit tests prove context records contain chunk/document/source provenance.
- Existing retrieval tests still pass.

### Phase 2: Grounded Answer Provider

- Add provider module with fake test provider and real OpenAI-backed provider.
- Add prompt template and output citation extraction/validation.
- Add tests for valid citations, unknown citations, uncited answer, and insufficient evidence.

Acceptance:

- Tests can run without network/API keys.
- Real provider is only called when configured.
- Invalid model output is not accepted as grounded.

### Phase 3: Wire Into Ask Ikis

- Update `answerGroundedQuestion()` to use context builder and grounded answer provider.
- Persist model inputs/output metadata and cited-only citation rows.
- Preserve existing `SourcePreview` UI contract.
- Add integration tests for a question answered with cited synthesized prose.

Acceptance:

- Tests show the assistant answer is provider-generated and contains citations.
- Citation rows correspond exactly to cited ordinals.
- No-evidence path persists no citations and returns the exact fallback sentence.

### Phase 4: Hosted 5174 Verification With Loaded Data

- Rebuild/restart 5174.
- Ensure the loaded goblin-containing documents are approved and indexed.
- Ask `tell me about goblins` via the hosted Ask Ikis UI or direct authenticated POST.
- Inspect response, persisted retrieval run, citations, and source previews.
- Verify answer cites only retrieved evidence and source preview links resolve.

Acceptance:

- Hosted response is formatted as a useful answer, not just raw snippets.
- The response includes citation markers.
- Each citation link resolves to the relevant chunk/source preview.
- No unsupported goblin facts appear in the answer when compared with cited chunks.

### Phase 5: Qwen OCR Extraction Experiment

- Define an adapter boundary for GCP/Hugging Face Qwen OCR calls.
- Create a small page-image extraction script or adapter prototype that accepts a PDF/page image and returns normalized text plus provenance metadata.
- Run it against a few pages that Docling handles well and a few pages Docling handles poorly.
- Persist outputs only through the existing review/import path, not directly into retrievable chunks.
- Add side-by-side inspection for Docling vs Qwen output quality before deciding whether to promote Qwen to a regular `pdf-qwen-ocr` adapter.

Acceptance:

- Qwen output can create review items with page/source provenance intact.
- No Qwen output becomes retrievable until approved.
- A small comparison report identifies where Qwen beats, matches, or loses to Docling.
- The grounded answer pipeline can cite Qwen-derived chunks exactly the same way it cites Docling-derived chunks after approval/indexing.

## Verification Commands

Run after implementation:

```bash
pnpm exec vitest run tests/db/retrieval.test.ts tests/db/conversations.test.ts tests/db/review-queue.test.ts
pnpm typecheck
pnpm build
docker compose --env-file .env -p ikis-docling -f docker-compose.docling.yml up -d --build app redis ocr-worker
```

Hosted smoke check shape:

```bash
# Authenticate, POST /chat with question="tell me about goblins", then inspect:
# - HTTP response time/status
# - answer text
# - citation count
# - retrieval_runs.model_inputs_json
# - citations rows
# - source preview route for each citation
```

## Risks And Mitigations

- Risk: lexical retrieval misses relevant goblin chunks.
  - Mitigation: larger candidate pool, stopword filtering, phrase/term strategy metadata, future vector search plan if needed.
- Risk: LLM invents facts not in context.
  - Mitigation: strict prompt, citation validation, insufficient-evidence downgrade, source-preview inspection.
- Risk: context window too large for provider.
  - Mitigation: character budget and chunk selection cap.
- Risk: provider unavailable in local/CI.
  - Mitigation: fake provider for tests and fallback insufficient-evidence behavior when real provider is unconfigured.
- Risk: citations point to unused context.
  - Mitigation: persist citations only for ordinals actually cited by the final answer.
- Risk: Qwen OCR hallucinates or normalizes page text too aggressively.
  - Mitigation: keep it upstream, preserve page images/source links, require human review, and compare against Docling before promotion.
- Risk: Qwen OCR provider latency/cost makes ingestion brittle.
  - Mitigation: keep it behind an experimental adapter with timeouts, per-page retries, and clear failure metadata.

## Open Questions

- Which provider/model should be the first real target for hosted 5174: OpenAI, Anthropic, or a local provider URL?
- Should the first iteration use only lexical retrieval, or should a reranker be introduced before the LLM turn?
- What answer format do we want by default for RPG sourcebook material: short encyclopedia entry, bullet summary, or direct Q&A prose?
- Should Ask Ikis expose retrieval parameters in the UI for debugging, or keep them trace-only?
- What exact Qwen endpoint contract will the GCP/Hugging Face instance expose: OpenAI-compatible chat completions, a custom image endpoint, or a batch job API?
- Should Qwen OCR be evaluated as a replacement for Docling on image-heavy pages, or as a fallback only when Docling quality/readiness is poor?
