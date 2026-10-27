import {
  currentTurn,
  type SessionProjections,
  signoffState,
  type TableMode,
} from "@the-stacks/session-model";
import type { DbClient } from "../auth/session.js";
import type { Gate } from "../gate/index.js";
import type { PresenceReader } from "../presence/index.js";
import {
  absentHolder,
  isAiSeat,
  isStallCandidate,
  latestStanceSeq,
} from "./floor-state.js";
import {
  enqueueCompanion,
  enqueueTurn,
  type FloorJobInput,
  type FloorJobResult,
} from "./jobs.js";

/**
 * The `floor` job (specs/049-turn-floor contracts/floor-jobs.md "The run"). Code only: no
 * `chat()`, no model. It writes only through `gate.submit` as `ai:dm`, and it is the only
 * module that builds a `floor` proposal or a `stall` override. It acts only if the absence
 * or stall it was armed for has not changed.
 */

export interface FloorDeps {
  db: DbClient;
  gate: Pick<Gate, "submit">;
  loadProjections: (sessionId: string) => Promise<SessionProjections>;
  presence: Pick<PresenceReader, "presentUsers">;
  log: (line: Record<string, unknown>) => void;
}

const AI_DM = { kind: "ai", actor: "ai:dm" } as const;
const noop = (): FloorJobResult => ({ outcome: "noop", seqs: [] });

export async function runFloorJob(
  deps: FloorDeps,
  job: { id: string; input: FloorJobInput },
): Promise<FloorJobResult> {
  const { input } = job;
  const p = await deps.loadProjections(input.sessionId);
  if (!isAiSeat(p)) return { outcome: "skipped", seqs: [] };
  const present = deps.presence
    .presentUsers(input.sessionId)
    .map((u) => u.userId);
  return input.check === "absence"
    ? runAbsence(deps, input, p, present)
    : runStall(deps, input, p, present);
}

async function runAbsence(
  deps: FloorDeps,
  input: FloorJobInput,
  p: SessionProjections,
  present: readonly string[],
): Promise<FloorJobResult> {
  const turn = currentTurn(p);
  // The absence must be the one this job was armed for: same holder, still absent.
  if (turn === null || input.holder === null) return noop();
  if (absentHolder(p, present) !== input.holder) return noop();

  const result = await deps.gate.submit(input.sessionId, AI_DM, {
    kind: "floor",
    op: "end",
    turn,
    reason: "The AI DM passes the turn of an absent player.",
  });
  if (!result.ok) return refused(result.refusal);
  const seqs = result.events.map((e) => e.seq);
  const mode = result.events.find((e) => e.type === "table-mode.changed");
  const after = (mode?.payload as { after?: TableMode } | undefined)?.after;
  // Rows written by ai:dm queue no follow-up in the enqueuer; this job does (R8).
  if (after?.mode === "turn") {
    if (after.activeActor === "ai:dm") {
      await enqueueTurn(
        deps.db,
        input.sessionId,
        "npc-turn",
        mode?.seq ?? null,
      );
    } else if (
      after.activeActor.startsWith("ai:companion:") &&
      after.activeCharacterId
    ) {
      await enqueueCompanion(deps.db, {
        sessionId: input.sessionId,
        companions: [after.activeCharacterId],
        reason: "turn",
        beatJobId: null,
      });
    }
  }
  return { outcome: "passed", seqs };
}

async function runStall(
  deps: FloorDeps,
  input: FloorJobInput,
  p: SessionProjections,
  present: readonly string[],
): Promise<FloorJobResult> {
  const action = p.actions.find((a) => a.actionId === input.actionId);
  if (!action || !isStallCandidate(p, action)) return noop();
  // A stance change since arming restarts the window; the re-armed job decides.
  if (latestStanceSeq(action) !== input.stanceSeq) return noop();
  const state = signoffState(p, action.actionId, present);
  if (!state || state.met || state.objecting.length > 0) return noop();

  const result = await deps.gate.submit(input.sessionId, AI_DM, {
    kind: "action.commit",
    actionId: action.actionId,
    override: "stall",
  });
  if (!result.ok) return refused(result.refusal);
  return { outcome: "committed", seqs: result.events.map((e) => e.seq) };
}

function refused(refusal: { code: string; message: string }): FloorJobResult {
  return {
    outcome: "refused",
    seqs: [],
    refusal: { code: refusal.code, message: refusal.message },
  };
}
