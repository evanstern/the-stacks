import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { Rng } from "@the-stacks/dnd5e-engine";
import { parse } from "@the-stacks/intent";
import { type Proposer, suggestionState } from "@the-stacks/session-model";
import type { FakeProvider } from "../ai/adapters/fake.js";
import type { AiConfig } from "../ai/config.js";
import { createGateway, type Gateway } from "../ai/gateway.js";
import type { AdapterFactory, UsageRecord } from "../ai/types.js";
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
import { budgetGateway, countingSink, providerPreflight } from "./budget.js";
import { scenarioRng } from "./dice.js";
import {
  type DriverState,
  initialDriverState,
  nextMove,
  STALL_LIMIT,
  STALL_REASON_SEAT_DOWNED,
  STALL_REASON_SEAT_EXHAUSTED,
  seatDowned,
  turnChangedState,
} from "./driver.js";
import { exportSession, writeRunDir } from "./export.js";
import {
  PLAYTEST_AUDIT_MAX_TOKENS,
  PLAYTEST_AUDIT_PURPOSE,
} from "./purpose.js";
import {
  type AuditScript,
  loadAuditScript,
  type Scenario,
} from "./scenario.js";

/**
 * The playtest run (specs/032-playtest-harness plan.md "CI mode wiring"):
 * the real gate, gateway, DM enqueuer and worker in process, a scripted human
 * seat through `gate.handle`, every model call answered from fixtures.
 */

/** Provider mode inputs (contracts/cost-guard.md). */
export interface ProviderRunOptions {
  aiConfig: AiConfig;
  env: NodeJS.ProcessEnv;
  /** The spend ceiling in USD; the run stops `budget-stopped` once it is reached. */
  ceilingUsd: number;
  /** Dice seed after the scenario's scripted faces; `null` uses seed 0. */
  seed: number | null;
  /** Handle on the library database (read-only use by retrieval). */
  libraryDb: DbClient;
  /** Test seams: adapter registry and dice. */
  adapters?: Record<string, AdapterFactory>;
  rng?: Rng;
}

