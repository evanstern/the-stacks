# Module 2: Detection Dispatch — How a Confidence Floor Keeps the Peace

Write to: `modules/02-detection-dispatch.html` — `<section class="module" id="module-2">` only.

## AUDIENCE OVERRIDE (course-wide)
Skilled, time-poor developer. No CS-fundamentals tooltips. DO tooltip on first use here:
`confidence floor` ("a deliberately low, flat score a fallback plugin always returns for
its accepted types — high enough to win when nothing else claims a source, never high
enough to outbid a real detector"), `tie-break by registration order` ("a deterministic
rule: when two plugins report equal confidence, the one registered first wins — never
ambiguous, never random"), `candidates map` ("every consulted plugin's confidence, kept on
the winning decision — so an operator can see WHY a plugin won, not just that it did").

## Teaching Arc
- **Metaphor:** A hiring panel with a house rule: the most qualified candidate wins, but if
  two tie, seniority breaks it — and every candidate's score is written down, not just the
  winner's. Nobody has to guess why someone got the job.
- **Opening hook:** "Upload a plain HTML file that isn't from D&D Beyond. Three plugins in
  the registry technically COULD parse it. Exactly one will claim it — and the decision is
  provable, not a coin flip."
- **Key insight:** Detection is not "the first plugin that says yes" — every accepting
  plugin is asked, every answer is recorded, and the registry — not the plugin — picks
  the winner. Plugins can't cheat the ranking by returning inflated confidence; a fallback
  claiming everything at 0.1 can never beat a real detector's 0.85+.
- **Why should I care?:** This is the exact mechanism that lets Module 6's demo-format
  plugin get added later with zero risk of accidentally hijacking traffic meant for
  ddb-saved-html — the floor is structural, not a promise.

## Canonical vocabulary (use identically everywhere in this module)
`accepts filter` → `detect() per candidate` → `highest confidence wins` → `ties break by
registration order` → `winning decision recorded` (plugin, version, confidence,
candidates map)

## Screens (5)
1. Hook + a live example (HERO: **data-flow animation**, see Interactive Elements) using
   the REAL registry decision from evidence.md: uploading `plain-article.html` — ddb-saved-html
   answers `0`, generic-html answers `0.1`, generic-html wins.
2. Code↔English on Snippet A (the dispatch loop) — walk the strictly-greater-than
   comparison and why it preserves first-registered winners on ties.
3. The shipped lineup and WHY order matters — Snippet B (`shipped.ts`). Callout ("aha!"):
   *ddb-saved-html is registered FIRST not because it's "special" in code, but because
   registration order IS the tie-break rule — put fallbacks first and a coin-flip tie
   could hand a real DDB page to generic-html.*
4. Two real decisions side by side, from the SAME evidence.md run: the goblin page
   (ddb-saved-html @ 0.95) vs. plain-article.html (generic-html @ 0.1, ddb-saved-html
   recorded at exactly `0`, not "low" — the honesty of the candidates map). Callout: *0
   isn't "didn't check" — ddb's detect() ran, looked for its signals, and truthfully found
   none.*
5. Quiz + handoff to Module 3: "Detection just picked a winner. Module 3 shows the whole
   run this decision kicks off — the actual ingest, seam to seam."

## Code Snippets (verbatim — do not modify)

**Snippet A** — File: `packages/ingestion/src/registry.ts` (lines 42-65, the dispatch loop)
```ts
    detect(input) {
      const candidates: Record<string, number> = {};
      let winner: IngestionPlugin | null = null;
      let winning = 0;

      for (const plugin of plugins) {
        if (!plugin.accepts.includes(input.mediaType)) continue;
        let confidence = 0;
        try {
          confidence = plugin.detect(input).confidence;
        } catch {
          confidence = 0; // plugin bug — scored as "not mine", surfaced by conformance
        }
        candidates[plugin.name] = confidence;
        // Strictly-greater keeps the first-registered winner on ties.
        if (confidence > winning) {
          winner = plugin;
          winning = confidence;
        }
      }

      if (!winner || winning <= 0) return null;
      return { plugin: winner, confidence: winning, candidates };
    },
```

**Snippet B** — File: `packages/ingestion/src/shipped.ts` (full file)
```ts
/**
 * The SHIPPED plugin lineup (008 FR-028) — the one place the in-tree plugin
 * list is wired (research R13's in-tree packaging decision). Registration
 * ORDER is load-bearing: specific plugins before fallbacks, because the
 * registry breaks confidence ties by order (registry.ts). ddb-saved-html
 * goes first (it's the only plugin that ever claims text/html above the
 * 0.1 floor); markdown and generic-html are the US4 fallbacks, each the sole
 * claimant of its own media types, so their relative order doesn't matter.
 *
 * US5's demo plugin is test-only and deliberately NOT in this list.
 */
import { ddbSavedHtmlPlugin, genericHtmlPlugin, markdownPlugin } from "@stacks/ingestion-plugins";

import type { PluginRegistry } from "./registry";
import { createRegistry } from "./registry";

export function createShippedRegistry(): PluginRegistry {
  return createRegistry([ddbSavedHtmlPlugin, markdownPlugin, genericHtmlPlugin]);
}
```

**Snippet C** — the REAL `detect` event detail, verbatim from this cycle's live validation
(evidence.md / this session's curl run against `plain-article.html`, ticket
`511d0240-fb33-4496-9097-e36789c9ac12`):
```json
{
  "plugin": "generic-html",
  "version": "1.0.0",
  "candidates": { "generic-html": 0.1, "ddb-saved-html": 0 },
  "confidence": 0.1
}
```

## Interactive Elements
- [x] **Data-flow animation (HERO, screen 1)** — actors: Uploaded file, ddb-saved-html,
  markdown, generic-html, Registry. Steps: file arrives (mediaType: text/html) → registry
  filters to html-accepting plugins → ddb-saved-html.detect() → `0` → markdown skipped
  (wrong accepts) → generic-html.detect() → `0.1` → registry picks generic-html (only
  nonzero) → decision + candidates map recorded. Label each step with its outcome value.
- [x] **Code↔English translations** — Snippets A and B.
- [x] **Callout boxes** — as scripted in Screens #3 and #4.
- [x] **Quiz** — 3 questions:
  1. "Two plugins both report confidence `0.6` for the same file. Which wins, and why is
     that NOT arbitrary?" (Whichever is registered first in `shipped.ts` — the ORDER is
     the tie-break rule, deterministic and documented, not a coin flip.)
  2. "A plugin's `detect()` throws an exception on a weird input. What confidence does the
     registry record for it?" (`0` — a throwing detect is treated as "not mine," not a
     crash; conformance testing is what actually catches this as a plugin bug.)
  3. "Given Snippet C's real candidates map, could `ddb-saved-html` ever have won this
     particular upload instead of `generic-html`?" (No — its own detect() genuinely found
     no DDB identity signal in `plain-article.html` and returned exactly 0; the map isn't
     hiding a near-miss.)
- [x] **Glossary tooltips** — the three domain terms from the AUDIENCE OVERRIDE.

## Reference Files to Read
- `references/content-philosophy.md` (all) — with AUDIENCE OVERRIDE.
- `references/interactive-elements.md` → "Message Flow / Data Flow Animation", "Code ↔
  English Translation", "Multiple-Choice Quiz", "Callout Boxes", "Glossary Tooltips".

## Connections
- **Previous:** Module 1 "The Pipeline & The Plugin Seam" — the contract these plugins
  all implement identically.
- **Next:** Module 3 "Anatomy of an Ingest" — the full run this decision is step one of.
- **Tone/style:** violet accent (matches Module 1); the real ticket id
  `511d0240-fb33-4496-9097-e36789c9ac12` and the exact JSON from Snippet C are from this
  cycle's live validation — use them verbatim, don't restate as prose-only.
