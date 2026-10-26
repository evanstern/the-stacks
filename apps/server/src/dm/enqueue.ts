import type {
  SessionProjections,
  StoredEvent,
} from "@the-stacks/session-model";
import type { DbClient } from "../auth/session.js";
import { enqueueTurn } from "./jobs.js";

/**
 * The gate listener (contracts/turn-jobs.md "Enqueue"). Registered with
 * `gate.onAppended`; each call may enqueue the session's next beat.
 *
 * 1. Any `action.committed` row enqueues a turn (`commit`).
 * 2. A `proposal.approved` or `proposal.rejected` row whose proposal came from
 *    `ai:dm` enqueues a turn (`approval`), so the DM resumes.
 * 3. `nudge()` wakes the worker.
 *
 * A listener failure is logged; FR-008's reconcile repairs it at next start.
 */

export interface DmEnqueuerDeps {
  db: DbClient;
  nudge: () => void;
  /** The DM view of the session; used to find who proposed a decided proposal. */
  loadProjections: (sessionId: string) => Promise<SessionProjections>;
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

  return {
    async onAppended(sessionId, rows) {
      try {
        const committed = rows.find((r) => r.type === "action.committed");
        if (committed) {
          await enqueueTurn(deps.db, sessionId, "commit", committed.seq);
        } else {
          const decision = await aiDmDecision(sessionId, rows);
          if (decision) {
            await enqueueTurn(deps.db, sessionId, "approval", decision.seq);
          }
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
