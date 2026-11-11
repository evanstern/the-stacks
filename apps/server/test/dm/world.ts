import { randomUUID } from "node:crypto";
import type { Proposer } from "@the-stacks/session-model";
import { createGateway } from "../../src/ai/gateway.js";
import { memorySink } from "../../src/ai/usage.js";
import { createDb, probeReachable } from "../../src/db.js";
import type { TurnCheckpoint } from "../../src/dm/jobs.js";
import type { AdjudicateOutput } from "../../src/dm/nodes/adjudicate.js";
import { assemble } from "../../src/dm/nodes/assemble.js";
import type { DirectorNodeOutput } from "../../src/dm/nodes/director.js";
import { type ResolveOutput, resolve } from "../../src/dm/nodes/resolve.js";
import type { InterpretOutput } from "../../src/dm/nodes/schemas.js";
import type { NodeResult, TurnContext } from "../../src/dm/pipeline/context.js";
import {
  createScriptedDm,
  loadDmScript,
  type ScriptedDm,
} from "../../src/dm/script/load.js";
import { loadSeed } from "../../src/dm/seed/load.js";
import { createPlannerInputs } from "../../src/dm/seed/planner-inputs.js";
import type { SceneSeed } from "../../src/dm/seed/schema.js";
import { readFrom } from "../../src/events/log.js";
import { createGate, type Gate } from "../../src/gate/index.js";
import type { PresenceReader } from "../../src/presence/index.js";
import { toStoredEvent } from "../../src/session/events.js";
import { loadProjections } from "../../src/session/projections.js";
import { emptyCheckpoint, makeCtx } from "./helpers.js";

/**
 * A database-backed DM world for the Phase 4+ integration tests: a real gate
 * over a fresh session, scripted dice, and a node context wired to both.
 */

const databaseUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
export const db = databaseUrl ? createDb(databaseUrl) : undefined;
export const reachable = db ? await probeReachable(db.$client, 2000) : false;

export function loudSkip(file: string): void {
  if (reachable) return;
  const notice =
    `\n⚠️  SKIPPING apps/server/test/dm/${file} — no reachable database ` +
    `(tried TEST_DATABASE_URL then DATABASE_URL; got ${databaseUrl ?? "<unset>"}). ` +
    `A skip here proves NOTHING about the DM runtime on a real log. ` +
    `Start one with: pnpm env:up, then set TEST_DATABASE_URL.\n`;
  console.warn(notice);
  if (process.env.REQUIRE_DATABASE === "1") throw new Error(notice);
}

export function requireDb() {
  if (!db) throw new Error("this test requires a database");
  return db;
}

export const TAMSIN_USER = "00000000-0000-4000-8000-0000000000a1";
export const HUMAN_DM = "00000000-0000-4000-8000-0000000000d1";
export const player: Proposer = {
  kind: "human",
  userId: TAMSIN_USER,
  role: "player",
};
export const operator: Proposer = {
  kind: "human",
  userId: HUMAN_DM,
  role: "operator",
};

export const defaultDirector: DirectorNodeOutput = {
  beat: { decision: "resolve" },
  tableMode: { to: "stay" },
  trackers: [],
  scene: { status: "continue" },
  pacing: { tension: "low", spotlight: null, beatId: null },
  goalNote: "",
  companionPrompts: [],
  overrides: [],
};

export interface World {
  sessionId: string;
  gate: Gate;
  scripted: ScriptedDm;
  checkpoint: { current: TurnCheckpoint };
  submitCalls: { count: number };
  ctx: (over?: {
    job?: Partial<TurnContext["job"]>;
    checkpoint?: TurnCheckpoint;
  }) => TurnContext;
  /** Runs assemble then resolve with the given planning outputs. */
  runResolve: (input: {
    director?: Partial<DirectorNodeOutput>;
    readings?: InterpretOutput["readings"];
    rulings?: AdjudicateOutput["rulings"];
    job?: Partial<TurnContext["job"]>;
    checkpoint?: TurnCheckpoint;
  }) => Promise<{
    result: NodeResult<"resolve">;
    ctx: TurnContext;
  }>;
  projections: () => Promise<Awaited<ReturnType<typeof loadProjections>>>;
  /** A human player's proposal through the gate; throws on refusal. */
  as: (
    who: Proposer,
    proposal: unknown,
  ) => Promise<Awaited<ReturnType<Gate["submit"]>>>;
}