export interface RunPlaytestOptions {
  db: DbClient;
  scenario: Scenario;
  mode: "ci" | "provider";
  /** Required when `mode` is `provider`. */
  provider?: ProviderRunOptions;
  /** Run directory to write. */
  out: string;
  /** Overrides the generated run id. */
  runId?: string;
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

/** Queues the scripted auditor responses on purpose `playtest.audit`. */
export function queueAuditScript(
  provider: FakeProvider,
  script: AuditScript,
): void {
  for (const r of script.responses) {
    const { respond, usage } = r;
    provider.scriptChatFor(
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
}

export async function runPlaytest(
  opts: RunPlaytestOptions,
): Promise<RunManifest> {
  const { db, scenario, out } = opts;
  const provider = opts.mode === "provider" ? opts.provider : undefined;
  if (opts.mode === "provider") {
    if (!provider)
      throw new Error("runPlaytest: provider mode needs `provider`");
    if (!(provider.ceilingUsd > 0)) {
      throw new Error(
        "runPlaytest: provider mode needs a positive spend ceiling",
      );
    }
    const refusals = providerPreflight(provider.env, provider.aiConfig, {
      dm: true,
      audit: !opts.noAudit,
    });
    if (refusals.length > 0) {
      throw new Error(
        `runPlaytest: provider preflight refused: ${refusals.map((r) => r.message).join("; ")}`,
      );
    }
  } else if (!scenario.ci) {
    throw new Error("runPlaytest: this scenario has no `ci` fixtures");
  }
  const startedAt = new Date();
  const readJson = (p: string) => JSON.parse(readFileSync(p, "utf8"));

  let aiConfig: AiConfig;
  let gateRng: () => Rng;
  let gateway: Gateway;
  let records: UsageRecord[];
  let totalsNow: () => {
    calls: number;
    inputTokens: number;
    outputTokens: number;
    costUsd: number | null;
  };
  let scriptedRemaining: (() => RunManifest["scriptRemaining"]) | undefined;
  let budgetReached: () => boolean = () => false;
  let diceInfo: () => RunManifest["dice"] = () => undefined;

  if (provider) {
    aiConfig = provider.aiConfig;
    const rng = provider.rng ?? scenarioRng(scenario.dice.faces, provider.seed);
    gateRng = () => rng;
    const sink = countingSink(memorySink());
    const raw = createGateway({
      config: aiConfig,
      sink,
      env: provider.env,
      adapters: provider.adapters,
    });
    gateway = budgetGateway(raw, sink, provider.ceilingUsd);
    records = sink.records;
    totalsNow = () => sink.totals();
    budgetReached = () => sink.totals().costUsd >= provider.ceilingUsd;
    diceInfo = () => ({
      scriptedFaces: scenario.dice.faces.length,
      seed: provider.seed,
      drawn: "drawn" in rng ? (rng as { drawn(): number }).drawn() : 0,
    });
  } else {
    const ci = scenario.ci as NonNullable<Scenario["ci"]>;
    const scripted = createScriptedDm(loadDmScript(readJson(ci.dmScript)));
    // The scripted auditor queue shares the one strict provider (plan.md "CI mode wiring").
    scripted.aiConfig.purposes[PLAYTEST_AUDIT_PURPOSE] = {
      provider: "scripted",
      model: "scripted-chat",
      op: "chat",
      maxTokens: PLAYTEST_AUDIT_MAX_TOKENS,
    };
    queueAuditScript(scripted.provider, loadAuditScript(ci.auditScript));
    aiConfig = scripted.aiConfig;
    gateRng = scripted.gateRng;
    const sink = memorySink();
    gateway = createGateway({
      config: aiConfig,
      sink,
      adapters: { fake: () => scripted.provider as FakeProvider },
    });
    records = sink.records;
    totalsNow = () => ({
      calls: records.length,
      inputTokens: records.reduce((n, r) => n + r.inputTokens, 0),
      outputTokens: records.reduce((n, r) => n + r.outputTokens, 0),
      costUsd: null,
    });
    scriptedRemaining = () => {
      const remaining = scripted.remaining();
      return {
        calls: {
          ...remaining.calls,
          [PLAYTEST_AUDIT_PURPOSE]: scripted.provider.pendingFor(
            PLAYTEST_AUDIT_PURPOSE,
          ),
        },
        dice: remaining.dice,
      };
    };
  }

  const sessionId = randomUUID();
  let idN = 0;
  const gate = createGate({
    db,
    rng: gateRng,
    // The scripted seat is always at the table (CR-001).
    presence: {
      presentUsers: () => [
        { userId: scenario.seat.userId, displayName: "scripted seat" },
      ],
      isPresent: (_sid, actor) =>
        actor.startsWith("ai:") || actor === scenario.seat.userId,
      onChange: () => () => {},
    },
    newId: () => `id-${sessionId.slice(0, 8)}-${++idN}`,
  });
  const loadDm = () => loadProjections(db, sessionId, { role: "dm" });
  const enqueuer = createDmEnqueuer({
    db,
    nudge: () => {},
    loadProjections: loadDm,
    loadSeed: (id) => loadSeed(id),
    // The scripted seat has no one to wait for; a read window would leave the read unclaimed.
    readWindowMs: () => 0,
  });
  gate.onAppended((sid, rows) => {
    void enqueuer.onAppended(sid, rows);
  });
  const worker = createDmWorker({
    db,
    gateway,
    gate,
    loadProjections: loadDm,
    log: () => {},
  });

  const human: Proposer = {
    kind: "human",
    userId: scenario.seat.userId,
    role: "player",
  };
  const refusals: { moveIndex: number; code: string }[] = [];
  const state: DriverState = initialDriverState();
  let stallReason: string | undefined;
  let committed = 0;
  let outcome: RunManifest["outcome"] | null = null;
  let failedJobId: string | undefined;
  const deadline = Date.now() + scenario.limits.maxWallMs;

  const failedJob = async () => {
    const jobs = await listDmJobs(db, sessionId, null);
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
    const overBudget = budgetReached();
    if (failed) {
      // A job that failed because the ceiling cancelled its call is a budget stop.
      outcome = overBudget ? "budget-stopped" : "failed";
      if (!overBudget) failedJobId = failed.id;
      break;
    }
    if (overBudget) {
      outcome = "budget-stopped";
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
      if (move === "done" && seatDowned(p, scenario))
        stallReason = STALL_REASON_SEAT_DOWNED;
      else if (move === "done" && state.stallStreak >= STALL_LIMIT)
        stallReason = STALL_REASON_SEAT_EXHAUSTED;
      break;
    }
    const ledgerMark = p.ledger.reduce((n, r) => Math.max(n, r.seq), 0);
    const moveIndex = state.moves;
    state.moves += 1;
    if (p.tableMode.mode === "turn") state.combatMoves += 1;
    else if (!move.fallback) state.freeIndex += 1;
    if (move.fallback) {
      state.fallbackIndex = (move.fallbackIndex ?? 0) + 1;
      state.lastFallbackText = move.text;
    }
    if (move.confirm) {
      const parsed = parse(move.text, {
        id: move.actionId ?? randomUUID(),
        actor: { kind: "pc", id: scenario.seat.characterId },
        source: "composer",
        commit: "declared",
      });
      if (!parsed.ok) {
        refusals.push({ moveIndex, code: parsed.refusal.code });
        continue;
      }
      const sent = await gate.handle(sessionId, human, {
        kind: "intent",
        intent: parsed.intent,
      } as never);
      if (!sent.ok) {
        refusals.push({ moveIndex, code: sent.refusal.code });
        continue;
      }
      await settle();
      await drainIdle(worker);
      const after = await loadDm();
      const live = after.suggestions.flatMap((sg) =>
        sg.items
          .filter(
            (i) =>
              "id" in i.intent.actor &&
              i.intent.actor.id === scenario.seat.characterId &&
              suggestionState(after, i.intent.id) === "live",
          )
          .map((i) => ({ suggestionId: sg.suggestionId, itemId: i.itemId })),
      );
      if (live.length === 0) {
        refusals.push({ moveIndex, code: "NO_CONFIRM" });
        continue;
      }
      let refused = false;
      for (const a of live) {
        const acc = await gate.handle(sessionId, human, {
          kind: "action.accept",
          ...a,
        } as never);
        if (!acc.ok) {
          refusals.push({ moveIndex, code: acc.refusal.code });
          refused = true;
          break;
        }
      }
      if (refused) continue;
      committed += 1;
      await settle();
      await drainIdle(worker);
      state.stallStreak = 0;
      continue;
    }
    if (move.intent) {
      const parsed = parse(move.text, {
        id: move.actionId ?? randomUUID(),
        actor: { kind: "pc", id: scenario.seat.characterId },
        source: "composer",
        commit: "confirmed",
      });
      if (!parsed.ok) {
        refusals.push({ moveIndex, code: parsed.refusal.code });
        continue;
      }
      const sent = await gate.handle(sessionId, human, {
        kind: "intent",
        intent: parsed.intent,
      } as never);
      if (!sent.ok) {
        refusals.push({ moveIndex, code: sent.refusal.code });
        continue;
      }
      committed += 1;
      await settle();
      await drainIdle(worker);
      state.stallStreak = 0;
      continue;
    }
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
    if (move.fallback) {
      const after = await loadDm();
      state.stallStreak = turnChangedState(after.ledger, ledgerMark)
        ? 0
        : state.stallStreak + 1;
    } else {
      state.stallStreak = 0;
    }
  }

  const finishedAt = new Date();
  const artifacts = await exportSession(db, sessionId);
  const models: RunManifest["models"] = {};
  for (const [purpose, cfg] of Object.entries(aiConfig.purposes)) {
    models[purpose] = { provider: cfg.provider, model: cfg.model };
  }
  const runId =
    opts.runId ?? `${utcStamp(startedAt)}-${scenario.name}-${opts.mode}`;
  const commit = gitCommit();
  let report: ReturnType<typeof ReportSchema.parse> | undefined;
  if (!opts.noAudit) {
    let seed = null;
    try {
      seed = loadSeed(scenario.seedId);
    } catch {
      seed = null;
    }
    const audited = await runAudit({
      transcript: artifacts.transcript,
      ledger: artifacts.ledger,
      jobs: artifacts.jobs,
      seed,
      gateway,
      models,
      signal: opts.signal,
      runId,
      commit,
    });
    if (provider) {
      audited.usage.costUsd = records
        .filter((r) => r.purpose === PLAYTEST_AUDIT_PURPOSE)
        .reduce((n, r) => n + (r.costUsd ?? 0), 0);
    }
    report = ReportSchema.parse(audited);
  }
  const totals = totalsNow();
  const dice = diceInfo();
  const remaining = scriptedRemaining?.();
  const manifest: RunManifest = {
    v: 1,
    runId,
    mode: opts.mode,
    commit,
    sessionId,
    seedId: scenario.seedId,
    models,
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    outcome,
    ...(stallReason ? { stallReason } : {}),
    ...(failedJobId ? { failedJobId } : {}),
    moves: { committed, refusals },
    ...(dice ? { dice } : {}),
    ...(provider
      ? { spend: { ...totals, ceilingUsd: provider.ceilingUsd } }
      : {}),
    ...(remaining ? { scriptRemaining: remaining } : {}),
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
