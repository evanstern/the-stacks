import { randomInt, randomUUID } from "node:crypto";
import { type Rng, seededRng } from "@the-stacks/dnd5e-engine";
import {
  actorOf,
  checkPermission,
  DEFAULT_POLICIES,
  findProposal,
  type GateRefusal,
  type GateRequest,
  GateRequestSchema,
  type PlannedRow,
  type Proposal,
  ProposalSchema,
  type Proposer,
  planProposal,
  routeProposal,
  type StoredEvent,
} from "@the-stacks/session-model";
import { type DbClient, SeqConflictError } from "../events/log.js";
import type { PresenceReader } from "../presence/index.js";
import {
  type AppendSessionEventInput,
  appendSessionEvents,
  SessionEventRefused,
} from "../session/events.js";
import { loadProjections } from "../session/projections.js";

/**
 * The server gate (specs/029-proposal-gate/contracts/gate-api.md section 3). Holds no
 * proposal state: every decision is read from the log, so a restart loses nothing.
 */

export type GateResult =
  | {
      ok: true;
      outcome: "applied";
      events: StoredEvent[];
      batchId: string | null;
    }
  | {
      ok: true;
      outcome: "pending";
      proposalId: string;
      events: StoredEvent[];
    }
  | {
      ok: true;
      outcome: "suggested";
      proposalId: string;
      events: StoredEvent[];
    }
  | { ok: true; outcome: "decided"; events: StoredEvent[] }
  | { ok: false; refusal: GateRefusal };

export interface GateDeps {
  db: DbClient;
  /** Engine RNG per plan. Default: seededRng(crypto randomInt(0, 2**32)). */
  rng?: () => Rng;
  /** Id source for batch and proposal ids. Default: crypto randomUUID. */
  newId?: () => string;
  /** Test seam: the session seam's batch append (failure and conflict injection). */
  appendSessionEvents?: typeof appendSessionEvents;
  /** Who is at the table (decision-0024). Default: no humans present. */
  presence?: PresenceReader;
  /**
   * Milliseconds to wait after a `SeqConflictError` on `attempt` (1 or 2) before the next
   * attempt. Never called after the last attempt. Default: 10 to 50 ms, random, so two
   * processes that lost a race do not retry in lockstep. Tests inject `() => 0`.
   */
  retryDelayMs?: (attempt: number) => number;
}

export type PresencePurpose = "director" | "signoff" | "floor";

export type RecordPresenceResult =
  | { ok: true; event: StoredEvent }
  | { ok: false; refusal: GateRefusal };

export interface Gate {
  /** A proposal from any proposer. The DM runtime's entry point. */
  submit(
    sessionId: string,
    proposer: Proposer,
    proposal: unknown,
  ): Promise<GateResult>;
  /** Any gate request (proposal or supervision). The WebSocket gateway's entry point. */
  handle(
    sessionId: string,
    proposer: Proposer,
    request: unknown,
  ): Promise<GateResult>;
  /**
   * Appends one public `presence.recorded` marker naming the humans present now
   * (specs/035-presence/contracts/presence-marker.md). Never deduplicates.
   */
  recordPresence(
    sessionId: string,
    input: { purpose: PresencePurpose; actionId?: string },
  ): Promise<RecordPresenceResult>;
  /** Called after every successful append with the stored rows, in seq order. */
  onAppended(
    listener: (sessionId: string, events: StoredEvent[]) => void,
  ): () => void;
}

const MAX_ATTEMPTS = 3;
const AI_DM: Proposer = { kind: "ai", actor: "ai:dm" };

function refusal(
  code: string,
  message: string,
  source: GateRefusal["source"] = "gate",
): GateResult {
  return { ok: false, refusal: { source, code, message } };
}

function toInput(sessionId: string, row: PlannedRow): AppendSessionEventInput {
  return { sessionId, ...row };
}

