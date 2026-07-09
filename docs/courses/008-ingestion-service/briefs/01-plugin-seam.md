# Module 1: The Pipeline & The Plugin Seam

Write to: `modules/01-plugin-seam.html` — `<section class="module" id="module-1">` only.

## AUDIENCE OVERRIDE (course-wide — repeat verbatim in every brief)
Skilled, time-poor developer. No CS-fundamentals tooltips. DO tooltip on first use the
DOMAIN terms this module introduces — one crisp sentence each, with the governing
Principle/FR in parentheses: `pure transform` ("bytes in, one fixed shape out — no side
effects, FR-014"), `NormalizedDocument` ("the one shape every plugin must produce past
transform — FR-017/018"), `structurally DB-blind` ("not a review rule — a package-boundary
lint rule fails the build if a plugin imports @stacks/db, FR-014"), `anchor` ("a section's
address inside its sanitized display artifact — the citation deep-link target, Principle
III"). Crisp developer metaphors only.

## Teaching Arc
- **Metaphor:** A universal power adapter. Every country's socket is different (DDB HTML,
  Markdown, plain text, tomorrow's EPUB) — the adapter's job is to make all of them fit
  ONE plug shape on the other side. `NormalizedDocument` is that one plug shape; plugins
  are the adapters.
- **Opening hook:** "A D&D Beyond saved page, a Markdown file, and a plain-text note walk
  into a pipeline. By the time they reach chunking, the pipeline can't tell them apart —
  and that's the entire design."
- **Key insight:** Past the `transform` stage, the pipeline sees exactly ONE shape,
  forever. Everything downstream (chunking, embedding, indexing) was written once,
  against that shape, and never needs to change when a new source format shows up.
- **Why should I care?:** This is the difference between "add a new file type" being a
  pipeline-core change (risky, touches tested code) and being a self-contained plugin
  (safe, provably isolated — see Module 6's extensibility proof).

## Canonical vocabulary (use identically everywhere in this module)
`intake` → `detect` → `extract` → `transform` → `chunk` → `embed` → `index` → `commit`

## Screens (5)
1. Hook + **pipeline map** (HERO): the eight-stage sequence above as a horizontal flow
   diagram, with a small badge on `extract`/`transform` noting "one plugin call, two
   observed stages" (a preview of Module 3).
2. The plugin contract, Code↔English on Snippet A (the `IngestionPlugin` interface shape
   — describe it narratively since the actual TS interface lives in
   `packages/ingestion-contract/src/plugin.ts`; quote the `NormalizedDocument` shape from
   Snippet B instead, which is the more teachable artifact). Callout: *plugins declare
   identity+version, detect with confidence, transform to ONE shape — nothing else.
   FR-013.*
3. The wall: Snippet C — the package doctrine comment from
   `ingestion-plugins/src/index.ts`. Callout ("aha!"): *"structurally unable to import
   @stacks/db" isn't a promise, it's `scripts/check-boundaries.mjs` failing your build.
   FR-014 is enforced by a linter, not a code reviewer's memory.*
4. Three real plugins, one shape: show `ddbSavedHtmlPlugin`, `markdownPlugin`,
   `genericHtmlPlugin` side by side — same interface, wildly different internals (cheerio
   selectors vs. ATX-heading regex vs. generic DOM walk). Point at the shared
   `NormalizedDocument` output as what makes this work.
5. Quiz + handoff to Module 2: "Three plugins can all claim the same uploaded file. Who
   wins, and how is the decision made honest?"

## Code Snippets (verbatim — do not modify)

**Snippet A** — File: `specs/008-ingestion-service/contracts/plugin-contract.md` (lines 14-29, the interface shape — quote as a fenced `ts` block, it is documentation not source, but IS the contract plugins are held to)
```ts
interface IngestionPlugin {
  readonly name: string;
  readonly version: string;
  readonly accepts: readonly string[];
  readonly chunkingHints?: ChunkingHints;
  detect(input: DetectInput): DetectResult;
  transform(input: TransformInput): Promise<NormalizedDocument>;
}
```

**Snippet B** — File: `specs/008-ingestion-service/contracts/normalized-document.md` (lines 17-24, the pivotal shape)
```ts
interface NormalizedDocument {
  contractVersion: string;
  title: string;
  language?: string;
  sections: Section[];
  artifacts: DisplayArtifact[];
  warnings: string[];
}
```

**Snippet C** — File: `packages/ingestion-plugins/src/index.ts` (full file header, lines 1-15)
```ts
/**
 * @stacks/ingestion-plugins — the shipped ingesters for spec 008 (FR-028):
 * ddb-saved-html (flagship), markdown, generic-html (fallbacks), plus the
 * test-only demo-format plugin that proves the extensibility promise (SC-007).
 *
 * DOCTRINE (FR-014, the seam that makes "write a new ingester" a small task):
 * everything in this package is a PURE TRANSFORM — bytes in, NormalizedDocument
 * out. Nothing here may import @stacks/db, @stacks/core, @stacks/ingestion, or
 * any HTTP/model client; the only internal dependency is the contract package.
 * scripts/check-boundaries.mjs rule 4 fails the build otherwise. Parsing libs
 * (cheerio, sanitize-html) live here and ONLY here (rule 5).
 *
 * Fixtures under fixtures/ are synthetic look-alikes exercising DDB-shaped
 * structure without any proprietary text (constitution Principle I, FR-024).
 */
```

## Interactive Elements
- [x] **Pipeline map (HERO, screen 1)** — static/lightly-animated horizontal flow of the
  eight canonical stages; hovering a stage shows its one-line job.
- [x] **Code↔English translations** — Snippets A, B, C.
- [x] **Quiz** — 3 questions (include the answer + why):
  1. "A plugin's `transform()` tries to call `fetch()` to look up extra metadata. What
     happens?" (Nothing reaches the network in production either — but more importantly,
     it's disallowed by contract; the conformance suite's network guard makes this an
     immediate test failure, not a silent violation.)
  2. "Why is `NormalizedDocument.sections` allowed to be empty?" (An honest "nothing
     ingestible" outcome — FR-017/invariant 6 — is different from a plugin silently
     producing zero passages; the driver records `status: empty`, not `ingested`.)
  3. "Why does `DisplayArtifact.kind` only ever say `\"html\"`, even for a Markdown
     source?" (The archive viewer always renders the SANITIZED artifact, never raw bytes
     — Principle III's citation deep-link target is one safe shape regardless of source
     format.)
- [x] **Glossary tooltips** — the four domain terms from the AUDIENCE OVERRIDE.

## Reference Files to Read
- `references/content-philosophy.md` (all) — with AUDIENCE OVERRIDE.
- `references/interactive-elements.md` → "Code ↔ English Translation", "Multiple-Choice
  Quiz", "Callout Boxes", "Glossary Tooltips".

## Connections
- **Previous:** none — this opens the course.
- **Next:** Module 2 "Detection Dispatch" — how the pipeline picks which plugin owns a
  given upload.
- **Tone/style:** violet accent (distinct from 007's teal, signaling "the next layer up").
  No actors yet — this module is architecture, not a trace.
