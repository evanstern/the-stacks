# The Stacks Architecture Restart

**Status:** restart scaffold, 2026-05-31.

The chat-first Ikis app proved useful product and operational ideas, then got
archived. The next implementation should be planned from first principles around
the RAG architecture sources now stored in Annie's wiki.

## Preserved Reference

- `archive/chat-first-testbed-2026-05-31` contains the completed test-bed code.
- `docs/rag-rearchitecture-plan.md` and `docs/phb-ocr-timeout.md` are present in
  that archive history.
- The old Focus board is backed up outside the active board at
  `/home/coda/projects/the-stacks/focus-backups/focus-20260531-162555/.focus`.

## Restart Sources

Read these before creating new cards or code:

- `~/agents/annie/wiki/the-stacks-rag-design-sources.md`
- `~/agents/annie/wiki/the-stacks-architecture-restart-2026-05-31.md`
- `/home/coda/RAGDESIGN.md`

## Initial Architecture Questions

1. What is the canonical runtime store for documents, chunks, embeddings,
   retrieval traces, and review decisions?
2. Which ingestion formats are first-class in v0, and which are deferred?
3. What chunking baseline do we start with before semantic or agentic chunking?
4. Which embedding model and dimensionality form the first measurable baseline?
5. Does Qdrant become the first vector store, or do we keep a local SQLite vector
   option for the demo path?
6. What does hybrid retrieval mean here: BM25 plus vector, metadata boosts,
   reranking, graph/PPR, or all of the above in phases?
7. What eval fixtures prove the new architecture is better than the test bed?

## Non-Negotiables Learned From The Test Bed

- Ingestion must be observable with durable events.
- Scanned PDFs need page-batched, resumable OCR.
- Review/approval is a real gate, not decoration.
- Retrieval traces and citation provenance are product surfaces.
- Chat history is context, not canonical corpus memory.
