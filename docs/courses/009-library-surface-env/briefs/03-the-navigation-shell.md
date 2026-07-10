# Module 3: The Navigation Shell

Write to: `modules/03-the-navigation-shell.html` — a single `<section class="module" id="module-3">` only.

## AUDIENCE OVERRIDE (course-wide — repeat verbatim in every brief)
Skilled, time-poor developer. No CS-fundamentals tooltips. DO tooltip on first use:
`protected layout` ("the RR7 layout route every non-login route nests under — the ONE
place auth is checked, and now the ONE place nav renders — 007 R9 / 009 R5"),
`loader` ("RR7's server-side data function; the browser never calls the API — 007
FR-019"), `URL-addressable state` ("paging/state rides the URL so views are bookmarkable
— Principle V").
Crisp developer metaphors only.

## Teaching Arc
- **Metaphor:** The front desk. A library can have perfect shelves, but if the lobby has
  no signage and no librarian, visitors wander back out. The protected layout is the
  lobby — fix the signage THERE and every room inherits it.
- **Opening hook:** "The fix for 'no link to /library/upload' was NOT adding a link to
  /library/upload."
- **Key insight:** Fix the navigation MODEL, not the missing link. Because every
  authenticated route nests under one layout, a nav header there renders on every
  protected page — including pages that don't exist yet. Symptom-fixes add links;
  model-fixes make missing links structurally impossible.
- **Why should I care?:** The Evidence column pattern (per-kind rendering of a
  discriminated union) and the honest empty state are the house style for every listing
  the product grows next.

## Canonical vocabulary
`nav shell` → `listing page (/library)` → `Evidence column` → `empty state` → `paging (Showing X–Y of Z)`

## Screens (5)
1. Hook + HERO: the layout-nesting animation — routes.ts's tree renders; the nav header
   slots into protected-layout.tsx; every child page lights up with the header at once.
2. The one-place rule: snippet of the protected-layout nav JSX with its header comment
   ("the ONE place navigation renders… a page reachable only by typed URL doesn't count
   as visible"). Code↔English.
3. The Evidence column: per-kind rendering. Snippet: the `Evidence` component from
   library.tsx (batch summary branch, failed branch, awaiting-detect branch, plugin
   branch). Real render from evidence.md: `ddb-saved-html@1.0.0 · gen 1` and
   `4 entries: 2 ingested · 2 skipped · 0 failed`. Failed rows: `data-failed` +
   destructive styling — "visibly distinguished" pinned by tests.
4. Honesty at the edges: the empty state points at the upload page (a blank page lies;
   an empty library is a normal answer) and paging shows the real ledger size — live
   run: 57 submissions, `Showing 51 – 57 of 57`, Newer link only (no Older past the
   end). Note the deliberate non-feature: NO live polling here — the ticket page is the
   polling surface; the listing reflects reality at load/refresh (one polling surface is
   enough).
5. Quiz + handoff to Module 4 (what happens when the request itself is malformed).

## Code Snippets (verbatim — do not modify)
- `apps/web/app/routes/protected-layout.tsx` — the nav JSX + the "since 009, the
  navigation shell" header comment lines.
- `apps/web/app/routes/library.tsx` — the `Evidence` component (whole function).
- `apps/web/app/routes/library.tsx` — the loader's offset parsing with the
  "URL-addressable state" comment.

## Interactive Elements
- [x] HERO: layout-nesting animation (nav slots in, all children inherit)
- [x] Code↔English on the Evidence component
- [x] Callouts: "one polling surface is enough"; upload ↔ listing cross-links (US1 AC-5)
- [x] Quiz (1): "You add /library/settings next month. What nav work is needed?" →
  correct: "None — it nests under the protected layout, so the shell already wraps it"
  (options: add a link to every page / none, the layout provides it / update routes.ts AND
  each page's header).
- [x] Glossary tooltips: protected layout, loader, URL-addressable state

## Connections
- Previous: Module 2 (the data). Next: Module 4 (typed refusals).
- Accent: violet. Actors: same live ids; the 57-submission paging run.
