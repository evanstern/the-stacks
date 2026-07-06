# Module 6: The Bug Ledger

Write to: `modules/06-bug-ledger.html` — `<section class="module" id="module-6">` only.
This is the FINAL module — end with a short course wrap-up screen (see Screens).

## AUDIENCE OVERRIDE (course-wide)
Skilled, time-poor developer. No CS-fundamentals tooltips. DO tooltip on first use here:
*idle-client error* ("node-postgres: an error on a pooled connection sitting idle — with no 'error'
listener, Node treats it as unhandled and kills the process"), *cross-realm* ("two copies of the
same global class from different JS realms — instanceof between them is always false").

## Teaching Arc
- **Metaphor:** Scar tissue. Every comment in this codebase that says "this is a scar, not
  speculation" marks a place the system actually broke during live validation. This module is the
  ledger of those scars — six real bugs, each caught by running the real stack, not by reading.
- **Opening hook:** "Every one of these six bugs shipped in code that type-checked, passed unit
  tests, and looked correct in review. They were caught the only way these get caught: by starting
  the real stack and watching it fail."
- **Key insight:** The bug classes here are *integration-surface* bugs — process-lifecycle,
  container-build, config-interpolation, env-plumbing, test-realm, tooling-state. A green
  typecheck says nothing about any of them. That's WHY the walking skeleton exists: it's the
  machine that finds this class of bug before features are stacked on top.
- **Why should I care?:** Each bug is a reusable lesson you'll hit again in other stacks —
  pool error listeners, compose `$` interpolation, monorepo Docker contexts, jsdom realm checks.
  Cheap to learn from someone else's ledger.

## The six bugs (canonical content — one card/screen-beat each)

1. **The process that died with the database.** Stopping Postgres crashed the whole API instead
   of surfacing 503 dependency_down. Cause: node-postgres emits 'error' on idle pooled
   connections; unhandled 'error' events kill the process. Fix (snippet A) + regression test.
   Lesson: *every* pg Pool needs an error listener; liveness ≠ resilience.
2. **The Docker build that couldn't see its own tsconfig.** Web image build failed with
   TSConfckParseError: every package's tsconfig extends `../../tsconfig.base.json`, but the
   Dockerfiles never COPY'd it. Worked locally (file exists), broke only in the image. Fix
   (snippet B). Lesson: in monorepo Docker builds, the COPY list is a *dependency declaration* —
   audit it against every `extends`/workspace reference.
3. **The password hash that compose ate.** bcrypt hashes start `$2b$10$...`; Docker Compose
   interpolates `$` in .env values, silently mangling the hash → every login fails with a correct
   password. Fix: escape as `$$` (snippet C documents it). Lesson: any secret containing `$`
   (bcrypt, argon2) is a compose-interpolation landmine; document escaping IN the env template.
4. **The run stuck at "running" forever.** Worker's compose env was missing EMBEDDING_PROVIDER;
   `resolveModelRole` threw a plain Error BEFORE the try/catch that wrote failure outcomes — the
   job silently retried while the run stayed "running". Fix: env added + a top-level catch-all
   that fails the run on ANY unexpected error (snippet D). Lesson: an error-handling gap shows up
   as *absence of failure*, the worst kind of bug; catch-alls at job boundaries are load-bearing.
5. **The test DOM from another realm.** Web tests hung: RR7's client runtime does brand checks on
   Request/AbortSignal; jsdom supplies its own realm-separated copies, so instanceof fails.
   Fix: happy-dom, which shares Node's fetch primitives (snippet E). Lesson: when a framework
   checks native brands, your test DOM must share the runtime's globals.
6. **The migration counter that lied.** `drizzle-kit generate` computes the next file prefix from
   the journal's `lastEntry.idx + 1`. A manual rename (0000→0001_init) left idx=0, so the NEXT
   migration generated as 0001 — colliding with the existing file. Found by actually running
   generate during convergence. Fix: journal idx corrected to 1 (snippet F documents the gotcha).
   Lesson: renaming tool-managed files means updating the tool's state file too; verify by
   running the tool, not by eyeballing.

## Screens (4)
1. Hook + ledger overview: six bug cards in a grid (title, one-line symptom, one-line lesson) —
   the HERO visual. Each card tagged with its bug class (process-lifecycle, container-build,
   config-interpolation, env-plumbing, test-realm, tooling-state).
2. Deep-dive pair 1: bugs #1 and #4 (the two "silence is the symptom" bugs) with snippets A & D
   as Code↔English. Callout ("aha!"): *the worst failure mode isn't a crash — it's a system that
   keeps looking busy. Both fixes convert silence into a typed, visible failure.*
3. Deep-dive pair 2: bugs #3 and #6 (the two "tool state lies" bugs) with snippets C & F; brief
   mention cards for #2 and #5 with snippets B & E as smaller blocks.
4. **Spot-the-bug quiz** + course wrap-up: what the skeleton proved (5 services one command; six
   seams crossed with a durable trail; idempotent re-runs; typed failure; boundaries enforced;
   51/51 spec tasks converged) and what's next (ingestion, retrieval, chat — each building on a
   seam you now know). Close warm: "The skeleton walks. Time to give it organs."

