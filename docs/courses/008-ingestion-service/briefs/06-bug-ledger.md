# Module 6: The Bug Ledger

Write to: `modules/06-bug-ledger.html` — `<section class="module" id="module-6">` only.
This is the FINAL module — end with a short course wrap-up screen (see Screens).

## AUDIENCE OVERRIDE (course-wide)
Skilled, time-poor developer. No CS-fundamentals tooltips. DO tooltip on first use here:
`JSON round-trip purity` ("a plugin's output must survive `JSON.parse(JSON.stringify(x))`
unchanged — a `NormalizedDocument` invariant, since persisted rows are the only thing
downstream code ever sees again"), `container-side port` ("the port a process INSIDE a
Docker container binds to — distinct from the HOST port it's mapped to; the two can silently
diverge when one is env-driven and the other is hardcoded").

## Teaching Arc
- **Metaphor:** Scar tissue, same device 007's ledger used. Five real bugs, each one only
  found by actually running the thing — type-checking and unit tests let all five through.
- **Opening hook:** "Every bug on this ledger passed `tsc --noEmit`. Two of them passed
  their own unit tests on the first try, wrong. All five were caught by doing the thing this
  course keeps insisting on: running the real system, not just reading it."
- **Key insight:** These five bugs cluster into two classes — TYPE-SYSTEM BLIND SPOTS
  (correct-looking code that a stricter check or a real run exposes as wrong) and
  ENVIRONMENT-COUPLING bugs (code that's only correct under an assumption — "the container
  always listens on port 4401" — that this cycle's OWN worktree violated). Neither class
  shows up in a diff review.
- **Why should I care?:** Bug #4 in particular — a working test suite passing against
  wrong behavior — is the single scariest bug class in software: the test agreed with the
  bug. Recognizing that shape saves you from trusting green tests too much.

## The five bugs (canonical content — one card/screen-beat each)

1. **The cheerio type that wasn't there twice.** `import type { AnyNode } from "cheerio"`
   compiled fine locally but failed `tsc --noEmit` in CI with "no exported member 'AnyNode'"
   — for the `ddb-saved-html` plugin during US1, AND AGAIN independently for the
   `generic-html` plugin during US4 (same mistake, same fix, two different files, days
   apart). Fix (snippet A): import `AnyNode` from `domhandler` directly — cheerio re-exports
   the TYPE inconsistently across its own subpath exports. Lesson: when a fix is a genuine
   scar, note WHY at the import site, or the next plugin author (or you, a week later) pays
   the same tax.
2. **The `??`/`||` that wouldn't parse.** `headings.find(h => ...)?.text ?? leadingText.slice(0, 80) || "Untitled"`
   failed to even BUILD — esbuild refuses to mix `??` and `||` without parentheses, because
   their combined precedence is ambiguous by design (JS spec, not a tooling quirk). Fix
   (snippet B): explicit parens around the `||` fallback. Lesson: `??` and `||` are never
   implicitly composable — the language itself won't guess which you meant.
3. **The plugin that couldn't be re-run.** A markdown artifact's optional `title` field, when
   omitted, was built as `{ ..., title: undefined }` — a real key with an `undefined` value.
   `JSON.stringify` drops that key; the round-trip comparison then found the object
   "different from itself," failing `NormalizedDocument`'s invariant 7 (JSON-purity) — but
   ONLY for the one fixture with no heading (headingless plain text), which is exactly why
   it passed on every OTHER fixture first. Fix (snippet C): omit the key entirely when the
   value would be `undefined`, never assign it. Lesson: `{ ...obj, maybe }` silently keeps an
   `undefined`-valued key that `JSON.stringify` doesn't — these two "empty" states aren't
   the same to a round-trip check, and a persistence-layer invariant will find the gap.
4. **The regex that quietly returned "no" instead of "yes."** A custom plugin's `detect()`
   used `/^@@\s+(.+)$/` (no `m` flag) to recognize its own file format from the document's
   first few lines. It ALWAYS returned "not mine" on real multi-line input — `^`/`$` anchor
   to the whole string's start/end without the multiline flag, not each line's — yet every
   conformance assertion about detect() passed, because the SPECIFIC test that would have
   caught it (claiming a real positive fixture) was the one that failed loudly enough to be
   noticed before merge. Fix (snippet D): add the `m` flag. Lesson: `^`/`$` without `m` is a
   single-line anchor wearing a multi-line disguise — it looks right on a one-line mental
   model and is silently wrong the moment real content has more than one line.
5. **The container that answered on the wrong port from itself.** The API service passes
   `V3_API_PORT` through as an env var its OWN process binds to — unlike the web service,
   which hardcodes a fixed internal port. But the compose file's port mapping, healthcheck,
   and the web service's internal URL to reach it ALL hardcoded the literal default (4401),
   assuming the container always listens there. Invisible in the default worktree (4401 =
   4401); fatal the moment a parallel feature worktree overrode the port — exactly the
   convention this entire multi-worktree cycle depends on. Found only by actually running
   `docker compose up --wait` in a non-default-port worktree. Fix (snippet E): every
   reference to the API's internal port now tracks the SAME env var the app itself binds to.
   Lesson: one service quietly being "the exception" (env-driven port vs. every other
   service's fixed one) is invisible until something exercises exactly that difference.

## Screens (4)
1. Hook + ledger overview: five bug cards in a grid (title, one-line symptom, one-line
   lesson) — the HERO visual. Tag each card with its class: **type-system blind spot**
   (#1, #2, #3) or **environment coupling** (#4 partially, #5 fully) — note #4 straddles
   both (a language-precedence trap AND a false-negative that passed for the wrong reason).
2. Deep-dive pair 1: bugs #3 and #4 (the two "green until you look closer" bugs) — Snippets
   C and D as Code↔English. Callout ("aha!"): *#3's fixture-specific failure and #4's silent
   false-negative are the same shape: a test suite that agrees with broken behavior is more
   dangerous than one that's simply missing. Both were caught by the SAME discipline — write
   the failing-first assertion, then genuinely watch it fail before trusting green.*
3. Deep-dive pair 2: bugs #1 and #5 (the two "worked yesterday" bugs) with snippets A and E;
   brief mention card for #2 with snippet B. Callout: *#1 happened TWICE, independently,
   across two different plugins written weeks apart — the fix note at the import site is
   what would have stopped the second occurrence, and didn't exist yet the first time.*
4. **Spot-the-bug quiz** + course wrap-up: what the ingestion pipeline proved (five user
   stories, 57 tasks, 197 tests, a live docker-compose validation that found and fixed a
   real cross-worktree infrastructure bug) and what's next (retrieval and chat, both
   building on the indexed, traceable passages this pipeline now produces). Close warm:
   "The skeleton walked. Now it can read."

## Code Snippets (verbatim — do not modify)

**Snippet A** — File: `packages/ingestion-plugins/src/html/index.ts` (lines 11-12, the fix)
```ts
import type { Cheerio, CheerioAPI } from "cheerio";
import type { AnyNode } from "domhandler";
```

**Snippet B** — File: `packages/ingestion-plugins/src/markdown/index.ts` (line 164, the fix)
```ts
    const title = headings.find((h) => h.level === 1)?.text ?? (leadingText.slice(0, 80) || "Untitled document");
```

**Snippet C** — File: `packages/ingestion-plugins/src/markdown/index.ts` (lines 94-100, the
fix)
```ts
  // `title` must be OMITTED, never `undefined` — JSON.stringify drops absent
  // keys but keeps `undefined`-valued ones out of the wire shape differently
  // from how they compare in-memory, which trips the JSON-round-trip purity
  // check (NormalizedDocument invariant 7).
  return title === undefined
    ? { id, kind: "html" as const, content: html }
    : { id, kind: "html" as const, content: html, title };
```

**Snippet D** — File: `packages/ingestion-plugins/src/demo/index.ts` (line 25, the fix)
```ts
const MARKER = /^@@\s+(.+)$/m;
```

**Snippet E** — File: `docker-compose.yml` (lines 61-67, the fix)
```yaml
      # BOTH sides must track V3_API_PORT: main.ts binds to
      # process.env.V3_API_PORT (passed through above), so unlike web's fixed
      # internal PORT=4400, the container-side port here is NOT always 4401 —
      # a worktree overriding V3_API_PORT (the spec-cycle port-block
      # convention) must move both the host mapping and the container's own
      # listen port together, or the healthcheck below probes the wrong port.
      - "127.0.0.1:${V3_API_PORT:-4401}:${V3_API_PORT:-4401}"
```

## Interactive Elements
- [x] **Bug-card grid (HERO)** — five cards as described in screen 1, tagged by class.
- [x] **Code↔English translations** — Snippets C and D in full (screen 2); A, B, E as
  compact annotated blocks (screen 3).
- [x] **Spot-the-bug quiz** — 3 questions:
  1. Show `const x = a ?? b || c;` and ask what happens. (SyntaxError at build time — `??`
     and `||` can never be mixed without explicit parens; write `a ?? (b || c)`.)
  2. "A plugin's `detect()` returns confidence `0` for every fixture that should positively
     match its own format, but the conformance suite's negative-fixture assertions all pass.
     What's the most likely bug class, and what's the first thing to check?" (A false
     negative in the matching logic itself — check anchors/flags in any regex used against
     multi-line input first; the "negative" tests passing is a red herring, since returning
     0 for everything trivially satisfies "does not claim.")
  3. "A service in a Docker Compose file has one hardcoded port in three places (mapping,
     healthcheck, a sibling service's internal URL) and ALSO reads a port env var into its
     own process. What question do you ask before touching any ONE of those three places?"
     (Does this service actually bind the port the env var says, or a fixed one? If the
     former, all three references must move together — fixing only the healthcheck, e.g.,
     just relocates the mismatch.)
- [x] **Wrap-up screen** — short, warm, forward-looking (content in Screens #4). No quiz
  here.

## Reference Files to Read
- `references/content-philosophy.md` (all) — with AUDIENCE OVERRIDE.
- `references/gotchas.md` (all)
- `references/interactive-elements.md` → "Code ↔ English Translation", "Multiple-Choice
  Quiz" (spot-the-bug uses the same machinery), "Pattern/Feature Cards", "Callout Boxes",
  "Glossary Tooltips".

## Connections
- **Previous:** Module 5 "The Honest Front Door" — the typed-error discipline these bugs
  were caught against.
- **Next:** none — this closes the course; include the wrap-up.
- **Tone/style:** amber accent (matches Module 5); actors are the plugins/files themselves,
  not a group-chat cast. All five bugs are REAL and documented in this cycle's commit
  history and `specs/008-ingestion-service/evidence.md` — keep the "this actually happened"
  register, no invented drama.
