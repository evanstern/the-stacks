import type {
  SessionProjections,
  StoredEvent,
  TableMode,
} from "@the-stacks/session-model";
import type { DbClient } from "../auth/session.js";
import type { PresenceReader } from "../presence/index.js";
import {
  absentHolder,
  isAiSeat,
  isStallCandidate,
  latestStanceSeq,
} from "./floor-state.js";
import {
  cancelFloorCheck,
  enqueueCompanion,
  enqueueCompanionReact,
  enqueueFloorCheck,
  enqueueTurn,
  FLOOR_ABSENCE_WAIT_MS,
  FLOOR_STALL_WINDOW_MS,
} from "./jobs.js";

/**
 * The gate listener (contracts/turn-jobs.md "Enqueue"). Registered with
 * `gate.onAppended`; each call may enqueue the session's next beat.
 *
 * 1. Any `action.committed` row enqueues a turn (`commit`).
 * 2. A `proposal.approved` or `proposal.rejected` row whose proposal came from
 *    `ai:dm` enqueues a turn (`approval`), so the DM resumes.
 * 3. A human `action.commented` row on an open action of an AI companion
 *    queues a coalesced `react` companion job (specs/036-companion-react).
 * 4. A turn-mode `table-mode.changed` row written by a human (a floor request,
 *    specs/049-turn-floor R8) queues the AI follow-up: `ai:dm` active queues an
 *    `npc-turn`, a companion active queues a companion `turn` job. Rows written
 *    by `ai:dm` queue none: their producer queues its own follow-up.
 * 5. Under an AI seat, and only when a presence reader is given, the floor waits arm
 *    (specs/049-turn-floor R10): an `absence` check when a turn-mode row names an absent
 *    human, a `stall` check for each open multi-human party action (re-armed by each
 *    comment, cancelled by a commit or withdrawal). `onPresenceChange` arms `absence`
 *    when the active human just left.
 * 6. `nudge()` wakes the worker.
 *
 * A listener failure is logged; FR-008's reconcile repairs it at next start.
 */

export interface DmEnqueuerDeps {
  db: DbClient;
  nudge: () => void;
  /** The DM view of the session; used to find who proposed a decided proposal. */
  loadProjections: (sessionId: string) => Promise<SessionProjections>;
  /** Quiet window after the latest reaction before a `react` job may run (ms). */
  reactQuietMs?: number;
  /** Cap on the wait, measured from the first reaction (ms). */
  reactMaxWaitMs?: number;
  /** Who is at the table. Floor waits arm only when given. */
  presence?: Pick<PresenceReader, "presentUsers">;
  /** Wait before an absent human's turn is passed (ms; default FLOOR_ABSENCE_WAIT_MS). */
  floorAbsenceWaitMs?: number;
  /** Silence before a stalled party action is committed (ms; default FLOOR_STALL_WINDOW_MS). */
  floorStallWindowMs?: number;
  log?: (line: Record<string, unknown>) => void;
}

export interface DmEnqueuer {
  onAppended(sessionId: string, rows: StoredEvent[]): Promise<void>;
  /** The presence reader reported a change: arm `absence` if the active human left. */
  onPresenceChange(sessionId: string): Promise<void>;
}

const isTurnAfter = (row: StoredEvent): boolean =>
  (row.payload as { after?: TableMode }).after?.mode === "turn";

