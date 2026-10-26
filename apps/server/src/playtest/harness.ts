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
import { loadSeed } from "../dm/seed/load.js";
import { createDmWorker } from "../dm/worker.js";
import { createGate } from "../gate/index.js";
import { loadProjections } from "../session/projections.js";
import { runAudit } from "./auditor/audit.js";
import { renderReport, renderTranscript } from "./auditor/render.js";
import { ReportSchema, type RunManifest } from "./auditor/schema.js";
import { type DriverState, nextMove } from "./driver.js";
import { exportSession, writeRunDir } from "./export.js";
import {
  PLAYTEST_AUDIT_MAX_TOKENS,
  PLAYTEST_AUDIT_PURPOSE,
} from "./purpose.js";
import { loadAuditScript, type Scenario } from "./scenario.js";

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
  /** Skip the auditor; the run directory holds no report files. */
  noAudit?: boolean;
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

  // The scripted auditor queue shares the one strict provider (plan.md "CI mode wiring").
  scripted.aiConfig.purposes[PLAYTEST_AUDIT_PURPOSE] = {
    provider: "scripted",
    model: "scripted-chat",
    op: "chat",
    maxTokens: PLAYTEST_AUDIT_MAX_TOKENS,
  };
  const auditScript = loadAuditScript(ci.auditScript);
  for (const r of auditScript.responses) {
    const { respond, usage } = r;
    scripted.provider.scriptChatFor(
      PLAYTEST_AUDIT_PURPOSE,
      respond.type === "error"
        ? [
            {
              type: "error",
              kind: respond.kind,
              message: respond.message,
              usage,
            },
          ]
        : [
            {
              type: "text",
              text:
                respond.type === "json"
                  ? JSON.stringify(respond.value)
                  : respond.value,
            },
            { type: "done", usage },
          ],
    );
  }

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
  const models: RunManifest["models"] = {};
  for (const [purpose, cfg] of Object.entries(scripted.aiConfig.purposes)) {
    models[purpose] = { provider: cfg.provider, model: cfg.model };
  }
  const runId = `${utcStamp(startedAt)}-${scenario.name}-ci`;
  const commit = gitCommit();
  let report: ReturnType<typeof ReportSchema.parse> | undefined;
  if (!opts.noAudit) {
    let seed = null;
    try {
      seed = loadSeed(scenario.seedId);
    } catch {
      seed = null;
    }
    report = ReportSchema.parse(
      await runAudit({
        transcript: artifacts.transcript,
        ledger: artifacts.ledger,
        jobs: artifacts.jobs,
        seed,
        gateway,
        models,
        signal: opts.signal,
        runId,
        commit,
      }),
    );
  }
  const totals = {
    calls: records.length,
    inputTokens: records.reduce((s, r) => s + r.inputTokens, 0),
    outputTokens: records.reduce((s, r) => s + r.outputTokens, 0),
    costUsd: null,
  };
  const remaining = scripted.remaining();
  const manifest: RunManifest = {
    v: 1,
    runId,
    mode: "ci",
    commit,
    sessionId,
    seedId: scenario.seedId,
    models,
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    outcome,
    ...(failedJobId ? { failedJobId } : {}),
    moves: { committed, refusals },
    scriptRemaining: {
      calls: {
        ...remaining.calls,
        [PLAYTEST_AUDIT_PURPOSE]: scripted.provider.pendingFor(
          PLAYTEST_AUDIT_PURPOSE,
        ),
      },
      dice: remaining.dice,
    },
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
    ...(report ? { report, reportMd: renderReport(report) } : {}),
  });
  return manifest;
}
