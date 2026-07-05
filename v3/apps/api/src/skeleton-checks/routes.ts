import { DomainError, SKELETON_CHECK_INPUT_TEXT } from "@stacks/core";
import type { Database } from "@stacks/db";
import { jobs, recordEvent, skeletonCheckEvents, skeletonCheckRuns, skeletonVectors } from "@stacks/db";
import { sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";

export interface SkeletonCheckRoutesDeps {
  db: Database;
}

export function registerSkeletonCheckRoutes(app: FastifyInstance, deps: SkeletonCheckRoutesDeps): void {
  const { db } = deps;

  app.post("/api/skeleton-checks", async (_request, reply) => {
    // Accept-then-async: run + job are created in one transaction (FR-009); the
    // worker does the actual seam-crossing work off this queue entry (D12).
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

    await recordEvent(db, { runId: run.id, seam: "queued" });

    reply.code(202);
    return { run: { id: run.id, status: run.status, createdAt: run.createdAt } };
  });

  app.get("/api/skeleton-checks", async () => {
    const runs = await db
      .select({
        id: skeletonCheckRuns.id,
        status: skeletonCheckRuns.status,
        createdAt: skeletonCheckRuns.createdAt,
        completedAt: skeletonCheckRuns.completedAt,
      })
      .from(skeletonCheckRuns)
      .orderBy(sql`${skeletonCheckRuns.createdAt} DESC`)
      .limit(50);

    return { runs };
  });

  app.get<{ Params: { id: string } }>("/api/skeleton-checks/:id", async (request) => {
    const { id } = request.params;

    const [run] = await db.select().from(skeletonCheckRuns).where(sql`${skeletonCheckRuns.id} = ${id}`);
    if (!run) {
      throw new DomainError({ class: "unknown_thing", message: "No such skeleton check run." });
    }

    const events = await db
      .select()
      .from(skeletonCheckEvents)
      .where(sql`${skeletonCheckEvents.runId} = ${id}`)
      .orderBy(skeletonCheckEvents.id);

    const body: Record<string, unknown> = {
      id: run.id,
      status: run.status,
      createdAt: run.createdAt,
      startedAt: run.startedAt,
      completedAt: run.completedAt,
      events: events.map((event) => ({
        seam: event.seam,
        ok: event.ok,
        durationMs: event.durationMs,
        detail: event.detail,
        at: event.createdAt,
      })),
    };

    if (run.status === "failed" && run.outcome) {
      body.outcome = run.outcome;
    }

    if (run.status === "succeeded" && run.vectorId) {
      const [vector] = await db.select().from(skeletonVectors).where(sql`${skeletonVectors.id} = ${run.vectorId}`);
      body.vector = {
        id: run.vectorId,
        provider: vector?.embeddingProvider,
        model: vector?.embeddingModel,
        dimensions: vector?.embeddingDimensions,
        readbackDistance: run.readbackDistance,
      };
    }

    return { run: body };
  });
}
