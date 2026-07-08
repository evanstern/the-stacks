/**
 * Re-ingestion domain operations (008 US5, FR-016, FR-023) — deliberately
 * NOT wrapped in an HTTP verb (contracts/api.md, pinned with the operator
 * 2026-07-07): mutation belongs with the corpus-lifecycle spec's
 * dry-run/confirm guardrails (Principle IV). This is the tested seam that
 * spec wraps: "which sources did an old plugin version produce" and
 * "re-ingest one of them" as plain functions.
 *
 * reingestSource() ENQUEUES — it never runs the pipeline inline. Generation
 * N+1's replace-without-duplication guarantee is the stage driver's job
 * (ingest-source.ts, R8/R9), proven exhaustively in ingest-source.test.ts;
 * this file only computes "which generation is next" and hands the queue a
 * job, same as every other ingestion trigger (Principle IV, async-only).
 */
import { DomainError } from "@stacks/core";
import type { Database, Job } from "@stacks/db";
import { enqueue, sources } from "@stacks/db";
import { and, eq } from "drizzle-orm";

export interface SourcesByPluginVersionInput {
  pluginName: string;
  pluginVersion: string;
}

/** FR-016: enumerate exactly the sources a given plugin version produced —
 * the re-ingestion candidate list the lifecycle spec's endpoint will list. */
export async function sourcesByPluginVersion(
  db: Database,
  input: SourcesByPluginVersionInput,
): Promise<Array<typeof sources.$inferSelect>> {
  return db
    .select()
    .from(sources)
    .where(and(eq(sources.pluginName, input.pluginName), eq(sources.pluginVersion, input.pluginVersion)));
}

export interface ReingestSourceInput {
  sourceId: string;
}

/**
 * Enqueues an `ingest_source` job targeting `currentGeneration + 1` (R8).
 * The source's own archive is never touched (FR-023) — only a new job
 * referencing the same source id is created; the stage driver does the rest
 * on its next claim.
 */
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
