import { Hono } from "hono";
import type { DatabaseProbe } from "../db.js";

/**
 * See specs/003-hono-server/contracts/health.md — a fixed seam contract —
 * amended additively by specs/010-worktree-stacks/contracts/health.md
 * (`commit`, which never feeds `status`).
 */
export interface HealthReport {
  status: "ok" | "degraded";
  process: { uptimeSeconds: number };
  database: { reachable: boolean };
  commit: string;
}

/**
 * GET /health — always 200. `status` is derived, never set independently:
 * "ok" only when every dependency fact below it is true (data-model.md).
 * `commit` is baked-in build metadata (config.ts) and never affects `status`.
 */
export function createHealthRoute(
  databaseProbe: DatabaseProbe,
  commit: string,
) {
  const route = new Hono();

  route.get("/", async (c) => {
    const reachable = await databaseProbe.reachable();
    const report: HealthReport = {
      status: reachable ? "ok" : "degraded",
      process: { uptimeSeconds: process.uptime() },
      database: { reachable },
      commit,
    };
    return c.json(report);
  });

  return route;
}
