---
schema_version: 2
id: 6
uuid: 019df5c3-a6ce-70db-b3f2-b0f4bbc7480f
title: Build ask CLI and record asciinema demo
type: card
status: archived
priority: p1
project: the-stacks
created: 2026-05-05
epic: 1
---

# Build ask CLI and record asciinema demo

The query side. Embed the question, cosine-similarity over
chunks, return top-k with source + score.

**Blocked by:** #5 (pipeline)

## Shape

- `the-stacks ask "<question>"` — embeds, queries, returns
- Default k=5
- Output format: human-readable by default (chunk text + source
  path + score); `--json` flag for structured output
- `--corpus <db-path>` to point at a specific stacks.db (default
  `./stacks.db`)
- Reasonable formatting — chunks separated, sources in a way
  that copy-pastes well

## Done when

- `ask` returns sensible top-k for a battery of test questions
  drafted in #4
- README has a `## Demo` section with an asciinema recording
  embedded (or linked + thumbnail)
- The recording is < 90 seconds, shows: ingest, ask with one
  good question, ask with one harder question, the kind of
  question RAG would miss (foreshadows M2)

## Notes

The "question RAG would miss" is the M2 hook. Don't overdo it —
one example, no commentary in the recording, let M2 explain
why next.

## Recording tooling

`asciinema rec` for the terminal capture. `agg` to convert to
gif if needed for README inline embed. Test the embed renders
on github.com before closing.
