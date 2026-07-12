# the-stacks wiki — INDEX

Code-grounded corpus for the **v3 rebuild**, promoted to the repo root on 2026-07-06
when v2 was retired ([ADR 0001](../adr/0001-retire-v2-before-parity.md)). Notes follow
the code dialect of the praxis corpus spec (v1): each pins `verified_against` (a commit)
and `sources` (the files whose change invalidates it), and the grounding-wiki freshness
gate keeps the pins honest — never bump a pin without re-reading the diff against the
sources. Per-spec interactive courses live under `docs/courses/<feature>/`; the retired
v2 wiki is archived under `.v2/wiki/` and describes no running code.

- [[walking-skeleton]] — the foundation slice (spec 007): monorepo layout, compose
  topology, queue/event/vector doctrine, single-operator auth, ML sidecar contract.
- [[ingestion]] — the extensible ingestion pipeline (spec 008): the NormalizedDocument
  plugin seam, detection dispatch, structure-aware chunking, generation-flip
  re-ingestion, one-Postgres storage.
- [[retrieval]] — query-side hybrid retrieval + the eval harness (spec 010): FTS/vector
  fusion under the reader predicate, append-only run receipts with view-time superseded
  derivation, content-hash gold labels, pinned metrics with the deterministic CI floor,
  the optional sidecar reranker.
- [[worktree-environments]] — the per-worktree environment protocol (spec 009):
  deterministic `10×NNN` port blocks, per-worktree compose identity, the
  `mint-worktree-env` tool, docker lifecycle isolation.