export function createDmEnqueuer(deps: DmEnqueuerDeps): DmEnqueuer {
  async function aiDmDecision(
    sessionId: string,
    rows: StoredEvent[],
  ): Promise<StoredEvent | null> {
    const decided = rows.filter(
      (r) => r.type === "proposal.approved" || r.type === "proposal.rejected",
    );
    if (decided.length === 0) return null;
    const projections = await deps.loadProjections(sessionId);
    for (const row of decided) {
      const id = (row.payload as { proposalId?: string }).proposalId;
      const view = projections.proposals.find((p) => p.proposalId === id);
      if (view?.proposer === "ai:dm") return row;
    }
    return null;
  }

  async function reactTargets(
    sessionId: string,
    rows: StoredEvent[],
  ): Promise<string[]> {
    const human = rows.filter(
      (r) => r.type === "action.commented" && !r.actor.startsWith("ai:"),
    );
    if (human.length === 0) return [];
    const projections = await deps.loadProjections(sessionId);
    const companions = new Set<string>();
    for (const row of human) {
      const id = (row.payload as { actionId?: string }).actionId;
      const action = projections.actions.find((a) => a.actionId === id);
      if (!action) continue;
      if (action.status !== "declared" && action.status !== "discussed") {
        continue;
      }
      const prefix = "ai:companion:";
      if (action.actor.startsWith(prefix)) {
        companions.add(action.actor.slice(prefix.length));
      }
    }
    return [...companions];
  }

  /** The follow-up for each human-written turn-mode `table-mode.changed` row (R8). */
  async function floorFollowUps(
    sessionId: string,
    rows: StoredEvent[],
  ): Promise<void> {
    for (const row of rows) {
      if (row.type !== "table-mode.changed") continue;
      if (row.actor.startsWith("ai:") || row.actor === "system") continue;
      const after = (row.payload as { after?: TableMode }).after;
      if (after?.mode !== "turn") continue;
      if (after.activeActor === "ai:dm") {
        await enqueueTurn(deps.db, sessionId, "npc-turn", row.seq);
      } else if (
        after.activeActor.startsWith("ai:companion:") &&
        after.activeCharacterId
      ) {
        await enqueueCompanion(deps.db, {
          sessionId,
          companions: [after.activeCharacterId],
          reason: "turn",
          beatJobId: null,
        });
      }
    }
  }

  const presentNow = (sessionId: string): string[] =>
    (deps.presence?.presentUsers(sessionId) ?? []).map((u) => u.userId);

  async function armAbsence(
    sessionId: string,
    p: SessionProjections,
  ): Promise<void> {
    if (!deps.presence || !isAiSeat(p)) return;
    const holder = absentHolder(p, presentNow(sessionId));
    if (holder === null) return;
    await enqueueFloorCheck(
      deps.db,
      { sessionId, check: "absence", actionId: null, holder, stanceSeq: null },
      deps.floorAbsenceWaitMs ?? FLOOR_ABSENCE_WAIT_MS,
    );
  }

  /** The floor waits a batch of rows arms or cancels (R10). */
  async function floorWaits(
    sessionId: string,
    rows: StoredEvent[],
  ): Promise<void> {
    if (!deps.presence) return;
    const modeRow = rows.some(
      (r) => r.type === "table-mode.changed" && isTurnAfter(r),
    );
    const stallRows = rows.filter(
      (r) => r.type === "action.declared" || r.type === "action.commented",
    );
    const closed = rows.filter(
      (r) => r.type === "action.committed" || r.type === "action.withdrawn",
    );
    for (const row of closed) {
      const actionId = (row.payload as { actionId?: string }).actionId;
      if (actionId)
        await cancelFloorCheck(deps.db, sessionId, "stall", actionId);
    }
    if (!modeRow && stallRows.length === 0) return;
    const p = await deps.loadProjections(sessionId);
    if (!isAiSeat(p)) return;
    if (modeRow) await armAbsence(sessionId, p);
    for (const row of stallRows) {
      const actionId = (row.payload as { actionId?: string }).actionId;
      const action = p.actions.find((a) => a.actionId === actionId);
      if (!action || !isStallCandidate(p, action)) continue;
      await enqueueFloorCheck(
        deps.db,
        {
          sessionId,
          check: "stall",
          actionId: action.actionId,
          holder: null,
          stanceSeq: latestStanceSeq(action),
        },
        deps.floorStallWindowMs ?? FLOOR_STALL_WINDOW_MS,
      );
    }
  }

  return {
    async onPresenceChange(sessionId) {
      try {
        if (!deps.presence) return;
        await armAbsence(sessionId, await deps.loadProjections(sessionId));
      } catch (error) {
        deps.log?.({
          event: "dm.enqueue.failed",
          sessionId,
          message: error instanceof Error ? error.message : String(error),
        });
      }
      deps.nudge();
    },
    async onAppended(sessionId, rows) {
      try {
        await floorFollowUps(sessionId, rows);
        await floorWaits(sessionId, rows);
        const committed = rows.find((r) => r.type === "action.committed");
        if (committed) {
          await enqueueTurn(deps.db, sessionId, "commit", committed.seq);
        } else {
          const decision = await aiDmDecision(sessionId, rows);
          if (decision) {
            await enqueueTurn(deps.db, sessionId, "approval", decision.seq);
          }
        }
        for (const companionId of await reactTargets(sessionId, rows)) {
          await enqueueCompanionReact(deps.db, sessionId, companionId, {
            quietMs: deps.reactQuietMs ?? 3000,
            maxWaitMs: deps.reactMaxWaitMs ?? 10000,
          });
        }
      } catch (error) {
        deps.log?.({
          event: "dm.enqueue.failed",
          sessionId,
          message: error instanceof Error ? error.message : String(error),
        });
      }
      deps.nudge();
    },
  };
}
