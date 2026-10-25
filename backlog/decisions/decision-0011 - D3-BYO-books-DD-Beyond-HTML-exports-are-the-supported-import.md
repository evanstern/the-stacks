---
id: decision-0011
title: 'D3 BYO books: D&D Beyond HTML exports are the supported import'
date: '2026-10-25'
status: accepted
---
## Context

Vision and A9 already made D&D Beyond HTML exports the first-class import, with generic
HTML/PDF/Markdown as best-effort. M1 built the DDB parser and the generic HTML/Markdown path.
With 5e only (decision-0010), the question was whether to widen import support.

## Decision

D&D Beyond HTML exports are **the supported import**. The generic HTML/Markdown path stays
best-effort, as built. We ship no proprietary content.

**Rationale.** DDB exports are the lawful, structured source most 5e operators already own.
Investing in one well-tested parser beats several shallow ones. The generic path already
exists and costs nothing to keep.

## Consequences

- Restates A9's posture; supersedes nothing. A9's mention of PDF import is not a commitment.
- Structured extraction from DDB imports (stat blocks, spells) builds on this parser in M5
  (decision-0012).
- Constitution VIII (operator-owned content) is unchanged for imported books.
