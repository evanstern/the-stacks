# RAG Rearchitecture Plan

This note distills the RAG/AI-agents planning pass into repo-specific action
items for Ikis. The source PDF at `/tmp/rag-ai-agents.pdf` is a 13 page Canva
export authored by Statfusion AI. Its text layer is empty in this environment,
and no local OCR binary is available in this worktree, so this plan avoids
verbatim paper claims and instead maps the recovered themes onto the current
codebase boundaries.

## Direction

Do not rewrite the app and do not jump straight to vector search. Treat
SQLite/libSQL as the RAG control plane and make the existing pipeline explicit,
observable, replayable, and measurable before adding hybrid retrieval or more
agentic workflows.

The stable product loop is:

1. Import source bytes.
2. Normalize source material into documents and sections.
3. Review and approve what may enter the corpus.
4. Chunk approved documents.
5. Index chunks.
6. Retrieve candidate evidence.
7. Synthesize grounded answers.
8. Persist citations and traces.

## Pipeline Boundaries

### Ingestion

Owner modules: `app/lib/imports/*` and source/import repository methods.

Responsibilities:

- Persist uploaded bytes and source records.
- Select parser/OCR/Docling adapter paths.
- Emit durable `import_job_events` for upload, parse, OCR, Docling, queue,
  worker, warning, failure, and completion states.
- Keep raw artifacts referenced from SQLite records, not hidden in process
  memory.

Immediate action: finish using `import_job_events` as the canonical import
timeline for `/imports/:importJobId` and source detail related jobs.

### Preparation And Review

Owner modules: `app/lib/review/*`, `app/lib/imports/adapters/*`.

Responsibilities:

- Normalize adapter output into documents and sections.
- Classify corpus readiness and extraction quality.
- Create human review items and advisory suggestions.
- Make review approval the only gate into retrievable corpus state.

Immediate action: preserve review rationale, readiness state, OCR quality, and
adapter provenance in versioned metadata. Retrieval should only consume approved
material.

### Chunking And Indexing

Owner modules: `app/lib/chunks/*`.

Responsibilities:

- Generate deterministic chunk drafts from approved documents.
- Store chunk lineage: source, document, section, heading path, ordinal,
  content hash, chunker version, parser version, and quality metadata.
- Build lexical indexes now and leave room for embedding/index build jobs later.

Immediate action: treat chunking and indexing as separate stages. Add chunker
version metadata before experimenting with semantic chunking or embeddings.

### Retrieval

Owner modules: `app/lib/retrieval/*`, retrieval persistence in conversations.

Responsibilities:

- Preserve the current SQLite FTS/BM25 baseline.
- Persist original question, rewritten retrieval query, candidate chunks, scores,
  selected context, no-evidence state, and final citations.
- Add vectors and rerankers later as inspectable stages, not hidden replacement
  behavior.

Immediate action: create a small golden-query eval set before hybrid search.
Future vector retrieval must beat the lexical baseline on explicit metrics.

### Synthesis, Citations, And Memory

Owner modules: `app/lib/conversations/*`.

Responsibilities:

- Keep answer generation grounded in selected corpus evidence.
- Persist citations as first-class audit records linked to retrieval runs,
  messages, chunks, documents, and sources.
- Treat chat history as advisory query context, not corpus truth.
- Keep agents behind bounded orchestration interfaces.

Immediate action: version prompts and validation, persist enough trace data to
explain each answer, and keep source/citation previews as audit surfaces.

## Backlog

### Now

- Finish persisted import job events across upload, OCR, Docling, worker, review,
  and indexing transitions.
- Render event timestamps in US Eastern for the current operator while retaining
  UTC `Z` timestamps in SQLite.
- Write focused tests for event insert/list, inspection loading, and lifecycle
  emission.
- Document the import/review/chunk/index/retrieve/answer/cite contract in the
  README or this docs folder.

### Next

- Version metadata contracts for sources, documents, sections, chunks, import
  events, retrieval runs, and citations.
- Add golden retrieval fixtures with expected citations and expected no-evidence
  outcomes.
- Persist both user question and retrieval query in retrieval traces.
- Separate index build metadata from chunk generation metadata.

### Later

- Add embeddings keyed by chunk content hash, model, version, and dimensions.
- Add hybrid retrieval as lexical candidates plus vector candidates plus explicit
  score composition.
- Add reranking as a traced top-N stage.
- Add agent workflows for context packs or summarization only after retrieval and
  citation traces are measurable.

## Non-Goals For This Phase

- No rewrite of React Router or SQLite/libSQL.
- No cloud vector database until local limits are measured.
- No hidden vector-default retrieval before evals exist.
- No agent-owned product memory or review authority.
- No massive directory churn before contracts and tests are stable.

## Key Risks

- Adding vectors before evals will make failures harder to diagnose.
- Letting OCR/Docling artifacts drift outside SQLite IDs will fragment state.
- Mixing chat history directly into lexical queries can hurt precision; trace the
  original question and rewritten query separately.
- Changing chunk policy without versioning will churn citations, embeddings, and
  eval fixtures.
- Agent orchestration must stay a traceable coordinator over canonical state, not
  the state itself.
