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

This page is the durable current-state note for the corpus layer. It covers what material belongs in the corpus, how the current default corpus is managed, and which future multi-corpus seams are still design notes only.

## Current contract

- The current implementation is default-corpus-only.
- The active runtime is resolved through the single `default` pointer, and retrieval uses that pointer to pick scope.
- The manifest contract, seed flow, reset flow, and retrieval eligibility rules all key off `default-corpus` today.
- `corpus_manifest.py`, `corpus_seed.py`, `corpus_reset.py`, `version_lifecycle.py`, and `retrieval_service.py` define the runtime behavior this page describes.

## Terminology

- **Corpus**: the managed set of approved source archives and the rows, chunks, and indexes derived from them.
- **Runtime version**: the versioned namespace that owns uploads, derived paths, and the Qdrant collection used for a seeded corpus.
- **Default corpus**: the one supported corpus in the current contract. Its runtime version label is `default-corpus`.
- **Active pointer**: the stored pointer named `default` that resolves the runtime version currently in use.
- **Manifest**: the operator-supplied description of the corpus archives, source identities, and expected counts.
- **Source identity**: the fixed trio of corpus sources, `phb-2014`, `dmg-2014`, and `mm-2014`, with fixed filenames and titles.

## Default corpus scope

- `corpus_manifest.py` enforces a single source set with the three default archives and rejects extra or missing source IDs.
- `corpus_seed.py` defaults seed, verify, and lock operations to `default-corpus` unless the manifest already names that runtime version.
- `corpus_reset.py` only targets the default runtime version in the current contract and refuses to touch the active version.
- The page should be read as a contract for the current default corpus, not as a claim that there is a runtime selector for multiple corpora.

## Runtime versioning

- Runtime versions are version-scoped, not free-form user labels.
- `version_lifecycle.py` creates the database namespace, Qdrant collection, and upload, static, and runtime prefixes for each version.
- The runtime version stores the concrete namespace identity, while the corpus manifest stores the corpus-facing `runtime_version` value.
- In the current contract, `default-corpus` is the runtime version that the rest of the corpus workflow expects.

## Corpus versus runtime version

- The corpus is the content contract, while the runtime version is the storage and execution boundary that carries it.
- `corpus_manifest.py` validates corpus identity and source metadata.
- `version_lifecycle.py` owns the runtime namespace lifecycle and the active pointer that selects which version is live.
- `corpus_seed.py` bridges the two by loading the manifest into a runtime version and verifying that the stored rows still match the manifest.
- `corpus_reset.py` removes runtime-scoped rows and derived data without changing the archive bytes or the active pointer.

## Active pointer

- The active pointer is stored under the fixed name `default`.
- `version_lifecycle.py` activates a ready runtime version by updating that pointer and recording lifecycle events.
- `resolve_runtime_context()` uses the pointer to recover the active runtime version when retrieval or other callers need scope.
- Seed and reset paths refuse to act on the active runtime version, so the pointer stays stable unless an explicit activation step changes it.

## What this layer does not own

- It does not own answer-time ranking.
- It does not own chat session state.
- It does not own ETL dispatch rules.
- It does not own a generalized multi-corpus selector in the current release.

## Dependencies

- Depends on [[ETL Architecture]] for the ingestion and chunk output it consumes.
- Feeds [[RAG Retrieval Architecture]] with the scope that retrieval must respect.
- Feeds [[Chat Sessions Architecture]] with the corpus context a session can use.

## Manifest and source identity

- `corpus_manifest.py` is the source of truth for manifest validation.
- The schema version is fixed, the runtime version must be `default-corpus`, and the source set must match the default trio exactly.
- Each source must preserve its title, filename, parser, and optional lock metadata.
- Lock manifests carry per-source counts and total counts, and the totals must sum from the source counts.
- The manifest also verifies archive presence and hash matches when a lock manifest is supplied.

## Seed, reset, verify

