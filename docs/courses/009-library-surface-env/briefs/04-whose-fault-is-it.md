# Module 4: Whose Fault Is It? (The Honest 400)

Write to: `modules/04-whose-fault-is-it.html` — a single `<section class="module" id="module-4">` only.

## AUDIENCE OVERRIDE (course-wide — repeat verbatim in every brief)
Skilled, time-poor developer. No CS-fundamentals tooltips. DO tooltip on first use:
`DomainError` ("the transport-agnostic typed error @stacks/core defines — four classes,
mapped to HTTP exactly once at the API edge — 007 FR-011/018"), `error envelope` ("the
one non-2xx wire shape {error:{code,message}} every route answers with"),
`FST_ERR_VALIDATION` ("Fastify's error code when a request violates a route's declared
schema"), `clamping` ("answering an in-range-but-extreme numeric with the nearest honest
value instead of refusing").
Crisp developer metaphors only.

## Teaching Arc
- **Metaphor:** Triage at the door. Every failed request gets blamed on exactly one
  party: you asked for a thing that doesn't exist (404), a thing we don't handle (415),
  you're not signed in (401), our dependency is down (503), we broke (500) — and now:
  your request's SHAPE is wrong (400). Honest blame is the whole design.
- **Opening hook:** "`GET /api/uploads?limit=nope` — before 009, that answered 500 'An
  internal error occurred.' Whose fault does that claim it is?"
- **Key insight:** A closed error taxonomy stays closed by distinguishing DOMAIN classes
  (shared, transport-agnostic, four of them) from BOUNDARY codes (API-only:
  `unauthorized`, now `invalid_input`). Malformed input is a boundary concern — only
  HTTP can have malformed requests — so the fix extends the EDGE mapping, not the
  shared vocabulary.
- **Why should I care?:** The next time a route needs schema validation, the 400 path
  already exists; and the clamp-vs-refuse line (coercible-but-extreme → clamp;
  uncoercible/negative → refuse) is now precedent.

## Canonical vocabulary
`DomainError classes (4, closed)` → `boundary codes (unauthorized, invalid_input)` → `app.ts mapping (the one seam)` → `clamp vs refuse`

## Screens (4)
1. Hook + HERO: the triage animation — requests walk to the door, each stamped with its
   honest status (`limit=nope`→400, unknown id→404, PDF→415, no cookie→401, DB down→503).
   Before/after toggle: pre-009, `limit=nope` walks to the 500 pit.
2. The hazard: Fastify validation errors carried statusCode 400 but fell through app.ts
   to the scrubbed 500 catch-all. Snippet: the new FST_ERR_VALIDATION branch with its
   why-comment. Code↔English.
3. Boundary codes vs domain classes: snippet of errors.ts's ApiErrorCode + the header
   comment explaining why invalid_input joins unauthorized OUTSIDE the shared union.
   Callout: the real envelope from the live run:
   `{"error":{"code":"invalid_input","message":"querystring/limit must be integer"}}`.
   Then the clamp line: `limit=9999` → 200 with limit 200; `limit=0` → 200 with limit 1;
   `limit=nope` / `offset=-1` → 400. Honest requests get honest nearest answers;
   malformed requests get honest refusals.
4. Quiz + handoff to Module 5 (Part B: the worktree protocol).

## Code Snippets (verbatim — do not modify)
- `apps/api/src/app.ts` — the FST_ERR_VALIDATION branch (with its comment).
- `apps/api/src/errors.ts` — `ApiErrorCode` type + `STATUS_BY_CLASS` (and the 009 header
  comment paragraph).
- `apps/api/src/ingestion/list.ts` — `LIST_QUERY_SCHEMA` + the clamp line with the
  "0 and 9999 are honest requests" comment.

## Interactive Elements
- [x] HERO: triage/door animation with before/after toggle
- [x] Code↔English on the app.ts branch
- [x] Callout: real 400 envelope from evidence.md quickstart A6
- [x] Quiz (1): "Why is invalid_input NOT added to @stacks/core's ErrorClass?" → correct:
  "Only the HTTP edge can have malformed requests — worker/db code can never throw it, so
  it lives with the mapping as an API-only code, like unauthorized" (options: to avoid a
  breaking change / because core can't import Fastify / because only the edge can have
  malformed requests).
- [x] Glossary tooltips: DomainError, error envelope, FST_ERR_VALIDATION, clamping

## Connections
- Previous: Module 3. Next: Module 5 (ports by arithmetic).
- Accent: violet.
