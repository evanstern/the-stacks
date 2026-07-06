# Module 4: The Postgres Queue

Write to: `modules/04-queue.html` — `<section class="module" id="module-4">` only.

## AUDIENCE OVERRIDE (course-wide)
Skilled, time-poor developer. No CS-fundamentals tooltips. DO tooltip on first use here:
*SKIP LOCKED* ("row-lock modifier: skip rows another transaction holds locked instead of waiting —
the primitive that makes a plain table a safe multi-consumer queue"), *visibility timeout*,
*backoff*, *append-only*, *D12* ("fixed decision: the queue is a Postgres table, not a broker").

## Teaching Arc
- **Metaphor:** A pharmacy prescription rack. Orders (jobs) go on the rack; any pharmacist
  (worker) grabs the next slip — and the rack's trick is that two pharmacists can reach in at once
  and never grab the same slip (SKIP LOCKED). If a pharmacist wanders off holding a slip, after a
  while the rack "takes it back" (visibility timeout). Failed orders go back on the rack with a
  note and a "don't retry before" time (backoff via run_at).
- **Opening hook:** "There's no Redis, no RabbitMQ, no SQS here. The queue is a table named `jobs`
  and about 60 lines of SQL — chosen deliberately (D12), because v2 proved the pattern and a
  second datastore is a second thing that pages you."
- **Key insight:** Three small mechanisms — locked claims, attempt-counted backoff, and
  timeout-based reclaim — turn a table into a queue that survives concurrent workers, dependency
  outages, and worker crashes *mid-job*. And the audit trail beside it can't lie because nothing
  can rewrite it.
- **Why should I care?:** "Boring infrastructure" is a policy you can copy: when your job volume is
  one operator's background tasks, Postgres-as-queue removes an entire failure domain. Knowing the
  three mechanisms tells you exactly what to check when a job seems stuck.

## Screens (4-5)
1. Hook + the `jobs` row lifecycle as a **state-machine visual**:
   `queued → claimed → succeeded | failed`, with the two arrows BACK to queued (retryable failure
   w/ backoff; visibility-timeout reclaim). Make the back-arrows the visual stars.
2. Claiming — Code↔English Snippet A (claimNext): the SELECT ... FOR UPDATE SKIP LOCKED inside a
   transaction, attempts+1 at claim time. Callout ("aha!"): *the locking clause is raw SQL on
   purpose — the load-bearing part stays literal and greppable.*
3. Failing — Code↔English Snippet B (fail): exhausted-vs-requeue, backoff = base × 2^(attempts-1)
   via `run_at` (the schedule column IS the backoff mechanism), forensic freeze of the final
   claim on terminal failure.
4. The trail — Snippet C (recordEvent) + short text: append-only BY CONSTRUCTION — this function
   is the only writer; no UPDATE/DELETE path exists in the codebase. Corrections are new events.
   Connect: run vs job are two state machines — the job may retry (job: queued again) while the
   run stays honest about what happened.
5. Quiz + handoff: "The queue survives crashes. Next: who's allowed in at all, and what failure
   looks like when it reaches the operator — auth and typed errors."

## Code Snippets (verbatim — do not modify)

**Snippet A** — File: `v3/packages/db/src/queue.ts` (lines 56-87)
```ts
export async function claimNext(db: Database, input: ClaimNextInput): Promise<Job | undefined> {
  return db.transaction(async (tx) => {
    // Raw SQL so the locking clause — the load-bearing part — stays literal
    // and greppable rather than hidden behind builder options.
    const candidates = await tx.execute<{ id: string }>(
      sql`SELECT id FROM jobs
          WHERE status = 'queued' AND run_at <= now()
          ORDER BY created_at
          FOR UPDATE SKIP LOCKED
          LIMIT 1`,
    );

    const candidate = candidates.rows[0];
    if (!candidate) {
      return undefined;
    }

    const [row] = await tx
      .update(jobs)
      .set({
        status: "claimed",
        claimedBy: input.workerId,
        claimedAt: new Date(),
        attempts: sql`${jobs.attempts} + 1`,
        updatedAt: new Date(),
      })
      .where(sql`${jobs.id} = ${candidate.id}`)
      .returning();

    return row;
  });
}
```

**Snippet B** — File: `v3/packages/db/src/queue.ts` (lines 112-140)
```ts
export async function fail(db: Database, jobId: string, error: JobFailure): Promise<void> {
  await db.transaction(async (tx) => {
    const [row] = await tx.select().from(jobs).where(sql`${jobs.id} = ${jobId}`);
    if (!row) {
      return;
    }

    // attempts was already bumped by claimNext, so after the Nth run
    // attempts === N: 1st failure waits base*2^0, 2nd base*2^1, ... The
    // Math.max guards against a hand-inserted row failing at attempts = 0.
    const exhausted = row.attempts >= row.maxAttempts;
    const backoffMs = BACKOFF_BASE_MS * 2 ** Math.max(0, row.attempts - 1);

    // On terminal failure we freeze claimed_by/claimed_at/run_at as forensic
    // evidence of the final attempt; on requeue we clear the claim so the row
    // is claimable again once run_at arrives.
    await tx
      .update(jobs)
      .set({
        status: exhausted ? "failed" : "queued",
        lastError: error,
        runAt: exhausted ? row.runAt : new Date(Date.now() + backoffMs),
        claimedBy: exhausted ? row.claimedBy : null,
        claimedAt: exhausted ? row.claimedAt : null,
        updatedAt: new Date(),
      })
      .where(sql`${jobs.id} = ${jobId}`);
  });
}
```

**Snippet C** — File: `v3/packages/db/src/events.ts` (lines 27-41)
```ts
 * The append-only guarantee is BY CONSTRUCTION, not by trigger or grant:
 * keeping this function the sole writer is the invariant. If you find
 * yourself wanting to update or delete an event row, the design answer is
 * to append a correcting event instead.
 */
export async function recordEvent(db: Database, input: RecordEventInput): Promise<void> {
  await db.insert(skeletonCheckEvents).values({
    runId: input.runId,
    seam: input.seam,
    ok: input.ok ?? true,
    detail: input.detail ?? {},
    durationMs: input.durationMs,
  });
}
```

**Snippet D (worker loop context, small)** — File: `v3/apps/worker/src/main.ts` (lines 72-81)
```ts
  while (running) {
    touchHeartbeat();
    try {
      // Visibility timeout: any job claimed longer ago than this is presumed
      // orphaned by a crashed worker and returned to the queue. Reclaim runs
      // every tick so recovery latency is bounded by pollMs, not by luck.
      const reclaimed = await reclaimStale(db, { visibilityTimeoutMs });
      if (reclaimed > 0) {
        log("jobs_reclaimed", { count: reclaimed });
      }
```

## Interactive Elements
- [x] **State-machine visual (HERO)** — the jobs lifecycle with back-arrows; can be built as an
  annotated SVG/div diagram. Optionally animate the "crash mid-claim → reclaim" path.
- [x] **Code↔English translations** — Snippets A and B (C and D shorter, can be inline blocks).
- [x] **Quiz** — 3-4 debugging-scenario questions:
  1. "Two workers poll simultaneously; one job is queued. Walk through why exactly one gets it."
     (Both SELECT; the first locks the row; SKIP LOCKED makes the second *skip* — not block — and
     see an empty result.)
  2. "A worker is OOM-killed while holding a claim. When does the job run again, worst case?"
     (visibility timeout + up to one poll interval — reclaim runs every tick.)
  3. "Job fails 3 times with max_attempts=3. What does the row look like, and why keep
     claimed_by/claimed_at?" (status=failed, last_error typed, claim fields frozen as forensic
     evidence of the final attempt.)
  4. "You're tempted to UPDATE an event row to fix a typo in its detail JSON. What's the
     design-correct move?" (append a correcting event; the table has no update path on purpose.)

## Reference Files to Read
- `references/content-philosophy.md` (all) — with AUDIENCE OVERRIDE.
- `references/gotchas.md` (all)
- `references/interactive-elements.md` → "Code ↔ English Translation", "Multiple-Choice Quiz",
  "Callout Boxes", "Glossary Tooltips" (+ any diagram pattern you use for the state machine).

## Connections
- **Previous:** Module 3 "Anatomy of a Skeleton Check" — the happy path through these mechanisms.
- **Next:** Module 5 "Auth & Typed Failure" — the front door (sealed cookies) and the four-class
  error vocabulary failures are expressed in.
- **Tone/style:** teal accent; actors Web/API/Postgres/Worker/Sidecar.
