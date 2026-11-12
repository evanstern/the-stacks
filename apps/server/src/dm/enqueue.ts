import {
  type ReadablePost,
  readablePosts,
  readWindowMs,
  type SessionProjections,
  type StoredEvent,
  type TableMode,
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
  enqueueTalkTurn,
  enqueueTurn,
  FLOOR_ABSENCE_WAIT_MS,
  FLOOR_STALL_WINDOW_MS,
  interruptRead,
} from "./jobs.js";
import type { SceneSeed } from "./seed/schema.js";
import { buildSnapshot } from "./snapshot/build.js";
import { capReached, codeTriggers, companionOnly } from "./talk-triggers.js";

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
 * 6. A readable post (spec 066 FR-006, `readablePosts`) first interrupts a running read that has
 *    shipped nothing (`interruptRead`, FR-008), then queues or moves the session's coalesced `talk`
 *    turn to the post's `ts` plus `readWindowMs` (no cap, FR-007). A post that names only AI
 *    companions also queues a `prompt` companion job. A reached chain cap queues nothing; any other
 *    queued turn absorbs the post.
 * 7. A `needs_ruling` `intent.recorded` row under an AI seat queues a `ruling` turn (spec 102
 *    FR-022); the turn answers every open request first.
 * 8. Rule 8 (TASK-0314, human-DM ruling resume): an `intent.recorded` carrier that answers an open
 *    request (`answers` set, a `ruling` Intent) from a non-AI actor under a human DM seat queues one
 *    `approval` turn, so the waiting action resumes. `ai:dm` rulings queue none here: their
 *    `proposal.approved` row already fires rule 2. The turn coalesces through the one-queued-turn index.
 * 9. Rule 9 (spec 066 FR-031, card AC #7): an `intent.recorded` row that settled engine rows
 *    (`batchId` set) or stopped on a refusal, in a batch no job appended (the actor is not `ai:`,
 *    the same test as rule 8), queues one coalesced `intent` turn that narrates it. A row that
 *    only records speech or a declared Intent has no engine rows and queues none. A single human
 *    ruling row fires rules 8 and 9 both; the one-queued-turn index coalesces them into one job.
 * 10. `nudge()` wakes the worker.
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
  /** The read window after a readable post (ms; default `readWindowMs` of session-model, spec 066 FR-007). */
  readWindowMs?: (post: ReadablePost, p: SessionProjections) => number;
  /** Loads a scene seed by id for role-word triggers; absent means no seed. */
  loadSeed?: (seedId: string) => SceneSeed;
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

  /** Rule 7 (spec 102 FR-022): a `needs_ruling` carrier row under the AI seat queues a ruling turn. */
  async function rulingTurns(
    sessionId: string,
    rows: StoredEvent[],
  ): Promise<void> {
    const asked = rows.find(
      (r) =>
        r.type === "intent.recorded" &&
        (r.payload as { outcome?: string }).outcome === "needs_ruling",
    );
    if (!asked) return;
    if (!isAiSeat(await deps.loadProjections(sessionId))) return;
    await enqueueTurn(deps.db, sessionId, "ruling", asked.seq);
  }

  /** True when a running job appended the row: the actor is an AI (rules 8 and 9 share this test). */
  const appendedByJob = (r: StoredEvent): boolean => r.actor.startsWith("ai:");

  /** Rule 8 (TASK-0314): a human DM's ruling that answers an open request queues the resume turn. */
  async function humanRulingResume(
    sessionId: string,
    rows: StoredEvent[],
  ): Promise<void> {
    const ruled = rows.find(
      (r) =>
        r.type === "intent.recorded" &&
        !appendedByJob(r) &&
        (r.payload as { answers?: string | null }).answers != null,
    );
    if (!ruled) return;
    if ((await deps.loadProjections(sessionId)).gate.seat.kind !== "human")
      return;
    await enqueueTurn(deps.db, sessionId, "approval", ruled.seq);
  }

  /**
   * Rule 9 (spec 066 FR-031): a direct Intent that settled engine rows or stopped queues one
   * coalesced `intent` turn. ponytail: `settled` alone also covers speech and `ask_dm`, which write
   * no engine rows and need no narration, so `batchId` set (or `stopped`) is the narrate-worthy test.
   */
  async function intentTurns(
    sessionId: string,
    rows: StoredEvent[],
  ): Promise<void> {
    const direct = rows.find((r) => {
      if (r.type !== "intent.recorded" || appendedByJob(r)) return false;
      const pl = r.payload as {
        outcome?: string;
        batchId?: string | null;
        stopped?: unknown;
      };
      return (
        (pl.outcome === "settled" && pl.batchId != null) ||
        (pl.stopped != null && pl.stopped !== undefined)
      );
    });
    if (!direct) return;
    await enqueueTurn(deps.db, sessionId, "intent", direct.seq);
  }

  /** Rule 6 (spec 066 D3): a readable post interrupts a read, then queues or moves the talk turn. */
  async function talkReactions(
    sessionId: string,
    rows: StoredEvent[],
  ): Promise<void> {
    if (!rows.some((r) => r.type === "talk" || r.type === "intent.recorded"))
      return;
    const p = await deps.loadProjections(sessionId);
    if (capReached(p)) return;
    const seqs = new Set(rows.map((r) => r.seq));
    const posts = readablePosts(p).filter((post) => seqs.has(post.seq));
    if (posts.length === 0) return;
    let seed: SceneSeed | null = null;
    const sceneId = p.scene?.sceneId;
    if (sceneId && deps.loadSeed) {
      try {
        seed = deps.loadSeed(sceneId);
      } catch {
        seed = null;
      }
    }
    const snapshot = buildSnapshot(p, seed);
    // FR-008: a running read that has shipped nothing ends; a new read queues below.
    await interruptRead(deps.db, sessionId);
    for (const post of posts) {
      const triggers = codeTriggers(post.text, snapshot, seed);
      if (post.rule === 1 && companionOnly(triggers)) {
        const ids = triggers
          .filter((t) => t.kind === "addressed" && t.party)
          .map((t) => t.actorId);
        await enqueueCompanion(deps.db, {
          sessionId,
          companions: ids,
          reason: "prompt",
          beatJobId: null,
        });
      }
      const windowMs = (deps.readWindowMs ?? readWindowMs)(post, p);
      await enqueueTalkTurn(deps.db, sessionId, post.seq, {
        postTs: post.ts,
        windowMs,
      });
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
        await rulingTurns(sessionId, rows);
        await humanRulingResume(sessionId, rows);
        await intentTurns(sessionId, rows);
        await talkReactions(sessionId, rows);
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
