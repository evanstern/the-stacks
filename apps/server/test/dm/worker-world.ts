import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { sql } from "drizzle-orm";
import { beforeEach } from "vitest";
import { createDmEnqueuer } from "../../src/dm/enqueue.js";
import type { Nodes } from "../../src/dm/pipeline/runner.js";
import { createDmWorker, type DmWorkerDeps } from "../../src/dm/worker.js";
import { db, requireDb, type World } from "./world.js";

const SCRIPTS = join(dirname(fileURLToPath(import.meta.url)), "scripts");
export const script = (name: string) =>
  JSON.parse(readFileSync(join(SCRIPTS, name), "utf8")) as {
    dice: number[];
    calls: unknown[];
  };

export function workerFor(
  w: World,
  opts: {
    retrieve?: DmWorkerDeps["retrieve"];
    nodes?: Nodes;
    gateway?: DmWorkerDeps["gateway"];
    heartbeatMs?: number;
    log?: (line: Record<string, unknown>) => void;
  } = {},
) {
  const base = w.ctx().deps;
  const nudges = { count: 0 };
  const enqueuer = createDmEnqueuer({
    db: requireDb(),
    nudge: () => {
      nudges.count += 1;
    },
    loadProjections: base.loadProjections,
  });
  w.gate.onAppended((sessionId, rows) => {
    void enqueuer.onAppended(sessionId, rows);
  });
  const worker = createDmWorker({
    db: requireDb(),
    gateway: opts.gateway ?? base.gateway,
    heartbeatMs: opts.heartbeatMs,
    gate: w.gate,
    retrieve:
      opts.retrieve ??
      (async () => {
        throw new Error("no retrieval in this test");
      }),
    nodes: opts.nodes,
    loadProjections: base.loadProjections,
    minSimilarity: 0.3,
    log: (l) => {
      opts.log?.(l);
      if (process.env.DM_TEST_LOG) console.log(l);
    },
  });
  return { worker, enqueuer, nudges };
}

export function clearDmJobsBeforeEach() {
  beforeEach(async () => {
    // Claims are global; clear other sessions' DM jobs so each test drains its own.
    if (db) {
      await db.execute(
        sql`DELETE FROM jobs WHERE kind IN ('turn', 'companion', 'chronicle')`,
      );
    }
  });
}

export const tick = () => new Promise((r) => setTimeout(r, 50));

/**
 * Drains until a drain finds nothing after a settle pause. A gate listener
 * enqueues asynchronously, so one empty drain is not proof of idleness.
 */
export async function drainAll(worker: {
  drain: () => Promise<number>;
}): Promise<number> {
  let total = 0;
  for (;;) {
    const n = await worker.drain();
    total += n;
    await tick();
    if (n === 0) return total;
  }
}
