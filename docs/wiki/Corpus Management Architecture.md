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

## What this layer does not own

- It does not own answer-time ranking.
- It does not own chat session state.
- It does not own ETL dispatch rules.

## Dependencies

- Depends on [[ETL Architecture]] for the ingestion and chunk output it consumes.
- Feeds [[RAG Retrieval Architecture]] with the scope that retrieval must respect.
- Feeds [[Chat Sessions Architecture]] with the corpus context a session can use.

## Roadmap note

Retrieval depends on this page for scope and eligibility rules. The next retrieval plan should treat corpus management as the source of truth for what may be searched, not as a subroutine of retrieval.

## Related notes

- [[Layer Boundaries]]
- [[ETL Architecture]]
- [[RAG Retrieval Architecture]]
- [[Chat Sessions Architecture]]
