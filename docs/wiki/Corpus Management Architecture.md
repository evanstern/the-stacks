---
title: Corpus Management Architecture
status: active
owner: docs
created: 2026-06-04
updated: 2026-06-05
tags:
  - wiki
  - architecture
  - corpus
---

# Corpus Management Architecture

This page covers the corpus layer that decides what material belongs in a corpus and how that corpus changes over time.

## What this layer owns

- Corpus identity and scope.
- Import, seed, reset, and verification flows for corpus content.
- Rules that decide which uploaded or seeded material belongs to the corpus.
- Runtime version namespaces and the active-pointer model that other layers resolve against.
- Manifest validation for operator-supplied corpus archives.
- The seed/reset/verify workflow that keeps the runtime version aligned with its manifest.

## Runtime versioning

- Runtime versions are version-scoped, not user labels.
- Each version gets its own database namespace, Qdrant collection, and upload, static, and runtime prefixes.
- `version_lifecycle.py` owns the active-pointer behavior that moves a version from ready to active.
- Retrieval resolves the active runtime context from that versioned state before it searches anything.

## What this layer does not own

- It does not own answer-time ranking.
- It does not own chat session state.
- It does not own ETL dispatch rules.

## Dependencies

- Depends on [[ETL Architecture]] for the ingestion and chunk output it consumes.
- Feeds [[RAG Retrieval Architecture]] with the scope that retrieval must respect.
- Feeds [[Chat Sessions Architecture]] with the corpus context a session can use.

## Seed, reset, verify

- `corpus_seed.py` owns the lock, seed, verify, and classification flow for operator-supplied archives.
- Seed queues work into the upload path and stamps runtime and corpus metadata along the way.
- `corpus_reset.py` refuses active, teardown-locked, or running-job targets and only removes the target runtime rows, Qdrant points, and derived paths.
- Verification checks counts against the lock manifest, so it fails when ingestion is incomplete or the manifest is stale.
- Those checks keep the active pointer and stored corpus metadata aligned before retrieval uses them.

## Scope ownership

- Corpus scope is the source of truth for what retrieval may search.
- The active pointer decides which runtime version is live.
- Seed and reset do not mutate the active pointer.
- Verification reports whether the seeded corpus still matches the manifest for that runtime version.

## Roadmap note

Retrieval depends on this page for scope and eligibility rules. The next retrieval plan should treat corpus management as the source of truth for what may be searched, not as a subroutine of retrieval.

## Related notes

- [[Layer Boundaries]]
- [[ETL Architecture]]
- [[RAG Retrieval Architecture]]
- [[Chat Sessions Architecture]]
