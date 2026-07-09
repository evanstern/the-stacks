# Module 4: Generation-Flip — Why Re-Ingestion Never Corrupts

Write to: `modules/04-generation-flip.html` — `<section class="module" id="module-4">` only.

## AUDIENCE OVERRIDE (course-wide)
Skilled, time-poor developer. No CS-fundamentals tooltips. DO tooltip on first use here:
`generation` ("an integer stamped on every section/chunk row — the pointer that decides
which rows are 'live', research R8"), `retry` ("the SAME job re-run with the SAME target
generation — deterministic ids make it a no-op replay"), `re-ingest` ("a NEW job at
`generation + 1` — a deliberate redo, e.g. after a plugin bug fix"), `sweep` ("deleting the
previous generation's rows, done in the SAME transaction as the flip — so a reader is
never caught between old and new").

## Teaching Arc
- **Metaphor:** Blue-green deployment, shrunk to one integer column. Build the new version
  fully aside, then flip ONE pointer, then clean up the old version — never a moment where
  half the traffic sees old and half sees new.
- **Opening hook:** "A plugin bug fix ships. Every source that plugin ever touched needs to
  be re-derived. How do you redo work on a live, queryable corpus without a reader ever
  seeing a half-old, half-new source?"
- **Key insight:** One column — `current_generation` — separates two totally different
  "run it again" situations that would otherwise be easy to confuse: a QUEUE RETRY (same
  target generation, deterministic ids make replay a no-op) versus a RE-INGEST (a NEW
  generation, so old and new rows can never collide, and the flip+sweep happens in one
  transaction).
- **Why should I care?:** This is what makes Module 6's "add a plugin with zero core
  changes" claim trustworthy even under a plugin VERSION bump — re-ingesting after an
  upgrade is provably safe, not "probably fine."

## Canonical vocabulary (use identically everywhere in this module)
`same generation` (retry) vs. `generation + 1` (re-ingest) → `build aside` → `flip` (one
UPDATE) → `sweep` (delete older generation, same transaction)

## Screens (5)
1. Hook + the one-column doctrine (HERO: a before/after diagram — generation N rows next to
   generation N+1 rows, both existing briefly, then N's rows vanish in the same beat the
   pointer flips).
2. Code↔English on Snippet A (`commitGeneration`) — walk the flip-then-sweep, same
   transaction. Callout ("aha!"): *the sweep runs AFTER the flip in the SAME transaction —
   a reader's snapshot either sees the old generation (transaction hasn't committed yet) or
   the new one with nothing swept out from under it. Never neither, never both.*
3. The domain operation that starts a re-ingest — Code↔English on Snippet B
   (`reingestSource`). Callout: *this function only ENQUEUES a job — it never runs the
   pipeline inline. Re-ingestion reuses the exact same stage driver from Module 3; nothing
   about "redo" needed its own code path.*
4. The real proof: a plugin version bump, using the ACTUAL test scenario from this cycle
   (Snippet C, the demo-format v1.0.0 → v1.1.0 story). Walk it as a mini data-flow: ingest
   at v1.0.0 → `sourcesByPluginVersion` finds it → `reingestSource` enqueues gen+1 → worker
   drains it under v1.1.0 → source's `pluginVersion` now reads `1.1.0`, old version's
   candidate list is empty. Callout: *FR-016's "which sources did the old version produce"
   isn't a manual audit — it's one indexed query.*
5. Quiz + handoff to Module 5: "A re-ingest just replaced this source's passages safely.
   What happens when the ORIGINAL upload was garbage to begin with?"

## Code Snippets (verbatim — do not modify)

**Snippet A** — File: `packages/ingestion/src/index-chunks.ts` (lines 71-96, the flip +
sweep)
```ts
export async function commitGeneration(
  db: Database,
  input: { sourceId: string; generation: number; contractVersion: string },
): Promise<CommitResult> {
  return db.transaction(async (tx) => {
    // The flip IS the commit: one UPDATE makes generation N the one readers
    // see. Everything before this line was invisible build-aside work.
    await tx
      .update(sources)
      .set({
        currentGeneration: input.generation,
        status: "ingested",
        contractVersion: input.contractVersion,
        lastError: null,
        updatedAt: new Date(),
      })
      .where(sql`${sources.id} = ${input.sourceId}`);

    // Sweep is AFTER the flip, same transaction: a reader either saw the old
    // generation before the transaction or the new one after — never neither.
    const sweptSections = await tx
      .delete(documentSections)
      .where(
        and(
          sql`${documentSections.sourceId} = ${input.sourceId}`,
          lt(documentSections.generation, input.generation),
```

