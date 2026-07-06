# Module 2: The Monorepo Map

Write to: `modules/02-monorepo.html` — `<section class="module" id="module-2">` only.

## AUDIENCE OVERRIDE (course-wide)
Skilled, time-poor developer. No CS-fundamentals tooltips (don't explain "monorepo", "package",
"import"). DO tooltip doctrine terms on first use in this module: *seam*, *walking skeleton* (brief
re-def), *D1/D2* (fixed constitutional decisions: D1 = greenfield rebuild beside the still-running
v2; D2 = TypeScript core + Python inference-only sidecar), *FR-019* (spec requirement: web consumes
the system only through the API contract). Metaphors crisp, dev-flavored, never "restaurant."

## Teaching Arc
- **Metaphor:** Load-bearing walls. In a monorepo every package CAN import every other — the
  compiler won't stop you. Which walls are load-bearing is a *decision*, and here the decision is
  enforced by a linter-grade script that fails CI, the way a building inspector fails a permit.
- **Opening hook:** "Nothing stops `apps/web` from importing the DB schema. TypeScript would
  happily compile it. A 90-line script is the only thing standing between this architecture and
  entropy — on purpose."
- **Key insight:** Boundaries that matter are enforced mechanically, not by convention: web never
  touches `@stacks/db` (FR-019), v3 never imports v2 (D1), and model identifiers never appear in
  product code (Principle VII) — all three are lexical scans wired into `pnpm verify`.
- **Why should I care?:** When you add the next feature, the map tells you where code goes
  (domain → core, persistence → db, HTTP → api, background → worker) and the script tells you when
  you've put it somewhere illegal — at CI time, not at code-review time.

## Screens (4)
1. Hook + **HERO: architecture diagram** of the workspace (see Interactive Elements): three shared
   packages (`@stacks/core` domain vocabulary · `@stacks/db` persistence seam ·
   `@stacks/ingestion-contract` placeholder for the NEXT spec) and four apps (api, worker, web,
   ml). Show allowed dependency arrows: api→{core,db}, worker→{core,db}, web→(HTTP only!),
   ml→(nothing TS — HTTP contract only, it's Python, D2).
2. The coexistence story (2-3 sentences + small visual): v3 lives entirely under `v3/` beside the
   still-running v2 app (D1); disjoint ports (44xx/5442 vs v2's 5433/8001/5174), containers, and
   volumes — both stacks run simultaneously on one machine; retirement later = delete v2, promote
   `v3/`.
3. Code↔English: the boundary-check header (snippet A) — three rules, each pinned to doctrine.
   Callout ("aha!"): *"enforce architecture by failing CI" — same spirit as the append-only events
   table you'll meet in Module 4: invariants by construction, not by discipline.*
4. **Drag-and-drop quiz** (see below) + regular quiz question(s). Handoff: "Now that you know the
   map, let's follow one request across every seam on it."

## Code Snippets (verbatim — do not modify)

**Snippet A** — File: `v3/scripts/check-boundaries.mjs` (lines 1-19, header)
```js
#!/usr/bin/env node
// Fails the build on structural boundary violations the type system can't
// catch on its own (FR-019, FR-005, SC-006). Run via `pnpm verify`.
//
// Three rules, each pinned to constitutional doctrine:
//   1. apps/web may not import @stacks/db or reach into api/worker/ml source
//      (FR-019): the web app is a client of the HTTP contract, nothing more.
//      TypeScript can't stop a workspace import that would quietly couple
//      the UI to the schema, so this scan does.
//   2. No v3 file may import across the v3/ root into v2 code (decision D1,
//      FR-005): v3 is a clean rebuild, not a graft. A single relative import
//      escaping v3/ would silently re-entangle the old tree.
//   3. No hardcoded model identifiers in product code (Principle VII, SC-006):
//      models are configuration, resolved env-first via @stacks/core
//      model-roles. A literal model id in source would bypass FR-013/D14's
//      fail-fast env resolution and pin deploys to one model.
// These are lexical scans over import/source text — cheap, dependency-free,
// and intentionally blunt: they enforce architecture by failing CI, in the
// same spirit as the append-only-by-construction event table.
```

**Snippet B** — File: `v3/packages/db/src/index.ts` (lines 1-7, barrel header)
```ts
/**
 * @stacks/db — the persistence seam: drizzle schemas, the pooled client,
 * boot-time migrations, and the two data disciplines of the skeleton (the
 * Postgres-backed queue, D12, and the append-only event trail, Principle IV).
 * Consumed by apps/api and apps/worker only; apps/web is forbidden from
 * importing this package (FR-019, enforced by scripts/check-boundaries.mjs).
 */
```

## Interactive Elements
- [x] **Architecture diagram (HERO)** — 7 boxes in two bands (packages band, apps band) with
  dependency arrows as described in screen 1. Use the interactive-elements architecture-diagram
  pattern if present; otherwise build with styled divs + SVG arrows. Highlight the FORBIDDEN edge
  (web→db) in a struck-through/danger style — make the absence visible.
- [x] **Code↔English translation** — Snippet A (translate the three rules into consequences: "web
  can only ever break the API contract, never the schema"; "v2 can be deleted without grep-ing v3";
  "swapping the embedding model is an env change, not a code change"). Snippet B optionally as a
  second, shorter block.
- [x] **Drag-and-drop quiz** — items: `POST /api/... route handler`, `new jobs-table helper`,
  `deriveVectorId()-style pure function`, `React run-detail page`, `sentence-transformers model id`.
  Targets: `apps/api`, `packages/db`, `packages/core`, `apps/web`, `.env / compose (config)`.
- [x] **Quiz** — 2 scenario questions:
  1. "A teammate imports `@stacks/db` in a web loader to 'save a round-trip'. What happens and
     where?" (pnpm verify fails in the boundary scan — before review; the fix is an API endpoint.)
  2. "Why does `@stacks/ingestion-contract` exist NOW if nothing implements it?" (so the next spec
     plugs new ingesters into a pre-existing seam without touching core/db — the contract's shape
     is the deliverable, versioned as 0.0.0-placeholder.)

## Reference Files to Read
- `references/content-philosophy.md` (all) — with AUDIENCE OVERRIDE.
- `references/gotchas.md` (all)
- `references/interactive-elements.md` → "Drag-and-Drop Quiz", "Code ↔ English Translation",
  "Architecture Diagram" (if present), "Multiple-Choice Quiz", "Callout Boxes", "Glossary Tooltips".

## Connections
- **Previous:** Module 1 "One Command, Five Services" — boot chain, /ready-as-proof, five services.
- **Next:** Module 3 "Anatomy of a Skeleton Check" — tracing one request across every seam on this
  map (the course's centerpiece).
- **Tone/style:** teal accent; actors Web/API/Postgres/Worker/Sidecar; engineering "we".
