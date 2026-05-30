---
schema_version: 2
id: 21
uuid: 019e7572-f417-7c79-a7a7-96b5950657c7
title: Build graph/PPR rerank and context pack compiler
type: card
status: backlog
priority: p1
project: the-stacks
created: 2026-05-29
---
# Build graph/PPR rerank and context pack compiler

This card turns search into the product surface: graph-aware reranking plus cited context packs.

## Context

Zach's experiment built a local graph from page/chunk containment, approved links, chunk links, and categories. It then used PPR as a mild reranking/expansion signal and compiled a Waterdeep faction intrigue context pack. That is now first-class v0 scope.

Source evidence:

- `/home/coda/agents/zach/experiments/dnd-memory-graph/results/04-graph-ppr-hybrid.md`
- `/home/coda/agents/zach/experiments/dnd-memory-graph/results/05-section-filtering.md`
- `/home/coda/agents/zach/experiments/dnd-memory-graph/results/06-context-pack.md`
- `/mnt/jace_coda/dnd-memory-graph/context-packs/waterdeep-faction-intrigue.md`

## Shape

Build Go storage and CLI support for:

1. graph nodes and edges in sqlite.
2. graph derivation from approved page links, categories, and page/chunk containment.
3. PPR seeded from high-confidence lexical/vector results.
4. hybrid result output with lexical, vector, and graph score components.
5. section downranking for obvious media/meta boundary leaks under the official-tabletop corpus policy.
6. `the-stacks context-pack` emitting Markdown and JSON with selected pages, selected chunks, citations, and selection rationale.

## Done when

- Graph build over the D&D slice reports node/edge counts comparable to the experiment.
- Hybrid search improves or explains the tracked queries without hiding direct entity hits.
- Context-pack generation produces Markdown and JSON for `Waterdeep faction intrigue` or a successor demo task.
- Pack output cites local chunk ids and source metadata.
- Known corpus gaps are documented rather than papered over.
- Tests cover graph construction, PPR scoring boundaries, section downranking, and context-pack serialization.