## Code Snippets (verbatim — do not modify)

**Snippet A** — File: `v3/packages/db/src/client.ts` (lines 28-33)
```ts
  const pool = new Pool({ connectionString });
  // node-postgres crashes the process on an unhandled idle-client error
  // otherwise; a dead DB must surface as dependency_down, not a process exit.
  pool.on("error", (err) => {
    console.error("Postgres pool error:", err);
  });
```

**Snippet B** — File: `v3/apps/web/Dockerfile` (lines 11-14)
```dockerfile
# tsconfig.base.json is copied EXPLICITLY: every tsconfig extends it, and its
# absence is invisible locally but fatal in the image build — this exact line
# was missing once and broke the web build with a TSConfckParseError.
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml tsconfig.base.json ./
```
(Note: line 14 is the real COPY; lines 11-13 are the in-repo comment — present verbatim.)

**Snippet C** — File: `v3/.env.example` (lines 12-13)
```bash
# IMPORTANT: Docker Compose interpolates .env values, so every literal `$` in
# the hash must be escaped as `$$` (e.g. `$2b$10$abc...` -> `$$2b$$10$$abc...`)
```

**Snippet D** — File: `v3/apps/worker/src/handlers/skeleton-check.ts` (lines 52-74)
```ts
  try {
    await runSkeletonCheck(db, runId);
  } catch (error) {
    // Anything NOT already handled below (e.g. a misconfigured env var
    // resolving the model role) must still fail the run — otherwise it's
    // stuck at "running" forever while only the underlying job retries.
    // This is a scar, not speculation: a missing env var once produced exactly
    // that silent hang. DomainErrors skip this — runSkeletonCheck already
    // called failRun for those; double-failing would clobber the real outcome.
    if (!(error instanceof DomainError)) {
      await failRun(
        db,
        runId,
        new DomainError({
          class: "internal_fault",
          seam: "inference",
          message: "Unexpected error before inference.",
          cause: error,
        }),
      );
    }
    // Re-throw so the poll loop also fails the JOB (retry/backoff lives there).
    throw error;
```

**Snippet E** — File: `v3/apps/web/vitest.config.ts` (lines 6-10, header excerpt)
```ts
 * environment is happy-dom, NOT jsdom, and that choice is load-bearing:
 * RR7's client runtime constructs Request/AbortSignal objects, and jsdom's
 * realm-separated globals fail RR7's instanceof/brand checks (a real
 * cross-realm bug hit during this feature). happy-dom shares Node's
 * fetch primitives, so those checks pass.
```

**Snippet F** — File: `v3/packages/db/drizzle.config.ts` (lines 7-11, header excerpt)
```ts
 * Numbering gotcha: drizzle-kit derives the next migration prefix from
 * migrations/meta/_journal.json (lastEntry.idx + 1). The journal's idx was
 * deliberately set to 1 to match the 0001_init tag after a manual file
 * rename fixed a numbering collision — don't "correct" it back to 0, or the
 * next generate will mint a duplicate prefix.
```

## Interactive Elements
- [x] **Bug-card grid (HERO)** — six cards as described in screen 1.
- [x] **Code↔English translations** — Snippets A and D in full; B/C/E/F as compact annotated
  blocks (they're mostly self-narrating comments — frame them as "the scar tissue in the code").
- [x] **Spot-the-bug quiz** — 3 questions:
  1. Show this compose-env line and a report "correct password always fails":
     `OPERATOR_PASSWORD_HASH=$2b$10$Bpd.zeX71...` — what's wrong? (unescaped `$` — compose
     interpolated the hash to fragments; write `$$2b$$10$$...`.)
  2. "A run has shown status=running for 20 minutes; the jobs row shows attempts=3,
     status=failed. Which bug pattern is this, and where's the missing code?" (bug #4's pattern:
     job failed but nothing translated it to the run — the boundary catch-all is missing/skipped.)
  3. "Your monorepo web image suddenly fails to build after someone adds `"extends":
     "../../tsconfig.strict.json"` to a package. Local builds fine. First thing you check?"
     (the Dockerfile COPY list — new file referenced by the build isn't in the image context.)
- [x] **Wrap-up screen** — short, warm, forward-looking (content in Screens #4). No quiz here.

## Reference Files to Read
- `references/content-philosophy.md` (all) — with AUDIENCE OVERRIDE.
- `references/gotchas.md` (all)
- `references/interactive-elements.md` → "Code ↔ English Translation", "Multiple-Choice Quiz"
  (spot-the-bug uses the same machinery), "Pattern/Feature Cards", "Callout Boxes",
  "Glossary Tooltips".

## Connections
- **Previous:** Module 5 "Auth & Typed Failure" — the error vocabulary these bugs get expressed in.
- **Next:** none — this closes the course; include the wrap-up.
- **Tone/style:** teal accent; actors Web/API/Postgres/Worker/Sidecar. The six bugs are REAL and
  documented in specs/007-v3-skeleton/evidence.md — keep the "this actually happened" register,
  no invented drama.
