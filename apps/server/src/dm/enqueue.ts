import type {
  SessionProjections,
  StoredEvent,
  TableMode,
} from "@the-stacks/session-model";
import type { DbClient } from "../auth/session.js";
import {
  enqueueCompanion,
  enqueueCompanionReact,
  enqueueTurn,
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
 * 5. `nudge()` wakes the worker.
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
  log?: (line: Record<string, unknown>) => void;
}

export interface DmEnqueuer {
  onAppended(sessionId: string, rows: StoredEvent[]): Promise<void>;
}

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

  return {
    async onAppended(sessionId, rows) {
      try {
        await floorFollowUps(sessionId, rows);
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