**Snippet B** — File: `packages/ingestion/src/reingest.ts` (lines 47-68, full function)
```ts
export async function reingestSource(db: Database, input: ReingestSourceInput): Promise<Job> {
  const [source] = await db.select().from(sources).where(eq(sources.id, input.sourceId));
  if (!source) {
    throw new DomainError({
      class: "unknown_thing",
      message: `No such source: ${input.sourceId}.`,
    });
  }
  if (source.currentGeneration < 1) {
    // Nothing has ever been committed for this source — there is no prior
    // generation to build past; the FIRST ingestion is the plain intake
    // path's job (ingest_source at generation 1), not re-ingestion's.
    throw new DomainError({
      class: "unsupported_type",
      message: `Source ${input.sourceId} has never completed an ingestion (currentGeneration=0); re-ingest applies only to a source with an existing generation.`,
    });
  }

  return enqueue(db, {
    kind: "ingest_source",
    payload: { sourceId: source.id, targetGeneration: source.currentGeneration + 1 },
  });
}
```

**Snippet C** — the REAL version-bump proof, verbatim from
`packages/ingestion/src/reingest.test.ts` (the "plugin-version bump" test, describe as a
narrated sequence rather than the raw test code, since the test itself is scaffolding):
```text
1. Ingest sample.demo under demo-format@1.0.0 -> generation 1
2. sourcesByPluginVersion({ pluginName: "demo-format", pluginVersion: "1.0.0" })
   -> [that one source]
3. reingestSource({ sourceId }) -> enqueues ingest_source, targetGeneration: 2
4. Worker drains the job using a registry with demo-format@1.1.0
5. Result: source.pluginVersion === "1.1.0", currentGeneration === 2
6. sourcesByPluginVersion(..., "1.0.0") -> [] (moved on)
   sourcesByPluginVersion(..., "1.1.0") -> [that one source]
```

## Interactive Elements
- [x] **Before/after diagram (HERO, screen 1)** — generation N's rows fading out exactly as
  generation N+1's rows solidify, pointer arrow flipping between them.
- [x] **Data-flow animation** (screen 4) — actors: Operator, sourcesByPluginVersion,
  reingestSource, Queue, Worker (running v1.1.0). Steps keyed to Snippet C's six numbered
  beats, each labeled with its step number.
- [x] **Code↔English translations** — Snippets A and B.
- [x] **Callout boxes** — as scripted in Screens #2 and #3.
- [x] **Quiz** — 3 questions:
  1. "Why is `reingestSource` NOT an HTTP endpoint, even though the pipeline fully supports
     it?" (Pinned decision, 2026-07-07: mutation verbs belong with the corpus-lifecycle
     spec's own dry-run/confirm guardrails, Principle IV — 008 ships the tested primitive,
     not the exposed trigger.)
  2. "A job crashes mid-embed during a RETRY (same generation). Does the sweep in Snippet A
     ever run for that retry?" (No — `commitGeneration` only runs on SUCCESS, at the very
     end; a retry that fails again just re-attempts from `detect`, nothing is swept because
     nothing new committed.)
  3. "Could `sourcesByPluginVersion` ever return a source mid-re-ingest, after the flip but
     before... anything?" (No such window exists — the flip is the atomic UPDATE that
     changes `pluginVersion`/`currentGeneration` together in Snippet A's transaction; a
     reader sees the complete old state or the complete new state, never a partial one.)
- [x] **Glossary tooltips** — the four domain terms from the AUDIENCE OVERRIDE.

## Reference Files to Read
- `references/content-philosophy.md` (all) — with AUDIENCE OVERRIDE.
- `references/interactive-elements.md` → "Message Flow / Data Flow Animation", "Code ↔
  English Translation", "Multiple-Choice Quiz", "Callout Boxes", "Glossary Tooltips".

## Connections
- **Previous:** Module 3 "Anatomy of an Ingest" — the stage driver this module's re-ingest
  reuses unchanged.
- **Next:** Module 5 "The Honest Front Door" — what happens to material that should never
  have been accepted in the first place.
- **Tone/style:** deep blue/indigo accent (continues Module 3's centerpiece color family);
  the demo-format version numbers (1.0.0 -> 1.1.0) and the six-step sequence in Snippet C
  are the real test scenario from this cycle, not an invented example.
