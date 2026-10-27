import { randomUUID } from "node:crypto";
import type { SessionProjections } from "@the-stacks/session-model";
import { compact, getById, getByName } from "@the-stacks/srd";
import type { Gateway } from "../ai/gateway.js";
import type { DbClient } from "../auth/session.js";
import type { Gate } from "../gate/index.js";
import {
  finishJob,
  HEARTBEAT_MS,
  heartbeat,
  POLL_MS,
  setStage,
} from "../jobs/queue.js";
import { loadProjections as loadSessionProjections } from "../session/projections.js";
import { runChronicleJob } from "./chronicle.js";
import { type CompanionDeps, runCompanionJob } from "./companion.js";
import {
  type ClaimedDmJob,
  claimDmJob,
  enqueueChronicle,
  enqueueCompanion,
  enqueueTurn,
  enqueueTurnForced,
  loadCheckpoint,
  reconcileTurnJobs,
  saveCheckpoint,
  type TurnCheckpoint,
  type TurnFailure,
  type TurnFailureResult,
} from "./jobs.js";
import { insertModelCall } from "./model-calls.js";
import { adjudicate } from "./nodes/adjudicate.js";
import { assemble } from "./nodes/assemble.js";
import { audit } from "./nodes/audit.js";
import { director } from "./nodes/director.js";
import { interpret } from "./nodes/interpret.js";
import { narrate } from "./nodes/narrate.js";
import { resolve, submitFailureNotice } from "./nodes/resolve.js";
import type {
  NodeDeps,
  RecordedCall,
  SrdLookup,
  TurnContext,
  TurnOutcome,
} from "./pipeline/context.js";
import { type Nodes, runTurn } from "./pipeline/runner.js";
import { loadSeed } from "./seed/load.js";
import type { SceneSeed } from "./seed/schema.js";

/**
 * The DM worker (contracts/turn-jobs.md): polls the shared jobs queue for
 * `turn`, `companion` and `chronicle` jobs, holds a heartbeat lease with
 * abort on fence loss, runs the job, finishes it fenced, and queues the jobs
 * that follow. It never calls `gate.submit` itself: only resolve, companion
 * and chronicle do (AC #5).
 */

export const DEFAULT_NODES: Nodes = {
  assemble,
  director,
  interpret,
  adjudicate,
  resolve,
  narrate,
  audit,
};

export interface DmWorkerDeps {
  db: DbClient;
  gateway: Pick<Gateway, "chat">;
  gate: Pick<Gate, "submit" | "recordPresence">;
  retrieve: NodeDeps["retrieve"];
  /** The DM view of a session (the log folded for `{ role: "dm" }`). */
  loadProjections: NodeDeps["loadProjections"];
  /**
   * The DM view as of `throughSeq` (the chronicle's state-at-seq read). The
   * default reads the log through `session/projections`.
   */
  loadProjectionsThrough?: (
    sessionId: string,
    throughSeq: number,
  ) => Promise<SessionProjections>;
  /** ASK_MIN_SIMILARITY. */
  minSimilarity: number;
  /** Test seams; the defaults are the real nodes, SRD and seed loader. */
  nodes?: Nodes;
  srd?: SrdLookup;
  loadSeed?: (seedId: string) => SceneSeed;
  newId?: () => string;
  log?: (line: Record<string, unknown>) => void;
  pollMs?: number;
  heartbeatMs?: number;
}

export interface DmWorker {
  /** Claims and runs one job; false when nothing was claimable. */
  processOne(): Promise<boolean>;
  /** Runs jobs until none is claimable; returns how many ran. */
  drain(): Promise<number>;
  reconcile(): Promise<string[]>;
  nudge(): void;
  stop(): Promise<void>;
}

const defaultLog = (line: Record<string, unknown>) =>
  console.log(JSON.stringify(line));

