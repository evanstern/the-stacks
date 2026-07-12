# Module 6: The Day-One Finding

Write to: `modules/06-day-one-finding.html` — a single `<section class="module" id="module-6">` only.

## AUDIENCE OVERRIDE (course-wide — repeat verbatim in every brief)
Skilled, time-poor developer. No CS-fundamentals tooltips. DO tooltip on first use the
DOMAIN terms this module introduces — one crisp sentence each, with the governing
Principle/FR in parentheses. Crisp developer metaphors only.
Terms: `AND semantics` ("websearch_to_tsquery requires EVERY term; one absent word = no FTS match — a known engine characteristic, recorded in the eval report"), `measure before choosing` ("D11: no tuning change ships without a measurement receipt — even when the fix looks obvious").

## Teaching Arc
- **Metaphor:** The smoke detector that went off during the housewarming party. Annoying? No — it's the proof it works. The harness's first live eval run scored ZERO, and that zero is the best evidence in the whole cycle.
- **Opening hook:** "Search 'riposte': rank 1 in 90 milliseconds. Ask 'how does a riposte work': nothing. Same passage, same engine, same day. The eval run scored it honestly: recall 0."
- **Key insight:** Two mechanisms conspired — 'work' defeated the FTS AND, and the question-vs-whole-page cosine fell under the 0.3 floor — and instead of hiding it, the system RECORDED it: the receipt, the eval run, the report entry, and TASK-10's first question. The obvious 'fix' (lower the floor) is exactly what D11 forbids shipping unmeasured — so it wasn't shipped unmeasured: TASK-10 built a 41-item gold set over a REAL corpus, swept the floor (0.3 / 0.2 / 0.15 / 0.0), found the knee at 0.2, and only then changed the default — with run-id receipts.
- **Why should I care?:** This is what the whole apparatus is FOR. A retrieval stack that can prove it failed is one you can improve deliberately; one that can't is one you tune by vibes. The loop closed exactly as designed: observe → measure → change WITH receipts.

## Canonical vocabulary
`observe (live receipts)` → `measure (eval run, recall 0)` → `record (report + evidence)` → `defer (TASK-10, with data to gather)` → `close (real-corpus measurement; floor 0.3→0.2 with receipts)`

## Screens (6)
1. Hook + data-flow animation replaying the live walkthrough: upload → ingest → 'riposte' hit (0.09s) → paraphrase hit (vector 0.316) → gibberish honest-empty → the question that missed.
2. The two mechanisms side by side: the fixture corpus's own AND-semantics comment (corpus.ts paraphrase-map doc) as a translation block; callout with the live numbers.
3. What the system did about it: the evidence trail (receipt → eval run → report → TASK-10) — 'the harness earning its keep' (evidence.md heading verbatim).
4. Why not just lower the floor THAT AFTERNOON: callout on D11 — a 1-item gold set on a 1-chunk corpus justifies nothing; TASK-10 gathers the data that will.
5. TASK-10 closes the loop (the payoff screen): the real-corpus measurement — 41-item gold set (31 tuning / 10 heldout) over a real saved Monster Manual page (36 chunks, ingested by ddb-saved-html) + the Emberfall homebrew page; floor sweep table from the CURRENT eval report (0.3: r@5 0.935/MRR 0.871 — misses are EXACTLY the two riposte natural-questions; 0.2: r@5 1.000/MRR 0.898; 0.0: MRR 0.882 — REGRESSION, weak matches outrank true answers). Measured cosines: 'riposte' 0.161, 'how does a riposte work' 0.209 vs floor 0.3. Default changed 0.3→0.2 WITH receipts (run ids 7be1e7a6…, a2354392…, 53cf40a3…). Bonus finding: real data also exposed two engine bugs the fixtures never could (ddb detect vs >64KiB-preamble saved pages; the worker never calling complete()) — measured validation pays twice. Snippet C (config.ts floor comment) is this screen's translation block.
6. Quiz + course close: what 010 handed the next specs (Quick Ask lands on receipts + engine; the harness guards every future tuning change; rerank measurement → TASK-11).

## Code Snippets (verbatim, file:line)
**Snippet A** — `packages/retrieval/src/eval/fixture/corpus.ts` (the PARAPHRASE_TARGETS doc-comment — AND semantics recorded at fixture level)
**Snippet B** — `docs/eval-reports/010-retrieval-baseline.md` ("## Answer 2 — the floor: 0.3 was too high; 0.2 is the measured knee" — quote the mechanism bullets as a styled quote, cite the file)
**Snippet C** — `packages/retrieval/src/config.ts` (the minSimilarity line with its "Floor lowered 0.3 → 0.2 on real-corpus evidence" why-comment)

## Interactive Elements
- [x] Data-flow animation (screen 1, the real walkthrough beats)
- [x] Code↔English translations — A and C (B renders as a styled quote, not a translation block)
- [x] Quiz — 3: (1) name both mechanisms behind the miss (FTS AND semantics; similarity floor); (2) why didn't we lower RETRIEVAL_MIN_SIMILARITY that afternoon (D11 — no measurement on meaningful data justifies it; TASK-10 gathered that data first, THEN the default moved); (3) floor 0.0 scored WORSE than 0.2 on MRR — why (with no floor, weak vector matches surface above the true answer; the floor earns its keep, it was just set too high).
- [x] Callouts — 'the harness earning its keep' (evidence.md heading verbatim); the CI floor keeps guarding the fixture baseline at its OWN pinned 0.3 floor (constructed hash geometry ≠ real MiniLM — decoupled on purpose).
- [x] Glossary tooltips.

## Connections
- **Previous:** Module 5 — the last piece of the machine.
- **Next:** none (course close: hand-off line to the retrieval wiki note + TASK-11).
- **Tone/style:** accent #ca8a04; REAL values ONLY: 0.09s, vector 0.316, recall 0, cosines 0.161/0.209/0.542, r@5 0.935→1.000, MRR 0.871→0.898 (0.0 floor: 0.882), run ids from evidence.md and the current eval report — never invent numbers.
