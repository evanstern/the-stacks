/**
 * The walking skeleton's payoff: the one handler that proves every
 * architectural seam works end to end (specs/007-v3-skeleton/contracts/
 * api.md, contracts/ml-sidecar.md, data-model.md). Seam order — claimed ->
 * inference (embed via sidecar) -> vector_write -> vector_readback ->
 * completed — with exactly one append-only event per seam, so a stalled or
 * failed run tells you WHICH seam broke just from its event trail.
 *
 * Two state machines are in play and must not be conflated: the RUN
 * (skeleton_check_runs, operator-facing truth) is failed here via failRun;
 * the JOB (queue row) is failed by the poll loop when we re-throw, and may
 * retry with backoff — a retry re-runs this handler against the same run and
 * flips it back to "running". Failing the run on every attempt means the
 * operator never sees a run stuck between retries with no explanation.
 */
import { DomainError, deriveVectorId, resolveModelRole, SKELETON_CHECK_INPUT_TEXT } from "@stacks/core";
import type { Database, Job } from "@stacks/db";
import { recordEvent, skeletonCheckRuns, skeletonVectors } from "@stacks/db";
import { sql } from "drizzle-orm";

import { embed } from "../ml-client";

interface SkeletonCheckPayload {
  runId: string;
}

// Stamps the run's terminal failure state with the DomainError's class/seam —
// the same vocabulary the API's error mapping and the job's last_error use,
// so one failure reads identically at every layer (FR-018).
async function failRun(db: Database, runId: string, error: DomainError): Promise<void> {
  await db
    .update(skeletonCheckRuns)
    .set({
      status: "failed",
      outcome: { class: error.class, seam: error.seam ?? "inference", message: error.message },
      completedAt: new Date(),
    })
    .where(sql`${skeletonCheckRuns.id} = ${runId}`);
}

/**
 * Crosses every architectural seam for one accepted run: queue -> worker ->
 * ml sidecar embed -> pgvector write + similarity read-back -> status
 * (contracts, data-model.md). Each seam leaves exactly one append-only event.
 */
export async function skeletonCheckHandler(db: Database, job: Job): Promise<void> {
  const { runId } = job.payload as SkeletonCheckPayload;
  if (!runId) {
    throw new DomainError({ class: "internal_fault", message: "skeleton_check job missing runId in payload" });
  }

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
  }
}

async function runSkeletonCheck(db: Database, runId: string): Promise<void> {
  // Seam 1, "claimed": the run leaves the queue's hands. From here every
  // seam below appends exactly one event, success or failure.
  await db
    .update(skeletonCheckRuns)
    .set({ status: "running", startedAt: new Date() })
    .where(sql`${skeletonCheckRuns.id} = ${runId}`);
  await recordEvent(db, { runId, seam: "claimed" });

  // Resolved per run, not cached at boot: the role's provider/model/dimensions
  // become the vector's identity stamp below, so the stamp always reflects the
  // config in force at execution time.
  const role = resolveModelRole("embedding");
  const timeoutMs = Number.parseInt(process.env.ML_REQUEST_TIMEOUT_MS ?? "15000", 10);

  // Seam 2, "inference": the only network hop. ml-client has already sorted
  // failures into dependency_down (sidecar unreachable/not ready) vs
  // internal_fault (we sent something the contract rejects).
  const inferenceStart = Date.now();
  let result: Awaited<ReturnType<typeof embed>>;
  try {
    result = await embed({
      endpoint: role.endpoint,
      model: role.modelId,
      inputs: [SKELETON_CHECK_INPUT_TEXT],
      timeoutMs,
    });
  } catch (error) {
    const domainError =
      error instanceof DomainError
        ? error
        : new DomainError({
            class: "internal_fault",
            seam: "inference",
            message: "Unexpected inference error.",
            cause: error,
          });
    await recordEvent(db, {
      runId,
      seam: "inference",
      ok: false,
      detail: { class: domainError.class, message: domainError.message },
      durationMs: Date.now() - inferenceStart,
    });
    await failRun(db, runId, domainError);
    throw domainError;
  }

  // The stamp-integrity guard (FR-014): a dimension mismatch is our bug, not
  // a down dependency, and nothing gets written past this point.
  // Placement is the point — this runs BEFORE any vector write, so the store
  // can never hold a vector whose stamped dimensions disagree with its data.
  if (result.dimensions !== role.dimensions) {
    const domainError = new DomainError({
      class: "internal_fault",
      seam: "inference",
      message: `Sidecar returned ${result.dimensions} dimensions, expected ${role.dimensions}.`,
    });
    await recordEvent(db, {
      runId,
      seam: "inference",
      ok: false,
      detail: { expected: role.dimensions, actual: result.dimensions },
      durationMs: Date.now() - inferenceStart,
    });
    await failRun(db, runId, domainError);
    throw domainError;
  }

  await recordEvent(db, {
    runId,
    seam: "inference",
    detail: { model: result.model },
    durationMs: Date.now() - inferenceStart,
  });

  // Seam 3, "vector_write". The id is DERIVED from (input, provider, model,
  // dimensions) — the same content under the same embedding config always
  // maps to the same row, which is what makes the upsert below an idempotent
  // dedupe rather than an accumulating pile of identical vectors.
  const vectorId = deriveVectorId({
    inputText: SKELETON_CHECK_INPUT_TEXT,
    provider: role.provider,
    model: role.modelId,
    dimensions: role.dimensions,
  });
  const embedding = result.embeddings[0]!;

  const writeStart = Date.now();
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
  // ON CONFLICT DO NOTHING + deterministic id: re-running the check (or a job
  // retry that got past the write) is safe. Zero returned rows means the
  // vector already existed — surfaced honestly as deduplicated, not hidden.
  const deduplicated = insertedRows.length === 0;
  await recordEvent(db, {
    runId,
    seam: "vector_write",
    detail: { deduplicated },
    durationMs: Date.now() - writeStart,
  });

  // Seam 4, "vector_readback": prove the vector is not just stored but
  // FINDABLE by similarity (<=> is pgvector cosine distance; nearest hit for
  // our own embedding should be ~0). The model-identity filter is Principle
  // VII doctrine: similarity is only defined within one embedding space, so
  // if the configured model ever changes, old vectors fall out of scope and
  // the mismatch is detectable — never a silent cross-space comparison.
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
  await recordEvent(db, {
    runId,
    seam: "vector_readback",
    detail: { distance: readback?.distance },
    durationMs: Date.now() - readbackStart,
  });

  // Terminal seam, "completed": stamp the run with what it proved (vectorId,
  // readback distance) — the GET /:id detail route only exposes the vector
  // block when this succeeded state is reached (data-model.md).
  await db
    .update(skeletonCheckRuns)
    .set({
      status: "succeeded",
      vectorId,
      readbackDistance: readback?.distance ?? null,
      completedAt: new Date(),
    })
    .where(sql`${skeletonCheckRuns.id} = ${runId}`);
  await recordEvent(db, { runId, seam: "completed" });
}
