import { Hono } from "hono";
import type { DatabaseProbe } from "../db.js";

/** See specs/003-hono-server/contracts/health.md — a fixed seam contract. */
export interface HealthReport {
  status: "ok" | "degraded";
  process: { uptimeSeconds: number };
  database: { reachable: boolean };
}

/**
 * GET /health — always 200. `status` is derived, never set independently:
 * "ok" only when every dependency fact below it is true (data-model.md).
 */
export function createHealthRoute(databaseProbe: DatabaseProbe) {
  const route = new Hono();

  route.get("/", async (c) => {
    const reachable = await databaseProbe.reachable();
    const report: HealthReport = {
      status: reachable ? "ok" : "degraded",
      process: { uptimeSeconds: process.uptime() },
      database: { reachable },
    };
    return c.json(report);
  });

  return route;
}
