# Data Model: Root-guard accepts non-ASCII board paths

No persistent data. One in-memory value matters:

- **Staged set** — an ordered list of path strings, one per staged file, each exactly
  as stored in the index (UTF-8, no quoting, no escaping). Empty list means nothing is
  staged.
  - Validation: every element starts with `backlog/` ⇒ board-sync allowed; otherwise
    refused naming the first non-`backlog/` element.
