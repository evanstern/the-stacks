# Module 6: The Bug Ledger

Write to: `modules/06-bug-ledger.html` — a single `<section class="module" id="module-6">` only.

## AUDIENCE OVERRIDE (course-wide — repeat verbatim in every brief)
Skilled, time-poor developer. No CS-fundamentals tooltips. DO tooltip on first use:
`parameter expansion` ("drizzle's sql template turns a JS array into comma-joined
placeholders — shape-dependent semantics"), `TDD` ("failing test first, smallest pass,
refactor green — constitutional here, not optional"). Crisp developer metaphors only.

## Teaching Arc
- **Metaphor:** The flight recorder. Every cycle logs what actually went wrong — not to
  assign blame but because real bugs teach sharper than invented examples. These three
  happened, live, in this cycle; two were caught by tests written minutes earlier.
- **Opening hook:** "Three real bugs from this cycle. You get the code; find each one
  before the reveal."
- **Key insight:** The bugs cluster where SEMANTICS DEPEND ON VALUE SHAPE — an array in
  a sql template, a `$` in a replacement string, a text node split by JSX. The defense
  each time was the same: a test that pinned the intended behavior before the code
  existed.
- **Why should I care?:** Two of the three are lying in wait in any drizzle/JS codebase
  you touch this year.

## Canonical vocabulary
`bug` → `symptom` → `mechanism` → `fix` → `test that pins it`

## Screens (5)
1. Hook: the format — spot-the-bug, then reveal (mechanism → fix → pinning test).
2. **Bug 1 — `ANY(array)` vs drizzle's array expansion.** Symptom: every listing request
   500'd the moment a page had rows. Spot-the-bug snippet: the aggregate with
   `WHERE ds.source_id = ANY(${sourceIds})`. Mechanism: drizzle expands a JS array into
   comma-joined params — valid inside `IN (…)`, garbage inside `ANY(…)`. Fix snippet:
   the `idList` helper + IN lists, with its why-comment. Pinned by: the whole listing
   contract suite (it caught this within minutes of being written).
3. **Bug 2 — the 400 that was a 500.** Symptom: `?limit=nope` answered "An internal
   error occurred." Spot-the-bug: app.ts's error handler BEFORE the fix (DomainError →
   CTP → 415 → catch-all; where do Fastify validation errors land?). Mechanism:
   FST_ERR_VALIDATION matched no branch and fell into the scrubbed 500 — an honest-status
   violation, found at design time by reading the handler. Fix: the invalid_input branch
   (Module 4's snippet, referenced not repeated). Pinned by: the malformed-paging test.
4. **Bug 3 — the `$$` that wasn't.** Symptom: a minted `.env`'s bcrypt hash read
   `OPERATOR_PASSWORD_HASH=b`. Two stacked mechanisms from the live pivot: (a) sourcing
   a file containing `HASH=$2b$10$…` lets the shell expand `$2` as a positional param;
   (b) the JS repair attempt `hash.replaceAll('$', '$$')` is a no-op — in a replacement
   string `$$` MEANS one literal `$`. Fix: function-form replacement + `split('$').join('$$')`
   (join never interprets), and the mint tool copies secrets verbatim so no human
   re-derives this. Callout: this is WHY mintEnv's parseEnv keeps values as untouched
   bytes.
5. Wrap: the ledger's lesson (shape-dependent semantics + tests-first), course summary
   strip (six modules, one line each), and the pointer onward: retrieval is the next
   spec — the listing's read-model shape is what it will build on. Quiz.

## Code Snippets (verbatim — do not modify)
- `apps/api/src/ingestion/list.ts` — the `idList` helper + its "fine for IN (...), wrong
  inside ANY(...)" comment (fix reveal for Bug 1; the buggy form shown as a diff-style
  before line).
- `apps/api/src/app.ts` — the pre-existing handler branches (for the spot-the-bug of
  Bug 2) and the FST_ERR_VALIDATION branch as the reveal.
- `scripts/worktree-env-lib.mjs` — `parseEnv`'s "values are kept verbatim" comment
  (Bug 3's structural fix).

## Interactive Elements
- [x] Spot-the-bug interaction ×3 (click-to-reveal mechanism/fix)
- [x] Code↔English on the idList fix
- [x] Quiz (1): "In JS, 'a$b'.replaceAll('$', '$$') returns…" → correct: "'a$b' — in a
  replacement string $$ is the escape for one literal $, so the call is a no-op"
  (options: 'a$$b' / 'a$b' / a SyntaxError).
- [x] Glossary tooltips: parameter expansion, TDD
- [x] Course summary strip + next-spec pointer

## Connections
- Previous: Module 5. This module closes the course.
- Accent: violet. All three bugs are from this cycle's live run (evidence.md "Notable
  implementation decisions" + commit messages d1aa4e7/9fc2afd and the pivot transcript).
