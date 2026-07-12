# Module 3: Answer Keys That Survive

Write to: `modules/03-answer-keys.html` — a single `<section class="module" id="module-3">` only.

## AUDIENCE OVERRIDE (course-wide — repeat verbatim in every brief)
Skilled, time-poor developer. No CS-fundamentals tooltips. DO tooltip on first use the
DOMAIN terms this module introduces — one crisp sentence each, with the governing
Principle/FR in parentheses. Crisp developer metaphors only.
Terms: `gold item` ("a question + the passages whose text ALONE answers it — the eval program's ground truth, FR-011/012"), `content-hash reference` ("expected passages referenced by sha256(content), resolved server-side at labeling — research R6"), `auto-heal` ("identical re-ingested text keeps the hash alive under a new chunk id — no flag"), `held-out split` ("items excluded from tuning metrics; they exist to validate the final choice — FR-013").

## Teaching Arc
- **Metaphor:** A teacher's answer key written against the CONTENT of the textbook, not its page numbers. New edition, same paragraph → the key still works. Paragraph rewritten → the key flags itself for re-grading instead of silently marking students wrong.
- **Opening hook:** "You labeled 40 questions last month. Today you re-ingested three sources. How many labels are now lies? Answer: exactly the flagged ones — and zero of them will silently score as misses."
- **Key insight:** Referencing by content hash makes label staleness DETECTABLE and self-healing; making splits immutable makes the holdout trustworthy.
- **Why should I care?:** Every eval number in Module 4 is only as honest as these labels; the split rule is what stops you from grading yourself on questions you tuned against.

## Canonical vocabulary
`label (resolve hashes)` → `split assigned (immutable)` → `re-ingest` → `auto-heal | flag` → `re-label`

## Screens (5)
1. Hook + data-flow animation: label → re-ingest (identical) → auto-heal; label → re-ingest (rewritten) → flag → re-label.
2. Server-side resolution: translation block on gold.ts resolveExpectedPassages (incl. the current-generation refusal — 'a label a reader can't retrieve would be a lie at birth').
3. The derivation twin: translation block on RECONFIRM_SQL; callout tying it to Module 2's superseded query — same hash trick, opposite consumer.
4. Split immutability: translation block on the relabelGoldItem refusal (FR-013 message verbatim); callout: every-4th-item deterministic holdout — zero randomness to argue about.
5. Quiz + handoff to Module 4 (the harness consumes these labels — and pins them).

## Code Snippets (verbatim, file:line)
**Snippet A** — `packages/retrieval/src/gold.ts` (resolveExpectedPassages incl. refusal)
**Snippet B** — `packages/retrieval/src/gold.ts` (RECONFIRM_SQL)
**Snippet C** — `packages/retrieval/src/gold.ts` (the split-immutability refusal in relabelGoldItem)

## Interactive Elements
- [x] Data-flow animation (screen 1)
- [x] Code↔English translations — A, B, C
- [x] Quiz — 3: (1) why hash not chunk id (ids die at every re-ingest; content often survives); (2) why is the split immutable (moving items after tuning leaks choices into the holdout); (3) what does an eval run do with a flagged item (reports it unresolvable, excluded from denominators — never a silent miss).
- [x] Callouts — labeling standard (FR-012, shown on the page at authoring time); the '/search → label as expected' affordance.
- [x] Glossary tooltips.

## Connections
- **Previous:** Module 2 — the same content-hash trick, for receipts.
- **Next:** Module 4 "Measure Before Choosing" — the centerpiece.
- **Tone/style:** accent #059669; real live gold item from evidence: question 'how does a riposte work' (its fate is Module 6's story — foreshadow, don't spoil).
