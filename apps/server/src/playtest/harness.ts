import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { Proposer } from "@the-stacks/session-model";
import type { FakeProvider } from "../ai/adapters/fake.js";
import { createGateway } from "../ai/gateway.js";
import type { UsageRecord } from "../ai/types.js";
import { memorySink } from "../ai/usage.js";
import type { DbClient } from "../auth/session.js";
import { createDmEnqueuer } from "../dm/enqueue.js";
import { enqueueTurn, listDmJobs } from "../dm/jobs.js";
import { createScriptedDm, loadDmScript } from "../dm/script/load.js";
import { createDmWorker } from "../dm/worker.js";
import { createGate } from "../gate/index.js";
import { loadProjections } from "../session/projections.js";
import { renderTranscript } from "./auditor/render.js";
import type { RunManifest } from "./auditor/schema.js";
import { type DriverState, nextMove } from "./driver.js";
import { exportSession, writeRunDir } from "./export.js";
import type { Scenario } from "./scenario.js";

/**
 * The playtest run (specs/032-playtest-harness plan.md "CI mode wiring"):
 * the real gate, gateway, DM enqueuer and worker in process, a scripted human
 * seat through `gate.handle`, every model call answered from fixtures.
 */

export interface RunPlaytestOptions {
  db: DbClient;
  scenario: Scenario;
  mode: "ci";
  /** Run directory to write. */
  out: string;
  signal?: AbortSignal;
}

const SETTLE_MS = 50;
const settle = () => new Promise((r) => setTimeout(r, SETTLE_MS));

/**
 * Drains until a drain finds nothing after a settle pause. A gate listener
 * enqueues asynchronously, so one empty drain is not proof of idleness.
 */
async function drainIdle(worker: { drain: () => Promise<number> }) {
  for (;;) {
    const n = await worker.drain();
    await settle();
    if (n === 0) return;
  }
}

function gitCommit(): string {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "unknown";
  }
}

function utcStamp(d: Date): string {
  return d
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d+Z$/, "Z");
}

export async function runPlaytest(
  opts: RunPlaytestOptions,
): Promise<RunManifest> {
  const { db, scenario, out } = opts;
  if (!scenario.ci) {
    throw new Error("runPlaytest: this scenario has no `ci` fixtures");
  }
  const startedAt = new Date();
  const ci = scenario.ci;
  const readJson = (p: string) => JSON.parse(readFileSync(p, "utf8"));

  const scripted = createScriptedDm(loadDmScript(readJson(ci.dmScript)));
  const retrieveResult = readJson(ci.retrieve);
  const retrieve = async () => retrieveResult;

  const sessionId = randomUUID();
  let idN = 0;
  const gate = createGate({
    db,
    rng: scripted.gateRng,
    newId: () => `id-${sessionId.slice(0, 8)}-${++idN}`,
  });
  const sink = memorySink();
  const gateway = createGateway({
    config: scripted.aiConfig,
    sink,
    adapters: { fake: () => scripted.provider as FakeProvider },
  });
  const loadDm = () => loadProjections(db, sessionId, { role: "dm" });
  const enqueuer = createDmEnqueuer({
    db,
    nudge: () => {},
    loadProjections: loadDm,
  });
  gate.onAppended((sid, rows) => {
    void enqueuer.onAppended(sid, rows);
  });
  const worker = createDmWorker({
    db,
    gateway,
    gate,
    retrieve,
    loadProjections: loadDm,
    minSimilarity: 0.3,
    log: () => {},
  });

  const human: Proposer = {
    kind: "human",
    userId: scenario.seat.userId,
    role: "player",
  };
  const refusals: { moveIndex: number; code: string }[] = [];
  const state: DriverState = {
    freeIndex: 0,
    moves: 0,
    combatMoves: 0,
    started: false,
  };
  let committed = 0;
  let outcome: RunManifest["outcome"] | null = null;
  let failedJobId: string | undefined;
  const deadline = Date.now() + scenario.limits.maxWallMs;

  const failedJob = async () => {
    const jobs = await listDmJobs(db, sessionId, 500);
    return jobs.find((j) => j.status === "failed");
  };

  // Start the scene the way the /dm start route does.
  await enqueueTurn(db, sessionId, "scene-start", null, {
    start: {
      seedId: scenario.seedId,
      seats: { [scenario.seat.characterId]: scenario.seat.userId },
    },
  });
  await drainIdle(worker);

  for (;;) {
    const failed = await failedJob();
    if (failed) {
      outcome = "failed";
      failedJobId = failed.id;
      break;
    }
    const p = await loadDm();
    if (p.scene !== null) state.started = true;
    if (state.started && p.scene === null) {
      outcome = "ended";
      break;
    }
    if (Date.now() > deadline || opts.signal?.aborted) {
      outcome = "timed-out";
      break;
    }
    const move = nextMove(p, scenario, state);
    if (move === "done" || move === "wait") {
      outcome = "stalled";
      break;
    }
    const moveIndex = state.moves;
    state.moves += 1;
    if (p.tableMode.mode === "turn") state.combatMoves += 1;
    else state.freeIndex += 1;
    const declared = await gate.handle(sessionId, human, {
      kind: "action.declare",
      action: {
        actionId: move.actionId,
        characterId: scenario.seat.characterId,
        scope: "character",
        text: move.text,
      },
    });
    if (!declared.ok) {
      refusals.push({ moveIndex, code: declared.refusal.code });
      continue;
    }
    const commit = await gate.handle(sessionId, human, {
      kind: "action.commit",
      actionId: move.actionId,
    });
    if (!commit.ok) {
      refusals.push({ moveIndex, code: commit.refusal.code });
      continue;
    }
    committed += 1;
    await settle();
    await drainIdle(worker);
  }

  const finishedAt = new Date();
  const artifacts = await exportSession(db, sessionId);
  const records: UsageRecord[] = sink.records;
  const totals = {
    calls: records.length,
    inputTokens: records.reduce((s, r) => s + r.inputTokens, 0),
    outputTokens: records.reduce((s, r) => s + r.outputTokens, 0),
    costUsd: null,
  };
  const models: RunManifest["models"] = {};
  for (const [purpose, cfg] of Object.entries(scripted.aiConfig.purposes)) {
    models[purpose] = { provider: cfg.provider, model: cfg.model };
  }
  const manifest: RunManifest = {
    v: 1,
    runId: `${utcStamp(startedAt)}-${scenario.name}-ci`,
    mode: "ci",
    commit: gitCommit(),
    sessionId,
    seedId: scenario.seedId,
    models,
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    outcome,
    ...(failedJobId ? { failedJobId } : {}),
    moves: { committed, refusals },
    scriptRemaining: scripted.remaining(),
  };
  writeRunDir(path.resolve(out), {
    manifest,
    transcript: artifacts.transcript,
    transcriptMd: renderTranscript(
      artifacts.transcript,
      artifacts.ledger,
      scenario.seat.userId,
    ),
    ledger: artifacts.ledger,
    jobs: artifacts.jobs,
    usage: { records, totals },
  });
  return manifest;
}
