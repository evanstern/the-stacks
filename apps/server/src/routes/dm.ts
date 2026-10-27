import type { SessionProjections } from "@the-stacks/session-model";
import { RefIdSchema } from "@the-stacks/session-model";
import { eq, max } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import type { AuthVariables } from "../auth/middleware.js";
import { createAuthMiddleware } from "../auth/middleware.js";
import type { DbClient, ValidateSession } from "../auth/session.js";
import {
  type DmJobRow,
  enqueueTurn,
  listDmJobs,
  listDmJobsPage,
  type TurnTrigger,
} from "../dm/jobs.js";
import { listModelCalls, modelCallTotals } from "../dm/model-calls.js";
import type { AuditRecord } from "../dm/nodes/audit.js";
import { loadSeed, SeedError } from "../dm/seed/load.js";
import { dmOnlySeedPaths } from "../dm/seed/views.js";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from "../errors.js";
import { readFrom } from "../events/log.js";
import { events } from "../schema/events.js";
import { toStoredEvent } from "../session/events.js";

/**
 * Operator HTTP routes for the DM runtime (specs/031-dm-runtime
 * contracts/dm-api.md). Operator only, same rule as `/library`. The list never
 * returns prompt text, model output or retrieved passages.
 */

export interface CreateDmRoutesOptions {
  db: DbClient;
  validateSession: ValidateSession;
  /** Wakes the DM worker after an enqueue. */
  nudge: () => void;
  /** The DM view of a session. */
  loadProjections: (sessionId: string) => Promise<SessionProjections>;
}

const UuidSchema = z.uuid();
const StartBodySchema = z.object({
  seedId: z.string().regex(/^[a-z0-9-]{1,64}$/),
  seats: z.record(RefIdSchema, z.uuid()),
});
const TurnsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const EventsQuerySchema = z.object({
  after: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(1000).default(500),
});
const JobsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  before: z.uuid().optional(),
});

/** Zod-checks a debug route's query; a failure is the standard 400. */
function parseQuery<S extends z.ZodType>(
  schema: S,
  raw: Record<string, string | undefined>,
): z.output<S> {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    throw new ValidationError(
      parsed.error.issues.map((i) => ({
        path: i.path.join(".") || "query",
        message: i.message,
      })),
    );
  }
  return parsed.data;
}

/** Operator debug view of a job (specs/037-debug-api contracts/debug-api.md). No claim token. */
function toDebugJob(job: DmJobRow) {
  return {
    id: job.id,
    kind: job.kind,
    status: job.status,
    stage: job.stage,
    attempts: job.attempts,
    input: job.input,
    result: job.result,
    error: job.error,
    createdAt: job.createdAt.toISOString(),
    startedAt: job.startedAt?.toISOString() ?? null,
    heartbeatAt: job.heartbeatAt?.toISOString() ?? null,
    finishedAt: job.finishedAt?.toISOString() ?? null,
  };
}

interface TurnItem {
  id: string;
  kind: "turn" | "floor" | "companion" | "chronicle";
  status: string;
  stage: string | null;
  attempts: number;
  trigger: TurnTrigger | null;
  createdAt: string;
  finishedAt: string | null;
  outcome: string | null;
  audit: AuditRecord | null;
  calls: { purpose: string; promptVersion: string; outcome: string }[];
  error: string | null;
}

function toItem(job: DmJobRow): TurnItem {
  const result = (job.result ?? {}) as {
    outcome?: { status?: string };
    audit?: AuditRecord | null;
    calls?: { purpose: string; promptVersion: string; outcome: string }[];
  };
  const input = (job.input ?? {}) as { trigger?: TurnTrigger };
  return {
    id: job.id,
    kind: job.kind,
    status: job.status,
    stage: job.stage,
    attempts: job.attempts,
    trigger: job.kind === "turn" ? (input.trigger ?? null) : null,
    createdAt: job.createdAt.toISOString(),
    finishedAt: job.finishedAt?.toISOString() ?? null,
    outcome:
      result.outcome?.status ?? (job.status === "failed" ? "failed" : null),
    audit: result.audit ?? null,
    calls: (result.calls ?? []).map((c) => ({
      purpose: c.purpose,
      promptVersion: c.promptVersion,
      outcome: c.outcome,
    })),
    // Only fixed strings are ever stored here (worker.ts); never prompt text.
    error: job.error,
  };
}

