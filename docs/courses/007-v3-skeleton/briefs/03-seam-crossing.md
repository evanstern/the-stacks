# Module 3: Anatomy of a Skeleton Check

Write to: `modules/03-seam-crossing.html` — `<section class="module" id="module-3">` only.
THIS IS THE COURSE CENTERPIECE — it carries the mandatory GROUP CHAT animation and a data-flow
animation. Give it the most visual weight of any module.

## AUDIENCE OVERRIDE (course-wide)
Skilled, time-poor developer. No CS-fundamentals tooltips. DO tooltip on first use here:
*accept-then-async* ("the API's only job is to record the request and return 202; all real work
happens off a queue — constitution Principle IV"), *seam*, *deterministic id*, *idempotent*,
*pgvector*, *cosine distance* (brief), *ON CONFLICT DO NOTHING*. Crisp dev metaphors only.

## Teaching Arc
- **Metaphor:** A tracer round. Militaries load one glowing bullet per magazine so you can *see*
  the path fire is taking. The skeleton check is a tracer request: a fixed synthetic sentence shot
  through every seam, leaving a glowing, timestamped trail (six events) you inspect afterward.
- **Opening hook:** "You click **Run skeleton check**. The API answers in ~5ms with a 202 and a
  run id. One second later the run shows six green events and a vector id. Here's every hop."
- **Key insight:** One thin slice proves five seams at once — and the proof is *durable data*
  (append-only events + a stamped vector), not a green log line.
- **Why should I care?:** This exact path — accept, queue, claim, infer, write, read back — is the
  template ingestion and retrieval will reuse. Understand this trace and you understand how every
  future async feature here will be shaped and debugged.

## The six seams / events (canonical order, use everywhere):
`queued` → `claimed` → `inference` → `vector_write` → `vector_readback` → `completed`

## Screens (5)
1. Hook + **HERO: group chat animation** (mandatory — see Interactive Elements).
2. The accept side — Code↔English on Snippet A (POST route): one transaction for run+job
   (no window where one exists without the other), 'queued' event emitted only AFTER commit.
   Callout ("aha!"): *events are observability, not state — losing one to a crash is acceptable; a
   phantom event describing a rolled-back run is not.*
3. The work side — **data-flow animation** of the worker's crossing (see Interactive Elements),
   then Code↔English on Snippet B (deriveVectorId) — deterministic identity = idempotent re-runs:
   run it twice, same sha256, second write is a no-op (`deduplicated: true` in the event detail).
4. The read-back — Snippet C: similarity search `<=>` FILTERED on provider/model/dimensions.
   Callout: *the filter is the point — change the embedding model in env and old vectors fall out
   of scope as a DETECTABLE mismatch, never a silent cross-space comparison (Principle VII).*
   Mention distance 0.0 = we found the exact vector we just wrote; the loop is closed.
5. Quiz + handoff: "That was the happy path. Module 4: what the queue does when the path isn't
   happy."

## Code Snippets (verbatim — do not modify)

**Snippet A** — File: `v3/apps/api/src/skeleton-checks/routes.ts` (POST handler core)
```ts
  app.post("/api/skeleton-checks", async (_request, reply) => {
    // Accept-then-async: run + job are created in one transaction (FR-009); the
    // worker does the actual seam-crossing work off this queue entry (D12).
    // One transaction means no window where a run exists without its job (or
    // vice versa) — a crash mid-accept leaves nothing behind. The job is
    // inserted first, then back-filled with the runId, because each row needs
    // the other's id and jobs.payload is the cheaper side to update.
    const run = await db.transaction(async (tx) => {
      const [job] = await tx.insert(jobs).values({ kind: "skeleton_check", payload: {} }).returning();
      const [createdRun] = await tx
        .insert(skeletonCheckRuns)
        .values({ jobId: job!.id, inputText: SKELETON_CHECK_INPUT_TEXT })
        .returning();
      await tx
        .update(jobs)
        .set({ payload: { runId: createdRun!.id } })
        .where(sql`${jobs.id} = ${job!.id}`);
      return createdRun!;
    });

    // 'queued' is emitted AFTER the commit: an event must never describe a run
    // that a rollback could erase. Events are observability, not state — losing
    // this one to a crash is acceptable; a phantom event is not.
    await recordEvent(db, { runId: run.id, seam: "queued" });

    reply.code(202);
    return { run: { id: run.id, status: run.status, createdAt: run.createdAt } };
  });
```

**Snippet B** — File: `v3/packages/core/src/skeleton-check.ts` (lines 63-66)
```ts
export function deriveVectorId(input: DeriveVectorIdInput): string {
  const material = `${input.inputText}\n${input.provider}/${input.model}/${input.dimensions}`;
  return createHash("sha256").update(material).digest("hex");
}
```

**Snippet C** — File: `v3/apps/worker/src/handlers/skeleton-check.ts` (readback, lines ~196-208)
```ts
  const readbackStart = Date.now();
  const vectorLiteral = `[${embedding.join(",")}]`;
  const distanceExpr = sql<number>`${skeletonVectors.embedding} <=> ${vectorLiteral}::vector`;
  const [readback] = await db
    .select({ id: skeletonVectors.id, distance: distanceExpr })
    .from(skeletonVectors)
    .where(
      sql`${skeletonVectors.embeddingModel} = ${role.modelId}
        AND ${skeletonVectors.embeddingProvider} = ${role.provider}
        AND ${skeletonVectors.embeddingDimensions} = ${role.dimensions}`,
    )
    .orderBy(distanceExpr)
    .limit(1);
```

**Snippet D (for the vector-write beat of the flow animation / optional 4th translation)** —
File: `v3/apps/worker/src/handlers/skeleton-check.ts` (upsert, lines ~166-178)
```ts
  const insertedRows = await db
    .insert(skeletonVectors)
    .values({
      id: vectorId,
      content: SKELETON_CHECK_INPUT_TEXT,
      embedding,
      embeddingProvider: role.provider,
      embeddingModel: role.modelId,
      embeddingDimensions: role.dimensions,
    })
    .onConflictDoNothing({ target: skeletonVectors.id })
    .returning();
```

## Interactive Elements
- [x] **Group chat animation (MANDATORY, HERO of screen 1)** — actors: Operator 🧑‍💻, Web, API,
  Queue (jobs table), Worker, Sidecar, Postgres. Flow:
  1. Operator → Web: "Run skeleton check"
  2. Web → API: POST /api/skeleton-checks
  3. API → Queue: INSERT run + job (one transaction) · API → Web: "202 — run a1b2c3, accepted"
  4. Web → Operator: redirects to the run page (starts polling)
  5. Worker → Queue: "anything for me?" (SKIP LOCKED claim) · Queue → Worker: "job a1b2c3, yours"
  6. Worker → Sidecar: "embed this sentence (model=all-MiniLM-L6-v2)" · Sidecar → Worker:
     "384 floats, 31ms"
  7. Worker → Postgres: "INSERT vector 8d6a97… ON CONFLICT DO NOTHING" then "nearest neighbor,
     same model only?" · Postgres → Worker: "8d6a97…, distance 0.0"
  8. Worker → Queue: "job done" — run marked succeeded, six events on the trail
  9. Web → Operator: poll flips to "succeeded ✓ six events"
- [x] **Data-flow animation** (screen 3) — actors: API, jobs table, Worker, Sidecar, pgvector.
  Steps keyed to the six seam events: queued (row appears) → claimed (SKIP LOCKED; attempts+1) →
  inference (HTTP to sidecar, 384-dim reply) → vector_write (deterministic id, dedup flag) →
  vector_readback (cosine `<=>`, model-filtered) → completed (run stamped with vectorId+distance).
  Label each step with its event name so the animation IS the event trail.
- [x] **Code↔English translations** — Snippets A, B, C (D optional).
- [x] **Quiz** — 3 questions:
  1. Trace: "The API crashes between the transaction commit and `recordEvent('queued')`. What's
     the state?" (run+job exist and WILL be processed; only the queued event is missing — work is
     never lost, an event can be. That asymmetry is designed.)
  2. Scenario: "You trigger the check 5 times with the same input+model. How many rows in
     skeleton_vectors, and how do you know from the events?" (1; runs 2-5 show
     `vector_write {deduplicated: true}`.)
  3. Architecture: "Why does the readback filter on provider/model/dimensions instead of just
     taking the global nearest vector?" (vectors from different models share no space; the filter
     turns config drift into a visible mismatch instead of silently 'similar' garbage.)

## Reference Files to Read
- `references/content-philosophy.md` (all) — with AUDIENCE OVERRIDE.
- `references/gotchas.md` (all)
- `references/interactive-elements.md` → "Group Chat Animation", "Message Flow / Data Flow
  Animation", "Code ↔ English Translation", "Multiple-Choice Quiz", "Callout Boxes",
  "Glossary Tooltips".

## Connections
- **Previous:** Module 2 "The Monorepo Map" — where each participant lives.
- **Next:** Module 4 "The Postgres Queue" — claims, retries, backoff, and the append-only trail
  when things break mid-flight.
- **Tone/style:** teal accent; actors Web/API/Postgres/Worker/Sidecar; the real vector id prefix
  `8d6a97…` and real timing (~31ms inference) are from the live validation run — use them.
