# Module 1: Two Signals, One Answer

Write to: `modules/01-two-signals.html` — a single `<section class="module" id="module-1">` only.

## AUDIENCE OVERRIDE (course-wide — repeat verbatim in every brief)
Skilled, time-poor developer. No CS-fundamentals tooltips. DO tooltip on first use the
DOMAIN terms this module introduces — one crisp sentence each, with the governing
Principle/FR in parentheses. Crisp developer metaphors only.
Terms: `hybrid retrieval` ("two independent relevance signals fused into one ranking — spec 010 FR-001"), `reader predicate` ("chunks.generation = sources.current_generation — readers never see a half-swapped source — FR-002"), `RRF` ("reciprocal-rank fusion: 1/(k+rank) summed per signal; ranks only, scores ignored — research R1"), `similarity floor` ("vector candidates below RETRIEVAL_MIN_SIMILARITY are not candidates — honest empty results exist because of it").

## Teaching Arc
- **Metaphor:** Two librarians answer every question — a literalist who matches exact words (FTS) and an associative one who matches meaning (vectors). Neither is trusted alone; a rank-based vote merges them.
- **Opening hook:** "Search 'grapple' and the exact-match librarian wins. Search 'holding an enemy in place' — no shared words at all — and the passage still surfaces. Same engine, one ranking. How?"
- **Key insight:** ts_rank_cd and cosine similarity are incomparable scales — so RRF throws the scores away and votes with RANKS, needing zero per-corpus calibration.
- **Why should I care?:** Quick Ask and Conversations will call exactly this engine; every tuning question routes through its config knobs (all env-first, Principle VII).

## Canonical vocabulary
`stamp check` → `embed` → `fts ∥ vector` → `fuse` → `record` → `results`

## Screens (5)
1. Hook + data-flow animation of the pipeline (actors: Query, FTS librarian, Vector librarian, Fusion desk, Receipt book) — steps labelled with the canonical vocabulary.
2. The two candidate queries: translation block on the vector SQL (search.ts — the exact <=> scan with the reader predicate join AND the floor clause) with callout: exact scan, no ANN below ~100k chunks (R2).
3. The fusion math: translation block on fusion.ts's RRF core; callout: ties break lexicographically — determinism is a receipt property.
4. The floor: callout telling the true story — the first honest test proved nearest-neighbor NEVER returns nothing, so RETRIEVAL_MIN_SIMILARITY was born mid-cycle (.env.example comment as snippet).
5. Quiz + handoff to Module 2 (every search you just saw was recorded — the receipt book).

## Code Snippets (verbatim — do not modify; copy from the live files, cite file:line)
**Snippet A** — `packages/retrieval/src/fusion.ts` (the RRF closure inside fuse(), incl. the missing-list rule comment)
**Snippet B** — `packages/retrieval/src/search.ts` (the vector candidate query incl. reader predicate + floor + exact-scan comment)
**Snippet C** — `.env.example` (the RETRIEVAL_MIN_SIMILARITY block with its why-comment)

## Interactive Elements
- [x] Data-flow animation (screen 1, canonical vocabulary steps)
- [x] Code↔English translations — A, B, C (inline contract: one .tl per .code-line)
- [x] Quiz — 3 questions: (1) why RRF over weighted-sum by default (no calibration knob; incomparable scales); (2) what excludes a written-aside generation (the reader predicate, FR-002); (3) a query returns zero results — name both mechanisms that allow that honestly (websearch AND semantics on FTS; the similarity floor on vectors).
- [x] Callouts — R2 exact-scan deferral; determinism tie-break.
- [x] Glossary tooltips — the four terms above.

## Connections
- **Previous:** none (course opener).
- **Next:** Module 2 "The Receipt Book" — the record that outlives the corpus.
- **Tone/style:** accent #2563eb; actors "the literalist" / "the associative"; REAL values: live wall 0.09s, stage timings embed 38ms / fts 3ms / vector 4ms (evidence.md), paraphrase vector score 0.316.
