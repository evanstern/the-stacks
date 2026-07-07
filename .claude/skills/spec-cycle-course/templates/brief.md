# Module N: <Module Title>

Write to: `modules/NN-slug.html` — a single `<section class="module" id="module-N">` only.
<Delete unless true:> THIS IS THE COURSE CENTERPIECE — it carries the mandatory hero
animation and the most visual weight of any module.

## AUDIENCE OVERRIDE (course-wide — repeat verbatim in every brief)
Skilled, time-poor developer. No CS-fundamentals tooltips. DO tooltip on first use the
DOMAIN terms this module introduces — one crisp sentence each, with the governing
Principle/FR in parentheses. List them here: `<term>` ("<one-line gloss> — <Principle/FR>"),
… Crisp developer metaphors only.

## Teaching Arc
- **Metaphor:** <One strong, load-bearing metaphor the whole module hangs on.>
- **Opening hook:** "<A concrete, second-person moment that makes the reader want the answer.>"
- **Key insight:** <The one durable idea. If they remember nothing else, this.>
- **Why should I care?:** <What this pattern unlocks / how future features reuse it.>

## Canonical vocabulary (use identically everywhere in this module)
<e.g. the ordered sequence of states/events/steps this module teaches:>
`<step-1>` → `<step-2>` → `<step-3>` → …

## Screens (N)
1. Hook + <HERO element, e.g. the mandatory animation>.
2. <Beat — what's on screen, which snippet, the "aha" callout.>
3. <Beat …>
N. Quiz + handoff to the next module.

## Code Snippets (verbatim — do not modify)
<One block per snippet. COPY from source; never paraphrase. Cite file:line. The source must
already teach (Principle VIII comment pass) — if a snippet needs a comment, fix the SOURCE.>

**Snippet A** — File: `<path/to/file.ts>` (<what it is>, lines ~NN-NN)
```ts
<verbatim code, comments intact>
```

**Snippet B** — File: `<path>` (lines ~NN-NN)
```ts
<verbatim code>
```

## Interactive Elements
<Check the ones this module uses; delete the rest. Every animation must earn its place.>
- [ ] **Group-chat animation** — actors: <list>. Flow (numbered messages):
  1. <Actor> → <Actor>: "<message>"
  2. …
- [ ] **Data-flow animation** — actors: <list>. Steps keyed to the canonical vocabulary above,
  each step LABELLED with its step/event name so the animation IS the trail.
- [ ] **Code↔English translations** — Snippets <which>.
- [ ] **Quiz** — 3 questions (include the answer + why):
  1. <Trace/scenario/architecture question> (<answer + reasoning>)
  2. …
- [ ] **Callout boxes** — <the "aha" asides, tied to a Principle/invariant>.
- [ ] **Glossary tooltips** — <the domain terms from the AUDIENCE OVERRIDE>.

## Reference Files to Read
<Which reference/philosophy files the renderer should load for this module, if any.>

## Connections
- **Previous:** Module N-1 "<title>" — <one-line link>.
- **Next:** Module N+1 "<title>" — <one-line link>.
- **Tone/style:** <accent color; recurring actor names; the REAL ids/timings/values from
  evidence.md this module reuses — never invented>.
