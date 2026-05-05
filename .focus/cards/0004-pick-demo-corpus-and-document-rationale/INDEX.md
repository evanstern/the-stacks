---
schema_version: 2
id: 4
uuid: 019df5c3-a6ac-76ee-a701-d4e4749fc30b
title: Pick demo corpus and document rationale
type: card
status: backlog
priority: p1
project: the-stacks
created: 2026-05-05
epic: 1
---

# Pick demo corpus and document rationale

The README runs against this corpus. It has to be:

- **Public domain or permissively licensed** (redistributable)
- **Substantive enough to need retrieval** (not 12 documents)
- **Coherent enough that a curated wiki layer makes sense** in M2
- **Recognizable** to a hiring manager skimming the README

## Candidates to evaluate

- **Project Gutenberg subset.** Literature. Famous, public domain,
  unambiguously legible. Pro: unmistakable, beautiful, demoable.
  Con: retrieval over fiction is a weird fit — what question are
  we answering?
- **Wikipedia article dump (subset).** Real reference material.
  Pro: questions feel natural. Con: dump tooling, size management,
  not as visually distinctive in a recording.
- **Postgres docs.** Massive, deeply technical, public, beloved.
  Pro: retrieval is a natural use case. Con: maybe too obviously
  "RAG demo" — boring.
- **Kubernetes docs.** Same logic as Postgres.
- **A pre-1924 reference work** (Encyclopedia Britannica 1911,
  Bartlett's, Black's Law Dictionary 1st ed). Pro: distinctive,
  deeply public domain, has an editorial voice that pairs well
  with the librarian metaphor. Con: weird, possibly too cute.

## Done when

- One corpus selected, with rationale committed to
  `designs/the-stacks-corpus.md` (or as an ADR in the repo)
- Corpus acquisition documented (download command, license note,
  size on disk, expected chunk count)
- Sample of 3-5 questions the demo will answer drafted

## Notes

Trust your taste here. The corpus is part of the brand. A boring
corpus makes a boring README. Bias toward something that has a
voice.