export function createDmWorker(deps: DmWorkerDeps): DmWorker {
  const { db } = deps;
  const log = deps.log ?? defaultLog;
  const nodes = deps.nodes ?? DEFAULT_NODES;
  const seedLoader = deps.loadSeed ?? ((id: string) => loadSeed(id));
  const loadProjectionsThrough =
    deps.loadProjectionsThrough ??
    ((sessionId: string, throughSeq: number) =>
      loadSessionProjections(db, sessionId, { role: "dm" }, { throughSeq }));
  const srd: SrdLookup =
    deps.srd ?? ({ getById, getByName, compact } as SrdLookup);
  const newId = deps.newId ?? randomUUID;
  let stopped = false;
  let wakeSleep: (() => void) | undefined;

  async function notice(
    sessionId: string,
    node: string,
    kind: string,
  ): Promise<void> {
    try {
      await submitFailureNotice(deps, sessionId, node, kind);
    } catch (error) {
      log({
        event: "dm.notice.failed",
        sessionId,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /** One ledger writer per claimed job; a failed insert is logged, never thrown. */
  function recorderFor(
    job: ClaimedDmJob,
  ): (call: RecordedCall) => Promise<void> {
    return async (call) => {
      try {
        await insertModelCall(
          db,
          {
            jobId: job.id,
            sessionId: job.sessionId,
            jobKind: job.kind,
            jobAttempt: job.attempts,
          },
          call,
        );
      } catch {
        log({
          event: "dm.call.record-failed",
          jobId: job.id,
          purpose: call.purpose,
        });
      }
    };
  }

  async function currentSeed(
    job: Extract<ClaimedDmJob, { kind: "turn" }>,
  ): Promise<SceneSeed | "no-scene" | "bad-seed"> {
    try {
      if (job.input.trigger === "scene-start") {
        if (!job.input.start) return "bad-seed";
        return seedLoader(job.input.start.seedId);
      }
      const p = await deps.loadProjections(job.sessionId);
      if (!p.scene) return "no-scene";
      return seedLoader(p.scene.sceneId);
    } catch {
      return "bad-seed";
    }
  }

  async function runTurnJob(
    job: Extract<ClaimedDmJob, { kind: "turn" }>,
    controller: AbortController,
    fence: () => Promise<boolean>,
  ): Promise<void> {
    const seed = await currentSeed(job);
    // The Director reads who is at the table from this marker (decision-0024).
    let presenceSeq: number | null = null;
    let presenceFailure: TurnFailure | null = null;
    try {
      const recorded = await deps.gate.recordPresence(job.sessionId, {
        purpose: "director",
      });
      if (recorded.ok) presenceSeq = recorded.event.seq;
      else {
        presenceFailure = {
          node: "presence",
          kind: "gate",
          message: recorded.refusal.message,
          detail: { code: recorded.refusal.code },
        };
      }
    } catch (error) {
      presenceFailure = {
        node: "presence",
        kind: "internal",
        message: error instanceof Error ? error.message : String(error),
        detail: null,
      };
    }
    let latest: TurnCheckpoint = loadCheckpoint(job) ?? {
      beat: null,
      npcTurn: null,
      director: null,
      interpret: null,
      adjudicate: null,
      submissions: [],
      lastSeq: 0,
      narration: null,
    };

    if (presenceFailure) {
      const failed: TurnFailureResult = {
        checkpoint: latest,
        outcome: { status: "failed" },
        audit: null,
        calls: [],
        failure: presenceFailure,
        presenceSeq: null,
      };
      log({ event: "dm.turn.failed", jobId: job.id, node: "presence" });
      if (
        await finishJob(db, job, {
          error: `stopped at presence: ${presenceFailure.kind}`,
          result: failed,
        })
      ) {
        await notice(job.sessionId, "presence", presenceFailure.kind);
      }
      return;
    }

    if (seed === "no-scene") {
      await finishJob(db, job, {
        result: {
          checkpoint: latest,
          outcome: { status: "empty-beat" },
          audit: null,
          calls: [],
          presenceSeq,
        },
      });
      return;
    }
    if (seed === "bad-seed") {
      const failed: TurnFailureResult = {
        checkpoint: latest,
        outcome: { status: "failed" },
        audit: null,
        calls: [],
        failure: {
          node: "assemble",
          kind: "seed",
          message: "the scene seed did not load",
          detail: null,
        },
        presenceSeq,
      };
      if (
        await finishJob(db, job, {
          error: "stopped at assemble: seed",
          result: failed,
        })
      ) {
        await notice(job.sessionId, "assemble", "seed");
      }
      return;
    }

    const nodeDeps: NodeDeps = {
      gateway: deps.gateway,
      gate: deps.gate,
      retrieve: deps.retrieve,
      loadProjections: deps.loadProjections,
      srd,
      fence,
      setStage: async (stage) => {
        const ok = await setStage(db, job, stage);
        if (!ok) controller.abort();
        return ok;
      },
      saveCheckpoint: async (c) => {
        const ok = await saveCheckpoint(db, job, c);
        if (ok) latest = c;
        else controller.abort();
        return ok;
      },
      newId,
      log,
      minSimilarity: deps.minSimilarity,
      recordCall: recorderFor(job),
    };
    const ctx: TurnContext = {
      job: {
        id: job.id,
        sessionId: job.sessionId,
        trigger: job.input.trigger,
        triggerSeq: job.input.triggerSeq,
        forceResolve: job.input.forceResolve,
        attempt: job.attempts,
        claimToken: job.claimToken,
        start: job.input.start,
      },
      deps: nodeDeps,
      signal: controller.signal,
      seed,
      checkpoint: latest,
      results: {},
    };

    let outcome: TurnOutcome;
    try {
      outcome = await runTurn(ctx, nodes);
    } catch (error) {
      log({
        event: "dm.turn.threw",
        jobId: job.id,
        message: error instanceof Error ? error.message : String(error),
      });
      outcome = {
        status: "failed",
        node: "resolve",
        error: { kind: "internal", message: "the turn threw" },
        calls: [],
      };
    }

    if (outcome.status === "failed") {
      // A lost lease or a shutdown leaves the job for a reclaim.
      if (
        outcome.error.kind === "fenced" ||
        outcome.error.kind === "aborted" ||
        controller.signal.aborted
      ) {
        return;
      }
      // The log carries the detail without attempt excerpts (model text).
      const { attempts: _excerpts, ...loggable } = outcome.error.detail ?? {};
      log({
        event: "dm.turn.failed",
        jobId: job.id,
        node: outcome.node,
        kind: outcome.error.kind,
        detail: outcome.error.detail ? loggable : null,
      });
      const failed: TurnFailureResult = {
        checkpoint: latest,
        outcome: { status: "failed" },
        audit: null,
        calls: outcome.calls,
        failure: {
          node: outcome.node,
          kind: outcome.error.kind,
          message: outcome.error.message,
          detail: outcome.error.detail ?? null,
        },
        presenceSeq,
      };
      const finished = await finishJob(db, job, {
        error: `stopped at ${outcome.node}: ${outcome.error.kind}`,
        result: failed,
      });
      if (finished)
        await notice(job.sessionId, outcome.node, outcome.error.kind);
      return;
    }

    const calls =
      outcome.status === "completed" || outcome.status === "held"
        ? outcome.calls
        : [];
    const auditRecord =
      outcome.status === "completed" ? outcome.results.audit.record : null;
    const finished = await finishJob(db, job, {
      result: {
        checkpoint: latest,
        outcome: { status: outcome.status },
        audit: auditRecord,
        calls,
        presenceSeq,
      },
    });
    if (!finished) return;

    if (outcome.status === "held") {
      await enqueueCompanion(db, {
        sessionId: job.sessionId,
        companions: outcome.companions,
        reason: "hold",
        beatJobId: job.id,
      });
      return;
    }
    if (outcome.status !== "completed") return;

    const resolved = outcome.results.resolve;
    const next = resolved.nextJob;
    if (next?.kind === "turn") {
      await enqueueTurn(db, job.sessionId, "npc-turn", latest.lastSeq || null);
    } else if (next?.kind === "companion") {
      await enqueueCompanion(db, {
        sessionId: job.sessionId,
        companions: next.companions,
        reason: next.reason,
        beatJobId: null,
      });
    }
    if (resolved.chronicle) {
      const p = await deps.loadProjections(job.sessionId);
      await enqueueChronicle(db, job.sessionId, p.throughSeq);
    }
  }

  async function runSideJob(
    job: Extract<ClaimedDmJob, { kind: "companion" | "chronicle" }>,
    controller: AbortController,
    fence: () => Promise<boolean>,
  ): Promise<void> {
    try {
      let result: unknown;
      if (job.kind === "companion") {
        const companionDeps: CompanionDeps = {
          gateway: deps.gateway,
          gate: deps.gate,
          loadProjections: deps.loadProjections,
          loadSeed: seedLoader,
          enqueueTurnForced: (sessionId) => enqueueTurnForced(db, sessionId),
          fence,
          log,
          recordCall: recorderFor(job),
        };
        result = await runCompanionJob(companionDeps, job, controller.signal);
      } else {
        result = await runChronicleJob(
          {
            gateway: deps.gateway,
            gate: deps.gate,
            loadProjections: deps.loadProjections,
            loadProjectionsThrough,
            loadSeed: seedLoader,
            fence,
            log,
            recordCall: recorderFor(job),
          },
          job,
          controller.signal,
        );
      }
      if (controller.signal.aborted) return;
      await finishJob(db, job, {
        result: { ...(result as object), outcome: { status: "completed" } },
      });
    } catch (error) {
      log({
        event: `dm.${job.kind}.threw`,
        jobId: job.id,
        message: error instanceof Error ? error.message : String(error),
      });
      if (controller.signal.aborted) return;
      const finished = await finishJob(db, job, {
        error: `stopped at ${job.kind}: internal`,
      });
      // A failed companion or chronicle job leaves the actions committed and
      // the next turn runnable, so no notice is needed beyond the job row.
      void finished;
      if (job.kind === "companion" && job.input.reason === "hold") {
        await enqueueTurnForced(db, job.sessionId).catch(() => {});
      }
    }
  }

  async function processOne(): Promise<boolean> {
    const job = await claimDmJob(db, {
      onAbandoned: (j) => notice(j.sessionId, j.kind, "abandoned"),
    });
    if (!job) return false;

    const controller = new AbortController();
    const fence = async (): Promise<boolean> => {
      const ok = await heartbeat(db, job);
      if (!ok) controller.abort();
      return ok;
    };
    const timer = setInterval(() => {
      fence().catch(() => controller.abort());
    }, deps.heartbeatMs ?? HEARTBEAT_MS);

    try {
      if (job.kind === "turn") await runTurnJob(job, controller, fence);
      else await runSideJob(job, controller, fence);
    } finally {
      clearInterval(timer);
    }
    return true;
  }

  async function drain(): Promise<number> {
    let n = 0;
    while (await processOne()) n += 1;
    return n;
  }

  function reconcile(): Promise<string[]> {
    return reconcileTurnJobs(db);
  }

  const wait = (ms: number) => {
    let wake!: () => void;
    const promise = new Promise<void>((res) => {
      const t = setTimeout(res, ms);
      wake = () => {
        clearTimeout(t);
        res();
      };
    });
    return { promise, wake };
  };

  let loopDone: Promise<void> = Promise.resolve();
  function startLoop(): void {
    loopDone = (async () => {
      await reconcile().catch((error) =>
        log({
          event: "dm.reconcile.failed",
          message: error instanceof Error ? error.message : String(error),
        }),
      );
      while (!stopped) {
        try {
          const did = await processOne();
          if (!did && !stopped) {
            const { promise, wake } = wait(deps.pollMs ?? POLL_MS);
            wakeSleep = wake;
            await promise;
            wakeSleep = undefined;
          }
        } catch (error) {
          log({
            event: "dm.worker.iteration.failed",
            message: error instanceof Error ? error.message : String(error),
          });
          if (!stopped) {
            const { promise, wake } = wait(deps.pollMs ?? POLL_MS);
            wakeSleep = wake;
            await promise;
            wakeSleep = undefined;
          }
        }
      }
    })();
  }

  const worker: DmWorker & { start(): void } = {
    processOne,
    drain,
    reconcile,
    nudge() {
      wakeSleep?.();
    },
    async stop() {
      stopped = true;
      wakeSleep?.();
      await loopDone;
    },
    start: startLoop,
  };
  return worker;
}

/** Creates the worker and starts its loop: reconcile at start, then poll. */
export function startDmWorker(deps: DmWorkerDeps): DmWorker {
  const worker = createDmWorker(deps) as DmWorker & { start(): void };
  worker.start();
  return worker;
}