export async function createWorld(
  opts: {
    dice?: number[];
    calls?: unknown[];
    gate?: (g: Gate) => Gate;
    /** Who is at the table for `recordPresence`. Default: no humans. */
    presence?: PresenceReader;
    /** Overrides the context seed (table-rule overrides). */
    seed?: SceneSeed;
  } = {},
): Promise<World> {
  const sessionId = randomUUID();
  const scripted = createScriptedDm(
    loadDmScript({
      v: 1,
      name: "world",
      dice: opts.dice ?? [],
      calls: opts.calls ?? [],
    }),
  );
  let n = 0;
  const realGate = createGate({
    db: requireDb(),
    rng: scripted.gateRng,
    presence: opts.presence,
    plannerInputs: createPlannerInputs((id) => loadSeed(id)),
    newId: () => `id-${sessionId.slice(0, 8)}-${++n}`,
  });
  const submitCalls = { count: 0 };
  const gate: Gate = {
    ...realGate,
    submit: (...args) => {
      submitCalls.count += 1;
      return realGate.submit(...args);
    },
  };
  const finalGate = opts.gate ? opts.gate(gate) : gate;
  const gateway = createGateway({
    config: scripted.aiConfig,
    sink: memorySink(),
    adapters: { fake: () => scripted.provider },
  });
  const checkpoint = { current: emptyCheckpoint() };
  const proj = () => loadProjections(requireDb(), sessionId, { role: "dm" });

  const ctx: World["ctx"] = (over = {}) =>
    makeCtx({
      seed: opts.seed,
      job: { sessionId, ...over.job },
      checkpoint: over.checkpoint ?? checkpoint.current,
      deps: {
        gateway,
        gate: finalGate,
        loadProjections: () => proj(),
        saveCheckpoint: async (c) => {
          checkpoint.current = c;
          return true;
        },
      },
    });

  const world: World = {
    sessionId,
    gate: finalGate,
    scripted,
    checkpoint,
    submitCalls,
    ctx,
    projections: proj,
    as: (who, proposal) => finalGate.handle(sessionId, who, proposal),
    runResolve: async (input) => {
      const base = ctx({ job: input.job, checkpoint: input.checkpoint });
      const assembled = await assemble(base);
      if (!assembled.ok) throw new Error("assemble failed");
      const full: TurnContext = {
        ...base,
        results: {
          assemble: assembled.output,
          director: { ...defaultDirector, ...input.director },
          interpret: { readings: input.readings ?? [] },
          adjudicate: { rulings: input.rulings ?? [] },
        },
      };
      return { result: await resolve(full), ctx: full };
    },
  };
  return world;
}

export async function readRows(w: World) {
  return (
    await readFrom(requireDb(), { sessionId: w.sessionId, limit: 1000 })
  ).map(toStoredEvent);
}

/** Runs the scene-start turn's resolve for a world; returns its output. */
export async function startScene(w: World) {
  const { result } = await w.runResolve({
    job: {
      trigger: "scene-start",
      start: { seedId: "greyhollow-ford", seats: { tamsin: TAMSIN_USER } },
    },
  });
  if (!result.ok)
    throw new Error(`scene start failed: ${result.error.message}`);
  w.checkpoint.current = {
    ...w.checkpoint.current,
    submissions: [],
    lastSeq: 0,
  };
  return result.output as ResolveOutput;
}

let actionN = 0;
/** Tamsin declares and commits one action; returns its id. */
export async function commitAction(w: World, text: string, id?: string) {
  const actionId = id ?? `act-${++actionN}`;
  const declared = await w.as(player, {
    kind: "action.declare",
    action: { actionId, characterId: "tamsin", scope: "character", text },
  });
  if (!declared.ok)
    throw new Error(`declare refused: ${declared.refusal.code}`);
  const committed = await w.as(player, { kind: "action.commit", actionId });
  if (!committed.ok)
    throw new Error(`commit refused: ${committed.refusal.code}`);
  return actionId;
}

export const checkStep = (over: Record<string, unknown> = {}) => ({
  step: "check",
  reason: "Tamsin forces the stuck shutter",
  combatantId: "tamsin",
  kind: "ability-check",
  ability: "str",
  skill: "athletics",
  difficulty: "medium",
  circumstance: null,
  autoFail: null,
  onSuccess: [],
  onFailure: [],
  stakes: {
    success: "The attempt works as intended.",
    cost: "It works, at a small price.",
    failure: "The attempt comes to nothing.",
    severe: "It goes badly wrong.",
  },
  onCost: [],
  onSevere: [],
  newRisk: null,
  ...over,
});

export const attackStep = (
  targetId: string,
  over: Record<string, unknown> = {},
) => ({
  step: "attack",
  reason: "Tamsin swings her longsword",
  attackerId: "tamsin",
  targetId,
  attack: "Longsword",
  circumstance: null,
  onHit: [],
  ...over,
});

export const spellStep = (
  targetId: string,
  over: Record<string, unknown> = {},
) => ({
  step: "spell",
  reason: "Odo calls down sacred flame",
  casterId: "odo",
  spellId: "sacred-flame",
  slotLevel: null,
  targetId,
  ...over,
});

export const helpStep = (over: Record<string, unknown> = {}) => ({
  step: "help",
  reason: "Kestrel steadies Tamsin",
  helperId: "kestrel",
  assist: { kind: "ability-check", allyId: "tamsin", skill: "acrobatics" },
  ...over,
});

export const reading = (
  actionId: string | null,
  steps: unknown[],
  over: Record<string, unknown> = {},
) => ({
  actionId,
  intent: "check",
  uncertain: true,
  needsAdjudication: false,
  rulesQuestion: null,
  clarify: null,
  steps,
  ...over,
});

/** A row's payload, typed by the caller; throws when the row is missing. */
export function payloadOf<T>(row: { payload: unknown } | undefined): T {
  if (!row) throw new Error("expected a row");
  return row.payload as T;
}
