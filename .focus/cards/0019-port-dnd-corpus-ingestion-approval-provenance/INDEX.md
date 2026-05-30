---
schema_version: 2
id: 19
uuid: 019e7572-f3c5-7355-ab7b-a2eea260c0da
title: Port D&D corpus ingestion, approval, and provenance into sqlite
type: card
status: backlog
priority: p1
project: the-stacks
created: 2026-05-29
---
# Port D&D corpus ingestion, approval, and provenance into sqlite

The Stacks re-charter starts here. Zach's D&D memory graph experiment proved the shape with flat-file artifacts; this card ports the intake boundary into the real `the-stacks` storage model.

## Context

Source evidence:

- `/home/coda/agents/zach/experiments/dnd-memory-graph/results/00-candidate-extraction.md`
- `/home/coda/agents/zach/experiments/dnd-memory-graph/results/01-approved-extraction.md`
- `/home/coda/agents/zach/reports/annie-the-stacks-memory-graph-handoff.md`
- `/home/coda/agents/zach/wiki/decisions/the-stacks-memory-graph-graduation.md`

Current v0 demo corpus is official/WotC/tabletop D&D Wikipedia-derived pages, starting with the approved Forgotten Realms slice. The experiment produced 229 candidates, 76 approved pages, and extracted local JSON pages with provenance metadata.

## Shape

Build a Go CLI path that can:

1. Read a candidate or approved manifest.
2. Preserve approval state: approved, deferred, rejected.
3. Extract or import approved page records.
4. Store normalized pages and provenance in sqlite.
5. Report counts and missing-title/source problems clearly.

Flat JSON/JSONL can remain import/export/debug material. Runtime pages and provenance live in sqlite.

## Done when

- `the-stacks ingest` can build a sqlite corpus from an approved manifest.
- DB stores page title, page id, revision id, timestamp, source URL, categories, links, approval state, and page text.
- Approval decisions are auditable without re-reading Zach's scratch manifests.
- The D&D official-tabletop slice imports successfully.
- Design doc notes any intentional divergence from Zach's experiment scripts.
- Tests cover manifest parsing, approval-state persistence, and page/provenance storage.