export function createGate(deps: GateDeps): Gate {
  const { db } = deps;
  const newRng = deps.rng ?? (() => seededRng(randomInt(0, 2 ** 32)));
  const newId = deps.newId ?? randomUUID;
  const append = deps.appendSessionEvents ?? appendSessionEvents;
  const presence: PresenceReader = deps.presence ?? {
    presentUsers: () => [],
    isPresent: (_sessionId, actor) => actor.startsWith("ai:"),
    onChange: () => () => {},
  };
  const retryDelayMs = deps.retryDelayMs ?? (() => 10 + randomInt(0, 41));
  const sleep = (ms: number): Promise<void> =>
    new Promise((resolve) => setTimeout(resolve, ms));
  // Per-session queue tails. A session's writes run one at a time, in arrival order;
  // different sessions run in parallel. An idle session holds no entry.
  const tails = new Map<string, Promise<void>>();
  function inOrder<T>(sessionId: string, fn: () => Promise<T>): Promise<T> {
    const prev = tails.get(sessionId) ?? Promise.resolve();
    const next = prev.then(fn, fn);
    const tail = next.then(
      () => {},
      () => {},
    );
    tails.set(sessionId, tail);
    void tail.then(() => {
      if (tails.get(sessionId) === tail) tails.delete(sessionId);
    });
    return next;
  }
  const listeners = new Set<
    (sessionId: string, events: StoredEvent[]) => void
  >();

  async function attempt(
    sessionId: string,
    proposer: Proposer,
    request: GateRequest,
  ): Promise<GateResult> {
    const p = await loadProjections(db, sessionId, { role: "dm" });
    const lastSeq = p.throughSeq;
    const context = {
      present: presence.presentUsers(sessionId).map((e) => e.userId),
    };
    const write = async (rows: readonly PlannedRow[]): Promise<StoredEvent[]> =>
      append(
        db,
        rows.map((row) => toInput(sessionId, row)),
        { expectedLastSeq: lastSeq },
      );

    const permission = checkPermission(p, proposer, request);
    if (!permission.ok) {
      return refusal(permission.code, permission.message);
    }

    switch (request.kind) {
      case "proposal.approve": {
        const view = findProposal(p, request.proposalId);
        if (!view) return refusal("UNKNOWN_PROPOSAL", "no such proposal");
        if (view.policy !== "ask") {
          return refusal(
            "PROPOSAL_NOT_APPROVABLE",
            "a suggestion applies nothing; the DM acts on it directly",
          );
        }
        if (view.status !== "pending") {
          return refusal("PROPOSAL_NOT_PENDING", "the proposal is decided");
        }
        const planned = planProposal(
          p,
          AI_DM,
          view.proposal,
          newRng(),
          { batchId: newId() },
          view.proposalId,
          context,
        );
        if (!planned.ok) return { ok: false, refusal: planned.refusal };
        const events = await write([
          ...planned.rows,
          {
            actor: actorOf(proposer),
            type: "proposal.approved",
            payload: {
              proposalId: view.proposalId,
              batchId: planned.batchId,
            },
            visibility: "dm",
          },
        ]);
        return { ok: true, outcome: "decided", events };
      }
      case "proposal.reject": {
        const view = findProposal(p, request.proposalId);
        if (!view) return refusal("UNKNOWN_PROPOSAL", "no such proposal");
        if (view.status !== "pending") {
          return refusal("PROPOSAL_NOT_PENDING", "the proposal is decided");
        }
        const events = await write([
          {
            actor: actorOf(proposer),
            type: "proposal.rejected",
            payload: { proposalId: view.proposalId, reason: request.reason },
            visibility: "dm",
          },
        ]);
        return { ok: true, outcome: "decided", events };
      }
      case "dm.seat": {
        const events = await write([
          {
            actor: actorOf(proposer),
            type: "dm.seat.changed",
            payload: {
              reason: request.reason,
              before: p.gate.seat,
              after: request.after,
            },
            visibility: "public",
          },
        ]);
        return { ok: true, outcome: "decided", events };
      }
      case "gate.policy": {
        const before =
          p.gate.policyOverrides[request.proposalKind] ??
          DEFAULT_POLICIES[request.proposalKind];
        const events = await write([
          {
            actor: actorOf(proposer),
            type: "gate.policy.changed",
            payload: {
              reason: request.reason,
              proposalKind: request.proposalKind,
              before,
              after: request.policy,
            },
            visibility: "public",
          },
        ]);
        return { ok: true, outcome: "decided", events };
      }
      default:
        break;
    }

    // A proposal.
    const proposal = request as Proposal;
    const route = routeProposal(p, proposer, proposal);
    if (route.route === "refuse") {
      return refusal(route.code, "this proposer cannot submit this kind");
    }
    if (route.route === "direct" || route.policy === "auto") {
      const planned = planProposal(
        p,
        proposer,
        proposal,
        newRng(),
        { batchId: newId() },
        null,
        context,
      );
      if (!planned.ok) return { ok: false, refusal: planned.refusal };
      const events = await write(planned.rows);
      return {
        ok: true,
        outcome: "applied",
        events,
        batchId: planned.batchId,
      };
    }

    // ask | suggest: a legality check with a throwaway RNG, then record the proposal.
    const check = planProposal(
      p,
      proposer,
      proposal,
      seededRng(0),
      { batchId: newId() },
      null,
      context,
    );
    if (!check.ok) return { ok: false, refusal: check.refusal };
    const proposalId = newId();
    const events = await write([
      {
        actor: actorOf(proposer),
        type: "proposal.created",
        payload: { proposalId, policy: route.policy, proposal },
        visibility: "dm",
      },
    ]);
    return {
      ok: true,
      outcome: route.policy === "ask" ? "pending" : "suggested",
      proposalId,
      events,
    };
  }

  async function run(
    sessionId: string,
    proposer: Proposer,
    request: GateRequest,
  ): Promise<GateResult> {
    for (let n = 1; n <= MAX_ATTEMPTS; n++) {
      let result: GateResult;
      try {
        result = await attempt(sessionId, proposer, request);
      } catch (err) {
        if (err instanceof SeqConflictError) {
          if (n < MAX_ATTEMPTS) await sleep(retryDelayMs(n));
          continue;
        }
        if (err instanceof SessionEventRefused) {
          return refusal(err.code, err.message, "append");
        }
        throw err;
      }
      if (result.ok) {
        for (const listener of listeners) {
          try {
            listener(sessionId, result.events);
          } catch (err) {
            console.error("gate: onAppended listener threw", err);
          }
        }
      }
      return result;
    }
    return refusal("CONFLICT", "the log kept changing; try again");
  }

  function notify(sessionId: string, events: StoredEvent[]): void {
    for (const listener of listeners) {
      try {
        listener(sessionId, events);
      } catch (err) {
        console.error("gate: onAppended listener threw", err);
      }
    }
  }

  function recordPresence(
    sessionId: string,
    input: { purpose: PresencePurpose; actionId?: string },
  ): Promise<RecordPresenceResult> {
    return inOrder(sessionId, () => recordPresenceUnordered(sessionId, input));
  }

  async function recordPresenceUnordered(
    sessionId: string,
    input: { purpose: PresencePurpose; actionId?: string },
  ): Promise<RecordPresenceResult> {
    // The marker depends on no projection state, so it skips the projection load and the
    // expectedLastSeq check; a load here replays the whole log once per turn. The log's
    // per-session advisory lock orders the append; the conflict retry stays for the seam.
    for (let n = 1; n <= MAX_ATTEMPTS; n++) {
      try {
        const present = presence
          .presentUsers(sessionId)
          .map((u) => u.userId)
          .sort();
        const [event] = await append(db, [
          {
            sessionId,
            actor: "system",
            type: "presence.recorded",
            payload: {
              present,
              purpose: input.purpose,
              ...(input.actionId ? { actionId: input.actionId } : {}),
            },
            visibility: "public",
          },
        ]);
        if (!event) throw new Error("presence marker was not stored");
        notify(sessionId, [event]);
        return { ok: true, event };
      } catch (err) {
        if (err instanceof SeqConflictError) {
          if (n < MAX_ATTEMPTS) await sleep(retryDelayMs(n));
          continue;
        }
        if (err instanceof SessionEventRefused) {
          return refusal(
            err.code,
            err.message,
            "append",
          ) as RecordPresenceResult;
        }
        throw err;
      }
    }
    return refusal(
      "CONFLICT",
      "the log kept changing; try again",
    ) as RecordPresenceResult;
  }

  return {
    recordPresence,
    async submit(sessionId, proposer, proposal) {
      const parsed = ProposalSchema.safeParse(proposal);
      if (!parsed.success) {
        return refusal("INVALID_PROPOSAL", parsed.error.message);
      }
      return inOrder(sessionId, () => run(sessionId, proposer, parsed.data));
    },
    async handle(sessionId, proposer, request) {
      const parsed = GateRequestSchema.safeParse(request);
      if (!parsed.success) {
        return refusal("INVALID_PROPOSAL", parsed.error.message);
      }
      return inOrder(sessionId, () => run(sessionId, proposer, parsed.data));
    },
    onAppended(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
