# Module 1: The Invisible Library

Write to: `modules/01-the-invisible-library.html` — a single `<section class="module" id="module-1">` only.

## AUDIENCE OVERRIDE (course-wide — repeat verbatim in every brief)
Skilled, time-poor developer. No CS-fundamentals tooltips. DO tooltip on first use the
DOMAIN terms this module introduces: `claim ticket` ("the {kind, id} receipt the intake
answers with before any processing — 008 accept-then-async, Principle IV"),
`visibility avenue` ("the surface a capability is seeable through — web UI when
operator-facing, CLI/logs/docs otherwise — Principle V, v2.2.0"), `submission` ("what the
operator actually uploaded: a standalone source or a batch — 009 research R2").
Crisp developer metaphors only.

## Teaching Arc
- **Metaphor:** A library with no card catalog — the books exist, shelved and indexed,
  but the only way to find one is the receipt you were handed at the door. Lose the
  receipt, and the book might as well not exist.
- **Opening hook:** "008 shipped a working ingestion pipeline — and the operator asked:
  'is there more to this than the home page?' There was. Nobody could see it."
- **Key insight:** Visibility is a property of each FEATURE, not of the system. A page
  reachable only by typed URL is invisible; a capability with no surface at all is
  incomplete. 009 exists because 008 proved that the hard way — and the constitution now
  says so (v2.2.0).
- **Why should I care?:** Every future spec is gated on declaring its visibility avenue.
  This module explains why that gate exists.

## Canonical vocabulary
`the gap` → `the amendment (v2.2.0)` → `Part A (library surface)` → `Part B (worktree protocol)` → `read-only scope line`

## Screens (4)
1. Hook: what 008 built (upload page, ticket page, pipeline) vs what the home page
   showed (nothing about any of it). HERO: a two-panel "what exists vs what you can see"
   reveal — 008's routes fade in on the left, the home page's actual nav (no library
   link) on the right.
2. The amendment: constitution v2.2.0's Principle V expansion, quoted. Callout: the
   four-line rule (web UI when operator-facing / CLI-logs-docs otherwise / spec records
   the avenue / no avenue = incomplete). Code↔English on the constitution excerpt.
3. The slice map: Part A (nav + listing + evidence columns, read-only) and Part B (the
   worktree environment protocol) — and the scope line: re-ingestion and corpus
   management stay PINNED to the corpus-lifecycle spec (operator decision 2026-07-07);
   FR-009 makes read-only an actual requirement.
4. Quiz + handoff to Module 2 (the read model behind the listing).

## Code Snippets (verbatim — do not modify)
- `.specify/memory/constitution.md` (Principle V, the four v2.2.0 bullets: "Every
  delivered capability MUST have a visibility avenue…") — cite as constitution v2.2.0.
- `specs/009-library-surface-env/spec.md` FR-009 (the read-only guard requirement).

## Interactive Elements
- [x] Two-panel exists-vs-visible reveal animation (HERO)
- [x] Code↔English translation (constitution excerpt)
- [x] Callouts: the 2026-07-07 pin; "US1's independent test: no URL typing, no DB access"
- [x] Quiz (1 question): "A worker-only capability ships with no web page. Under v2.2.0,
  is it compliant?" → correct: "Yes, IF its spec records a CLI/log/docs avenue — a web
  surface is only mandatory when the capability is operator-facing" (options: always
  non-compliant / compliant with recorded avenue / compliant because workers are internal).
- [x] Glossary tooltips: claim ticket, visibility avenue, submission

## Connections
- Next: Module 2 (the submissions timeline read model).
- Accent: violet `#6B5AE0` family (course-wide; distinct from 007 teal, 008 coral).
- Recurring actors: `goblin-page.html` (source e1779734…), `export-mixed.zip`
  (batch 2f66f4c8…) — the real ids from evidence.md's live run, reused all course.
