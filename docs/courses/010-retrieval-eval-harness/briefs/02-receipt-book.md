# Module 2: The Receipt Book

Write to: `modules/02-receipt-book.html` — a single `<section class="module" id="module-2">` only.

## AUDIENCE OVERRIDE (course-wide — repeat verbatim in every brief)
Skilled, time-poor developer. No CS-fundamentals tooltips. DO tooltip on first use the
DOMAIN terms this module introduces — one crisp sentence each, with the governing
Principle/FR in parentheses. Crisp developer metaphors only.
Terms: `receipt` ("a retrieval run's append-only record: query, config, every result with snapshot — Principle III"), `snapshot` ("passage text/anchor copied ONTO the result row at retrieval time, so the receipt outlives generation sweeps — FR-009"), `superseded` ("derived at view time: no current-generation chunk carries this result's content hash — never stored"), `append-only by construction` ("the module exports exactly one writer and no UPDATE/DELETE path exists — the recordEvent posture").

## Teaching Arc
- **Metaphor:** A carbon-copy receipt book. Every sale writes through to a page nobody can tear out or edit; when the shop later renovates (re-ingest), old receipts still read perfectly — some just get a 'this item was discontinued' stamp when you LOOK at them.
- **Opening hook:** "Open a months-old search. The source was re-ingested twice since. The receipt still renders every passage it returned — and truthfully marks which ones no longer exist."
- **Key insight:** Immutability isn't a policy, it's a construction: snapshots make receipts self-sufficient, and 'superseded' is DERIVED so no row ever needs an UPDATE.
- **Why should I care?:** Citations are receipts (Principle III) — Quick Ask's answer→run→chunk chain lands on this exact structure.

## Canonical vocabulary
`record (one transaction)` → `render from snapshots` → `derive superseded` → (`auto-heal` when identical text survives)

## Screens (5)
1. Hook + group-chat animation: Operator, /search, recordRetrievalRun, Postgres — the one-transaction write ("header + every line or nothing").
2. The writer: translation block on packages/db/src/retrieval-runs.ts (module header + transaction incl. the derived resultCount comment).
3. The snapshot columns: translation block on packages/db/src/schema/retrieval.ts retrieval_results (chunk_id 'deliberately NOT an FK' comment through content_sha256).
4. The derivation: translation block on the NOT EXISTS superseded SQL in apps/api/src/retrieval/routes.ts; callout: identical re-ingested text keeps the hash alive → auto-heal, no mark.
5. Quiz + handoff to Module 3 (the same hash trick powers the answer keys).

## Code Snippets (verbatim, file:line)
**Snippet A** — `packages/db/src/retrieval-runs.ts` (header doctrine + recordRetrievalRun transaction)
**Snippet B** — `packages/db/src/schema/retrieval.ts` (retrieval_results columns: chunk_id → content_sha256 region)
**Snippet C** — `apps/api/src/retrieval/routes.ts` (the superseded NOT EXISTS query with its comment)

## Interactive Elements
- [x] Group-chat animation (screen 1)
- [x] Code↔English translations — A, B, C
- [x] Quiz — 3: (1) why is superseded derived rather than stored (a stored flag needs UPDATE — unrepresentable in an append-only table); (2) a torn receipt (header, no lines) — why impossible (one transaction writes both); (3) source re-ingested with IDENTICAL text — what does the old receipt show (no mark: the content hash still exists at current generation).
- [x] Callouts — 'the response IS the receipt's content' (routes.ts doctrine); append-only test asserting module exports.
- [x] Glossary tooltips.

## Connections
- **Previous:** Module 1 — every search you watched got recorded here.
- **Next:** Module 3 "Answer Keys That Survive" — hash references again, now for labels.
- **Tone/style:** accent #7c3aed; REAL values: live run ids 080e49f5…, 8571faef… (evidence.md), the gibberish search recorded with result_count 0.