export function createDmRoutes({
  db,
  validateSession,
  nudge,
  loadProjections,
}: CreateDmRoutesOptions) {
  const route = new Hono<{ Variables: AuthVariables }>();
  route.use("*", createAuthMiddleware(validateSession));

  function requireOperator(c: {
    get: (k: "identity") => AuthVariables["identity"];
  }) {
    const identity = c.get("identity");
    if (!identity) throw new UnauthorizedError();
    if (identity.role !== "operator") throw new ForbiddenError();
  }

  function sessionIdOf(raw: string | undefined): string {
    const parsed = UuidSchema.safeParse(raw);
    if (!parsed.success) {
      throw new ValidationError([
        { path: "sessionId", message: "sessionId must be a UUID." },
      ]);
    }
    return parsed.data;
  }

  route.post("/sessions/:sessionId/start", async (c) => {
    requireOperator(c);
    const sessionId = sessionIdOf(c.req.param("sessionId"));
    let raw: unknown;
    try {
      raw = await c.req.json();
    } catch {
      throw new ValidationError([
        { path: "body", message: "Body must be JSON." },
      ]);
    }
    const body = StartBodySchema.safeParse(raw);
    if (!body.success) {
      throw new ValidationError(
        body.error.issues.map((i) => ({
          path: i.path.join(".") || "body",
          message: i.message,
        })),
      );
    }
    let seed: ReturnType<typeof loadSeed>;
    try {
      seed = loadSeed(body.data.seedId);
    } catch (error) {
      if (error instanceof SeedError) {
        throw new ValidationError(
          error.issues.map((message) => ({ path: "seedId", message })),
        );
      }
      throw error;
    }
    const humans = seed.characters
      .filter((ch) => ch.seat === "human")
      .map((ch) => ch.characterId);
    const issues = [
      ...humans
        .filter((id) => !(id in body.data.seats))
        .map((id) => ({
          path: `seats.${id}`,
          message: "A human seat needs a user id.",
        })),
      ...Object.keys(body.data.seats)
        .filter((id) => !humans.includes(id))
        .map((id) => ({
          path: `seats.${id}`,
          message: "Not a human character in this seed.",
        })),
    ];
    if (issues.length > 0) throw new ValidationError(issues);

    const projections = await loadProjections(sessionId);
    if (projections.scene !== null) {
      throw new ConflictError("The session already has a scene.");
    }
    const pending = (await listDmJobs(db, sessionId, 100, "turn")).some(
      (j) =>
        (j.status === "queued" || j.status === "running") &&
        (j.input as { trigger?: string }).trigger === "scene-start",
    );
    if (pending) throw new ConflictError("A scene start is already queued.");

    const result = await enqueueTurn(db, sessionId, "scene-start", null, {
      start: body.data,
    });
    if (!result.inserted) {
      throw new ConflictError("A turn is already queued for this session.");
    }
    nudge();
    return c.json({ jobId: result.jobId }, 202);
  });

  route.post("/sessions/:sessionId/turn", async (c) => {
    requireOperator(c);
    const sessionId = sessionIdOf(c.req.param("sessionId"));
    const result = await enqueueTurn(db, sessionId, "manual", null);
    nudge();
    return c.json({ jobId: result.jobId }, 202);
  });

  route.get("/sessions/:sessionId/turns", async (c) => {
    requireOperator(c);
    const sessionId = sessionIdOf(c.req.param("sessionId"));
    const q = TurnsQuerySchema.safeParse({ limit: c.req.query("limit") });
    if (!q.success) {
      throw new ValidationError([
        { path: "limit", message: "limit must be an integer 1-100." },
      ]);
    }
    const rows = await listDmJobs(db, sessionId, q.data.limit);
    return c.json({ turns: rows.map(toItem) });
  });

  // Operator debug routes (specs/037-debug-api contracts/debug-api.md).
  // Auth runs before any validation or read.

  route.get("/sessions/:sessionId/events", async (c) => {
    requireOperator(c);
    const sessionId = sessionIdOf(c.req.param("sessionId"));
    const q = parseQuery(EventsQuerySchema, {
      after: c.req.query("after"),
      limit: c.req.query("limit"),
    });
    const rows = await readFrom(db, {
      sessionId,
      afterSeq: q.after,
      limit: q.limit + 1,
    });
    const hasMore = rows.length > q.limit;
    const page = hasMore ? rows.slice(0, q.limit) : rows;
    const [head] = await db
      .select({ seq: max(events.seq) })
      .from(events)
      .where(eq(events.sessionId, sessionId));
    return c.json({
      events: page.map(toStoredEvent),
      nextAfter: page.at(-1)?.seq ?? q.after,
      hasMore,
      headSeq: head?.seq ?? 0,
    });
  });

  route.get("/sessions/:sessionId/jobs", async (c) => {
    requireOperator(c);
    const sessionId = sessionIdOf(c.req.param("sessionId"));
    const q = parseQuery(JobsQuerySchema, {
      limit: c.req.query("limit"),
      before: c.req.query("before"),
    });
    const page = await listDmJobsPage(db, sessionId, {
      limit: q.limit,
      before: q.before,
    });
    if (!page) {
      throw new ValidationError([
        { path: "before", message: "before must be a job of this session." },
      ]);
    }
    return c.json({
      jobs: page.rows.map(toDebugJob),
      nextBefore: page.hasMore ? (page.rows.at(-1)?.id ?? null) : null,
    });
  });

  route.get("/sessions/:sessionId/seed", async (c) => {
    requireOperator(c);
    const sessionId = sessionIdOf(c.req.param("sessionId"));
    const { scene } = await loadProjections(sessionId);
    if (scene === null) throw new NotFoundError("The session has no scene.");
    let seed: ReturnType<typeof loadSeed>;
    try {
      seed = loadSeed(scene.sceneId);
    } catch (error) {
      if (error instanceof SeedError) {
        console.warn(
          JSON.stringify({
            event: "dm.debug.seed-load-failed",
            sessionId,
            seedId: scene.sceneId,
            issues: error.issues,
          }),
        );
        throw new ConflictError("The session's seed did not load.");
      }
      throw error;
    }
    return c.json({
      seedId: seed.seedId,
      seed,
      dmOnlyPaths: dmOnlySeedPaths(seed),
    });
  });

  route.get("/sessions/:sessionId/calls", async (c) => {
    requireOperator(c);
    const sessionId = sessionIdOf(c.req.param("sessionId"));
    const q = parseQuery(EventsQuerySchema, {
      after: c.req.query("after"),
      limit: c.req.query("limit"),
    });
    const page = await listModelCalls(db, sessionId, {
      after: q.after,
      limit: q.limit,
    });
    const totals = await modelCallTotals(db, sessionId);
    return c.json({
      calls: page.rows.map((r) => ({
        id: r.id,
        jobId: r.jobId,
        jobKind: r.jobKind,
        jobAttempt: r.jobAttempt,
        purpose: r.purpose,
        promptVersion: r.promptVersion,
        callAttempt: r.callAttempt,
        outcome: r.outcome,
        errorKind: r.errorKind,
        provider: r.provider,
        model: r.model,
        inputTokens: r.inputTokens,
        outputTokens: r.outputTokens,
        costUsd: r.costUsd,
        durationMs: r.durationMs,
        httpAttempts: r.httpAttempts,
        at: r.createdAt.toISOString(),
      })),
      nextAfter: page.rows.at(-1)?.id ?? q.after,
      hasMore: page.hasMore,
      totals,
    });
  });

  return route;
}
