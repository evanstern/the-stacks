import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { sql } from "drizzle-orm";
import { beforeEach } from "vitest";
import { createDmEnqueuer } from "../../src/dm/enqueue.js";
import type { Nodes } from "../../src/dm/pipeline/runner.js";
import { loadSeed } from "../../src/dm/seed/load.js";
import type { SceneSeed } from "../../src/dm/seed/schema.js";
import { createDmWorker, type DmWorkerDeps } from "../../src/dm/worker.js";
import type { PresenceReader } from "../../src/presence/index.js";
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
    nodes?: Nodes;
    reactQuietMs?: number;
    /** Talk turns (spec 066 FR-007): the read window in ms after a post (default 10000). */
    talkQuietMs?: number;
    /** False leaves the gate listener off, so a test queues jobs by hand. */
    listen?: boolean;
    /** Floor jobs (specs/049-turn-floor): the presence reader and the injected waits (ms). */
    presence?: PresenceReader;
    floorAbsenceWaitMs?: number;
    floorStallWindowMs?: number;
    gateway?: DmWorkerDeps["gateway"];
    /** A seed not in the seeds directory (fixture seeds): spec 107 Phase 4. */
    loadSeed?: (seedId: string) => SceneSeed;
    heartbeatMs?: number;
    log?: (line: Record<string, unknown>) => void;
    onNarrationStream?: DmWorkerDeps["onNarrationStream"];
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
    reactQuietMs: opts.reactQuietMs,
    readWindowMs:
      opts.talkQuietMs === undefined
        ? undefined
        : () => opts.talkQuietMs as number,
    loadSeed: opts.loadSeed ?? ((id) => loadSeed(id)),
    presence: opts.presence,
    floorAbsenceWaitMs: opts.floorAbsenceWaitMs,
    floorStallWindowMs: opts.floorStallWindowMs,
  });
  if (opts.listen !== false) {
    w.gate.onAppended((sessionId, rows) => {
      void enqueuer.onAppended(sessionId, rows);
    });
  }
  const worker = createDmWorker({
    db: requireDb(),
    gateway: opts.gateway ?? base.gateway,
    heartbeatMs: opts.heartbeatMs,
    gate: w.gate,
    nodes: opts.nodes,
    loadSeed: opts.loadSeed,
    loadProjections: base.loadProjections,
    presence: opts.presence,
    floorAbsenceWaitMs: opts.floorAbsenceWaitMs,
    floorStallWindowMs: opts.floorStallWindowMs,
    onNarrationStream: opts.onNarrationStream,
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
        sql`DELETE FROM jobs WHERE kind IN ('turn', 'companion', 'chronicle', 'floor')`,
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

export type Gw = NonNullable<DmWorkerDeps["gateway"]>;

/** Wraps the world gateway so the `dm.narrate` call stalls until `release()`. */
export function pausing(base: Gw) {
  let release!: () => void;
  const gate = new Promise<void>((r) => {
    release = r;
  });
  let paused!: () => void;
  const reached = new Promise<void>((r) => {
    paused = r;
  });
  const gateway = {
    chat(req: Parameters<Gw["chat"]>[0]) {
      if (req.purpose !== "dm.narrate") return base.chat(req);
      return (async function* () {
        paused();
        await gate;
        yield* base.chat(req);
      })();
    },
  } as Gw;
  return { gateway, release, reached };
}
