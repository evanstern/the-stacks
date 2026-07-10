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
- [[worktree-environments]] — the per-worktree environment protocol (spec 009):
  deterministic `10×NNN` port blocks, per-worktree compose identity, the
  `mint-worktree-env` tool, docker lifecycle isolation.
