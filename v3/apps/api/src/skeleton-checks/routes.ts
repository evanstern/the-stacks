/**
 * Skeleton-check HTTP surface (specs/007-v3-skeleton/contracts/api.md,
 * data-model.md). A "skeleton check" is the walking skeleton's end-to-end
 * probe: the API only ACCEPTS it (Principle IV, accept-then-async) — all
 * seam-crossing work happens in the worker's skeleton-check handler. These
 * routes therefore never talk to the ML sidecar; they read/write Postgres.
 *
 * POST returns 202 + run id; clients poll GET /:id and watch the append-only
 * event trail fill in as the worker crosses each seam.
 */
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
      // Thrown, not reply.code(404) — the setErrorHandler in app.ts owns the
      // DomainError -> HTTP mapping (unknown_thing -> 404).
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

    // data-model.md validation rule: outcome appears ONLY on failed runs, the
    // vector block ONLY on succeeded ones. Status alone tells a reader which
    // shape to expect; the blocks are proof of the terminal state, never both.
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