- `corpus_seed.py` owns the lock, seed, verify, and source classification flow for operator-supplied archives.
- Seed creates or reuses the runtime version, queues uploads when needed, and stamps runtime and corpus metadata onto batches, jobs, and source rows.
- Verification checks actual counts against the lock manifest and also checks source metadata, so it fails when ingestion is incomplete or the manifest is stale.
- `corpus_seed.py` refuses to seed the active runtime version and refuses unsupported runtime labels.
- `corpus_reset.py` refuses active, teardown-locked, or running-job targets and removes only the target runtime rows, Qdrant points, and derived paths.

## Seed/import/verify lifecycle

- Import begins with the operator archive set and the identity manifest.
- Locking produces a lock manifest after seeding into a temporary runtime namespace and measuring the resulting counts.
- Seed uses the lock manifest, classifies sources as reusable or enqueue-only, and only processes uploads that need fresh work.
- Verify compares stored source rows, job metadata, and count totals against the manifest for the runtime version.
- The lifecycle is designed to keep the runtime data and the manifest in sync, not to promote arbitrary source collections into the corpus.

## Scope ownership

- Corpus scope is the source of truth for what retrieval may search.
- The active pointer decides which runtime version is live.
- Seed and reset do not mutate the active pointer.
- Verification reports whether the seeded corpus still matches the manifest for that runtime version.

## Reset lifecycle

- `corpus_reset.py` requires a concrete runtime version and refuses ambiguous or missing versions.
- The reset path checks the active pointer first, then rejects teardown-locked versions and any version with running jobs.
- Reset preserves the immutable archive reference and checks that its SHA stays unchanged across the operation.
- The actual delete step scopes removal to the target runtime version's rows, indexes, Qdrant points, and derived paths.
- The preserved archive and active pointer are explicit parts of the reset contract, not incidental side effects.

## Retrieval eligibility contract

- `retrieval_service.py` resolves scope from the active pointer before it searches.
- If the pointer is absent, retrieval falls back to the configured collection, but that is a fallback path, not the normal corpus contract.
- Retrieval only accepts chunks that are indexed in the resolved Qdrant collection.
- The trace metadata records the resolved scope, which makes it clear which runtime version was searched.
- This keeps answer-time retrieval aligned with the current corpus boundary instead of letting it roam across every stored chunk.

## Failure and recovery expectations

- If the manifest does not match the archive set, validation fails early.
- If seed sees a source mismatch, unexpected source ID, or count mismatch, it fails before the corpus is treated as ready.
- If reset targets the active runtime version, a teardown-locked version, or a running job set, it refuses the request.
- If retrieval cannot resolve the active pointer, it falls back only to the configured collection and records that fact in trace metadata.
- Recovery is operational, not magical: operators reseed, reverify, or re-run lifecycle steps instead of expecting the page to imply automatic healing.

## Future seams

Generalized multi-corpus support is a long-run product direction, but it is not implemented in the current scope.

Future seams to keep open:

- A corpus registry could map more than one corpus to the same system without changing the current default-corpus contract.
- The active pointer model could grow from a single pointer to a selected corpus entry, but that would need explicit product and data-model work.
- Retrieval could eventually resolve corpus choice from a caller-supplied selector, but not until the runtime and manifest layers know how to persist and validate that choice.
- Seed and reset could later accept a corpus selector, but today they are still anchored to the single default corpus path.

These seams are only design notes for now. They are not implemented, and this page should not be read as a promise that multi-corpus runtime support already exists.

## Explicit non-goals

- No generalized multi-corpus runtime support.
- No new retrieval selector contract.
- No expansion of the default source trio.
- No change to the fixed `default` active pointer in the current release.
- No change to application code or tests from this documentation task.

## Related notes

- [[Layer Boundaries]]
- [[ETL Architecture]]
- [[RAG Retrieval Architecture]]
- [[Chat Sessions Architecture]]
