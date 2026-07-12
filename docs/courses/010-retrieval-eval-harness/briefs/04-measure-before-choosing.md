# Module 4: Measure Before Choosing

Write to: `modules/04-measure-before-choosing.html` — a single `<section class="module" id="module-4">` only.
THIS IS THE COURSE CENTERPIECE — it carries the mandatory hero animation and the most visual weight of any module.

## AUDIENCE OVERRIDE (course-wide — repeat verbatim in every brief)
Skilled, time-poor developer. No CS-fundamentals tooltips. DO tooltip on first use the
DOMAIN terms this module introduces — one crisp sentence each, with the governing
Principle/FR in parentheses. Crisp developer metaphors only.
Terms: `eval run` ("gold set × named config, executed as real engine searches, metrics per pinned contract — D11"), `gold snapshot` ("the items AS EVALUATED, copied onto the run row — later re-labeling can't rewrite history"), `recall@k / MRR / nDCG@10` ("the pinned metric trio — definitions live in contracts/metrics.md and may never silently change"), `CI floor` ("the deterministic fixture eval inside pnpm verify; below the pinned floor = build fails — SC-004").

## Teaching Arc
- **Metaphor:** A dyno for the search engine. You don't ship an engine mod because it 'feels faster' — you strap it to the dyno, one change at a time, and the printout goes in the file. The CI floor is the dyno bolted into the build: every PR re-proves the baseline.
- **Opening hook:** "RRF or weighted fusion? α 0.5 or 0.7? Rerank on? The constitution's answer: you don't get an opinion — you get a measurement."
- **Key insight:** The harness runs REAL searches (each leaving its own origin-eval receipt), pins the gold snapshot and the resolved config on the run row, and computes metrics whose definitions are contractual — so two runs are comparable forever, one variable at a time.
- **Why should I care?:** D11 makes eval-justified choice constitutional; this module is why the shipped defaults cite receipts, and why breaking fusion fails CI naming the metric.

## Canonical vocabulary
`create (snapshot + running)` → `enqueue (D12)` → `execute (real searches)` → `metrics per slice` → `completed (exactly once)` → `compare`

## Screens (6)
1. Hook + HERO data-flow animation: POST /api/evals/runs → eval_runs row (running) → jobs table → worker → engine (×N questions, each a receipt) → metrics land → completed. Steps labelled with canonical vocabulary.
2. Snapshot pinning: translation block on run-eval.ts createEvalRun (gold snapshot) + the exactly-once refusal; callout: 're-labeling after the run changes nothing retroactively' (proven in a test that brutally rewrites every question).
3. The metrics: translation block on metrics.ts (outcomeOf + ndcgAt10 incl. unresolvable exclusion); callout: definitions transcribed from contracts/metrics.md — changing one is a contract change, not a refactor.
4. The CI floor: translation block on ci-floor.test.ts (floor doc-comment + the pinned expectations + probe line); REAL values: tuning r@5 1.000 / MRR 0.944 / nDCG 0.916; the bite: inverted fusion → heldout MRR 0.667 → red (evidence.md).
5. The report: the eval-report decision table as a styled comparison — the FIXTURE-baseline edition, the report's first run (rrf-default vs weighted-a05 tie; α0.7 MRR −0.111 → RRF ships because a tie resolves to the option with no calibration knob); callout: rerank ships OFF because no measurement justifies it yet. Note forward: the same dyno re-ran on a REAL corpus later and re-confirmed RRF (that story is Module 6's).
6. Quiz + handoff to Module 5 (the stage that must earn its place on this dyno).

## Code Snippets (verbatim, file:line)
**Snippet A** — `packages/retrieval/src/eval/run-eval.ts` (createEvalRun snapshot + exactly-once guard region)
**Snippet B** — `packages/retrieval/src/eval/metrics.ts` (outcomeOf + the unresolvable doctrine header)
**Snippet C** — `packages/retrieval/src/eval/ci-floor.test.ts` (header + floor assertions)

## Interactive Elements
- [x] HERO data-flow animation (screen 1)
- [x] Code↔English translations — A, B, C
- [x] Quiz — 3: (1) why does each eval question leave a retrieval run (receipts compose: metrics are auditable down to individual searches); (2) gold item re-labeled after a run — do the run's metrics change (no: the snapshot pinned history); (3) what happens in CI if someone 'improves' fusion and heldout MRR drops below the floor (build fails naming the metric — SC-004).
- [x] Callouts — accept-then-async for eval runs (Principle IV/D12); slices never blend (FR-013).
- [x] Glossary tooltips.

## Connections
- **Previous:** Module 3 — the labels being measured.
- **Next:** Module 5 "The Optional Specialist" — the reranker, measured before adopted.
- **Tone/style:** accent #ea580c; REAL run ids 6e05e95f…, b1cf8bae…, b0079b04… (the report's receipts).
