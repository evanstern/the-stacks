import { DomainError, deriveVectorId, resolveModelRole, SKELETON_CHECK_INPUT_TEXT } from "@stacks/core";
import type { Database, Job } from "@stacks/db";
import { recordEvent, skeletonCheckRuns, skeletonVectors } from "@stacks/db";
import { sql } from "drizzle-orm";

import { embed } from "../ml-client";

interface SkeletonCheckPayload {
  runId: string;
}

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
    throw error;
  }
}

async function runSkeletonCheck(db: Database, runId: string): Promise<void> {
  await db
    .update(skeletonCheckRuns)
    .set({ status: "running", startedAt: new Date() })
    .where(sql`${skeletonCheckRuns.id} = ${runId}`);
  await recordEvent(db, { runId, seam: "claimed" });

  const role = resolveModelRole("embedding");
  const timeoutMs = Number.parseInt(process.env.ML_REQUEST_TIMEOUT_MS ?? "15000", 10);

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
  const deduplicated = insertedRows.length === 0;
  await recordEvent(db, {
    runId,
    seam: "vector_write",
    detail: { deduplicated },
    durationMs: Date.now() - writeStart,
  });

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
