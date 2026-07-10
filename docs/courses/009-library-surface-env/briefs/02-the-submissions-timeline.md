# Module 2: The Submissions Timeline

Write to: `modules/02-the-submissions-timeline.html` — a single `<section class="module" id="module-2">` only.
THIS IS THE COURSE CENTERPIECE — it carries the mandatory hero animation and the most
visual weight of any module.

## AUDIENCE OVERRIDE (course-wide — repeat verbatim in every brief)
Skilled, time-poor developer. No CS-fundamentals tooltips. DO tooltip on first use:
`reader predicate` ("readers filter on generation = current_generation, so a half-written
re-ingest is invisible until its one-UPDATE flip — 008 R8"), `N+1` ("one query per row —
the listing anti-pattern research R3 forbids"), `UNION ALL` ("stack two SELECTs into one
result set without dedupe cost — the merge happens in the database"), `entry report`
("the per-entry outcome list a batch records at expand completion — 008 FR-009").
Crisp developer metaphors only.

## Teaching Arc
- **Metaphor:** A checkout ledger, not two filing cabinets. The operator uploaded things
  in ONE order; the database stores them in TWO tables (sources, batches). The listing's
  job is to answer as the ledger, not as the cabinets — and the merge is the database's
  job, because only the database can page it correctly.
- **Opening hook:** "Design question: a 200-entry ZIP lands in your library. Is that one
  row in your timeline, or 200?"
- **Key insight:** Rows are SUBMISSIONS (what the operator uploaded), and the query cost
  is CONSTANT — five queries per page whether the page holds 1 row or 200. Both facts
  are enforced by shape, not discipline: batch members are excluded by `batch_id IS
  NULL`, and the aggregates are grouped queries over exactly the page's ids.
- **Why should I care?:** This is the repo's canonical "collection read model" — the
  retrieval and corpus-lifecycle specs will copy this shape.

## Canonical vocabulary
`page query (UNION ALL)` → `total` → `sections aggregate` → `chunks aggregate` → `member-status aggregate` — the five, in that order.

## Screens (5)
1. Hook + HERO: the five-query animation. A page request arrives; five labeled query
   cards fire (page/total/sections/chunks/member-statuses); rows assemble into the
   timeline. Slider or toggle "10 rows / 50 rows" shows the SAME five cards — constant
   cost made visible.
2. Submissions, not members (research R2): the ZIP question answered. Snippet: the
   UNION ALL page query from list.ts with `WHERE batch_id IS NULL`. Callout: dedupe
   means one record per stored upload — no duplicate rows, ever.
3. The reader predicate applied to observability: the sections/chunks aggregates JOIN
   through `s.current_generation`. Snippet: the sections aggregate. Data-flow mini-anim:
   generation 1 rows counted, generation 2 (aside-written) rows greyed out — quoting the
   test that seeds gen 2 and asserts it's invisible.
4. Why member statuses need their own aggregate: the expand report says
   admitted-vs-skipped AT EXPAND TIME; what an admitted member did afterwards (ingested?
   failed?) lives only on the member source row. Snippet: the entrySummary assembly.
   Real data callout: `export-mixed.zip → 4 entries: 2 ingested · 2 skipped · 0 failed`
   (evidence.md live run).
5. Quiz + handoff to Module 3 (the page you actually see).

## Code Snippets (verbatim — do not modify)
- `apps/api/src/ingestion/list.ts` — the UNION ALL page query (the `db.execute(sql\`…\`)`
  block with the "sorting … is the database's job" comment).
- `apps/api/src/ingestion/list.ts` — the sections aggregate (JOIN on
  `ds.generation = s.current_generation`).
- `apps/api/test/ingestion-list.contract.test.ts` — the "CURRENT-generation counts only"
  test's seeding lines (gen 1 ×2 sections / gen 2 ×1, with the aside-written comment).

## Interactive Elements
- [x] HERO: five-query constant-cost animation with page-size toggle
- [x] Data-flow animation: generation filter (gen 1 counted, gen 2 ghosted)
- [x] Code↔English translations on both SQL snippets
- [x] Quiz (1): "A re-ingest is writing generation 3 aside while the listing loads. What
  do the counts show?" → correct: "Generation 2's counts — the aggregates join on
  current_generation, so gen 3 is invisible until the flip" (options: mixed gen2+gen3 /
  gen2 only / an error because the source is locked).
- [x] Glossary tooltips: reader predicate, N+1, UNION ALL, entry report

## Connections
- Previous: Module 1 (why the listing exists). Next: Module 3 (the web surface).
- Accent: violet. Actors: `goblin-page.html`, `export-mixed.zip`, the live batch summary
  `4 entries: 2 ingested · 2 skipped · 0 failed`.
