---
schema_version: 2
id: 20
uuid: 019e7572-f406-7e50-a583-0cb73d29547a
title: Build chunk DB with vectors and lexical baseline
type: card
status: backlog
priority: p1
project: the-stacks
created: 2026-05-29
---
# Build chunk DB with vectors and lexical baseline

This card builds the retrieval substrate for the re-chartered v0: DB-backed chunks, required vectors, and an inspectable lexical baseline.

## Context

Zach's experiment produced 236 heading-aware chunks from 76 approved pages and a transparent lexical scorer. Evan's correction is part of the contract: chunks belong in a DB and vectors are required. Graph/PPR complements vector search later; it does not replace it.

Source evidence:

- `/home/coda/agents/zach/experiments/dnd-memory-graph/results/02-corpus-index.md`
- `/home/coda/agents/zach/experiments/dnd-memory-graph/results/03-lexical-baseline.md`
- `designs/the-stacks.md`

## Shape

Build Go storage and CLI support for:

1. Heading-aware chunk creation from normalized pages.
2. sqlite-backed `chunks` and page/chunk relationship tables.
3. vector embeddings stored in a sqlite-local vector table, likely sqlite-vec.
4. transparent lexical scoring over title, category, heading, approved links, and body terms.
5. `the-stacks search` modes that can show lexical and vector results with source chunk ids and score components.

Keep scoring inspectable. The baseline is supposed to be readable, not clever.

## Done when

- The D&D slice chunks into the DB with stable chunk ids.
- Vector embeddings are generated and stored for chunks.
- Lexical search reproduces the rough behavior from Zach's baseline over tracked queries.
- Vector search returns source chunks with scores.
- Search output exposes score components and citations.
- Tests cover chunking, vector persistence boundaries, and lexical scoring.
