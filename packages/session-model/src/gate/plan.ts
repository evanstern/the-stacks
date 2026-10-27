import { type EngineEvent, execute, type Rng } from "@the-stacks/dnd5e-engine";
import { catalogEntry, currentVersion } from "../catalog.js";
import { memberOf } from "../projections/party.js";
import type { SessionProjections } from "../projections/types.js";
import { commitAuthority } from "./authority.js";
import { actorOf, type Proposal, type Proposer } from "./proposals.js";
import type { GateRefusal } from "./refusals.js";
import { controls, isDm, isPartyMember } from "./roles.js";
import { signoffState } from "./signoff.js";

export interface PlannedRow {
  actor: string;
  /** A catalog type. */
  type: string;
  /** A valid payload for that type at its current version. */
  payload: unknown;
  visibility: string;
}

export interface PlanIds {
  batchId: string;
}

/**
 * Facts the planner cannot read from the projection (specs/044-group-signoff/contracts/signoff.md).
 * `present` is the present set (user ids) the group sign-off quorum counts.
 */
export interface PlanContext {
  present?: readonly string[];
}

export type PlanResult =
  | { ok: true; rows: PlannedRow[]; batchId: string | null }
  | { ok: false; refusal: GateRefusal };

/** Wraps one engine result in mechanics envelopes (one batch). */
export function mechanicsRows(input: {
  actor: string;
  batchId: string;
  events: readonly EngineEvent[];
  actionId: string | null;
  proposalId: string | null;
  visibility: string;
}): PlannedRow[] {
  return input.events.map((event, index) => ({
    actor: input.actor,
    type: event.type,
    visibility: input.visibility,
    payload: {
      batchId: input.batchId,
      index,
      count: input.events.length,
      actionId: input.actionId,
      proposalId: input.proposalId,
      event,
    },
  }));
}

function refuse(
  code: string,
  message: string,
  details?: Record<string, unknown>,
): PlanResult {
  return {
    ok: false,
    refusal: {
      source: "gate",
      code,
      message,
      ...(details ? { details } : {}),
    },
  };
}

function one(
  actor: string,
  type: string,
  payload: unknown,
  visibility = "public",
): PlanResult {
  return {
    ok: true,
    rows: [{ actor, type, payload, visibility }],
    batchId: null,
  };
}

function validate(result: PlanResult): PlanResult {
  if (!result.ok) return result;
  for (const row of result.rows) {
    const version = currentVersion(row.type);
    const entry =
      version === undefined ? undefined : catalogEntry(row.type, version);
    const parsed = entry?.schema.safeParse(row.payload);
    if (!parsed?.success) {
      return refuse(
        "INVALID_PROPOSAL",
        `the planned ${row.type} payload is invalid`,
        { type: row.type },
      );
    }
  }
  return result;
}

function findAction(p: SessionProjections, actionId: string) {
  return p.actions.find((a) => a.actionId === actionId);
}

function partyHumans(p: SessionProjections): Set<string> {
  return new Set(
    p.party.flatMap((m) =>
      m.controller.kind === "player" ? [m.controller.userId] : [],
    ),
  );
}

/** The `signoff` presence marker row: the quorum a group commit was decided against. */
function signoffMarker(
  actionId: string,
  present: readonly string[],
  committer: string,
): PlannedRow {
  return {
    actor: "system",
    type: "presence.recorded",
    visibility: "public",
    payload: {
      present: [...new Set([...present, committer])].sort(),
      purpose: "signoff",
      actionId,
    },
  };
}

function plan(
  p: SessionProjections,
  proposer: Proposer,
  proposal: Proposal,
  rng: Rng,
  ids: PlanIds,
  proposalId: string | null,
  context: PlanContext | undefined,
): PlanResult {
  const actor = actorOf(proposer);
  switch (proposal.kind) {
    case "talk": {
      const { talk } = proposal;
      if (
        talk.channel === "ic" &&
        talk.characterId !== null &&
        !isDm(p, proposer) &&
        !controls(p, proposer, talk.characterId)
      ) {
        return refuse(
          "NOT_AUTHORIZED",
          "an in-character line needs control of the character",
        );
      }
      return one(actor, "talk", talk, proposal.visibility);
    }
    case "action.declare": {
      const { action } = proposal;
      if (findAction(p, action.actionId)) {
        return refuse("ACTION_EXISTS", `action ${action.actionId} exists`);
      }
      const allowed =
        action.scope === "character"
          ? action.characterId !== null &&
            controls(p, proposer, action.characterId)
          : isPartyMember(p, proposer);
      if (!allowed) {
        return refuse("NOT_AUTHORIZED", "the proposer cannot declare this");
      }
      return one(actor, "action.declared", action);
    }
    case "action.comment": {
      const action = findAction(p, proposal.comment.actionId);
      if (!action) {
        return refuse("UNKNOWN_ACTION", "no such action");
      }
      if (action.status !== "declared" && action.status !== "discussed") {
        return refuse("ACTION_NOT_OPEN", "the action is not open");
      }
      const commented: PlannedRow = {
        actor,
        type: "action.commented",
        payload: proposal.comment,
        visibility: "public",
      };
      const present = context?.present;
      if (
        present !== undefined &&
        proposal.comment.stance === "approve" &&
        action.scope === "party"
      ) {
        const humans = partyHumans(p);
        if (humans.size > 1 && humans.has(actor)) {
          const folded: SessionProjections = {
            ...p,
            actions: p.actions.map((a) =>
              a === action
                ? {
                    ...a,
                    status: "discussed",
                    comments: [
                      ...a.comments,
                      {
                        seq: p.throughSeq + 1,
                        actor,
                        stance: proposal.comment.stance,
                        text: proposal.comment.text,
                      },
                    ],
                  }
                : a,
            ),
          };
          if (signoffState(folded, action.actionId, present, actor)?.met) {
            return {
              ok: true,
              rows: [
                commented,
                signoffMarker(action.actionId, present, actor),
                {
                  actor,
                  type: "action.committed",
                  payload: { actionId: action.actionId, authority: "group" },
                  visibility: "public",
                },
              ],
              batchId: null,
            };
          }
        }
      }
      return { ok: true, rows: [commented], batchId: null };
    }
    case "action.commit": {
      const decision = commitAuthority(
        p,
        proposer,
        proposal.actionId,
        context?.present,
      );
      if (!decision.ok) {
        return refuse(
          decision.code,
          `commit refused: ${decision.code}`,
          decision.code === "GROUP_SIGNOFF_REQUIRED"
            ? { waiting: decision.waiting, objecting: decision.objecting }
            : undefined,
        );
      }
      const committed: PlannedRow = {
        actor,
        type: "action.committed",
        payload: { actionId: proposal.actionId, authority: decision.authority },
        visibility: "public",
      };
      const action = findAction(p, proposal.actionId);
      if (
        decision.authority === "group" &&
        action?.scope === "party" &&
        partyHumans(p).size > 1
      ) {
        return {
          ok: true,
          rows: [
            signoffMarker(proposal.actionId, context?.present ?? [], actor),
            committed,
          ],
          batchId: null,
        };
      }
      return { ok: true, rows: [committed], batchId: null };
    }
    case "action.withdraw": {
      const action = findAction(p, proposal.actionId);
      if (!action) return refuse("UNKNOWN_ACTION", "no such action");
      if (action.status !== "declared" && action.status !== "discussed") {
        return refuse("ACTION_NOT_OPEN", "the action is not open");
      }
      return one(actor, "action.withdrawn", { actionId: proposal.actionId });
    }
    case "action.resolve": {
      const { resolution } = proposal;
      const action = findAction(p, resolution.actionId);
      if (!action) return refuse("UNKNOWN_ACTION", "no such action");
      if (action.status !== "committed") {
        return refuse("ACTION_NOT_COMMITTED", "the action is not committed");
      }
      for (const batchId of resolution.batchIds) {
        const named = p.ledger.some(
          (row) => row.batchId === batchId && row.actionId === action.actionId,
        );
        if (!named) {
          return refuse("UNKNOWN_BATCH", `no batch ${batchId} for the action`, {
            batchId,
          });
        }
      }
      return one(actor, "action.resolved", resolution);
    }
    case "mechanics": {
      if (proposal.actionId !== null && !findAction(p, proposal.actionId)) {
        return refuse("UNKNOWN_ACTION", "no such action");
      }
      const result = execute(p.engine, proposal.command, rng);
      if (!result.ok) {
        const { code, message, details } = result.refusal;
        return {
          ok: false,
          refusal: {
            source: "engine",
            code,
            message,
            ...(details ? { details } : {}),
          },
        };
      }
      const rows = mechanicsRows({
        actor,
        batchId: ids.batchId,
        events: result.events,
        actionId: proposal.actionId,
        proposalId,
        visibility: proposal.visibility,
      });
      return {
        ok: true,
        rows,
        batchId: rows.length > 0 ? ids.batchId : null,
      };
    }
    case "narration": {
      const missing = proposal.narration.actionIds.find(
        (id) => !findAction(p, id),
      );
      if (missing !== undefined) {
        return refuse("UNKNOWN_ACTION", `no such action ${missing}`);
      }
      return one(actor, "narration", proposal.narration, proposal.visibility);
    }
    case "table-mode":
      return one(actor, "table-mode.changed", {
        reason: proposal.reason,
        before: p.tableMode,
        after: proposal.after,
      });
    case "scene": {
      if (p.scene === null && proposal.after === null) {
        return refuse(
          "INVALID_PROPOSAL",
          "a scene change has a before or an after",
        );
      }
      return one(actor, "scene.changed", {
        reason: proposal.reason,
        before: p.scene,
        after: proposal.after,
      });
    }
    case "party": {
      const before = memberOf(p.party, proposal.characterId);
      if (before === null && proposal.after === null) {
        return refuse(
          "INVALID_PROPOSAL",
          "a party change has a before or an after",
        );
      }
      return one(actor, "party.member.changed", {
        reason: proposal.reason,
        characterId: proposal.characterId,
        before,
        after: proposal.after,
      });
    }
    case "tracker": {
      const before =
        p.trackers.find((t) => t.trackerId === proposal.trackerId) ?? null;
      if (before === null && proposal.after === null) {
        return refuse(
          "INVALID_PROPOSAL",
          "a tracker change has a before or an after",
        );
      }
      return one(
        actor,
        "tracker.changed",
        {
          reason: proposal.reason,
          trackerId: proposal.trackerId,
          before,
          after: proposal.after,
        },
        "dm",
      );
    }
    case "journal": {
      if (p.journal.some((j) => j.entryId === proposal.entry.entryId)) {
        return refuse("JOURNAL_ENTRY_EXISTS", "the journal entry exists");
      }
      return one(
        actor,
        "journal.entry.added",
        proposal.entry,
        proposal.visibility,
      );
    }
  }
}

/**
 * Plans one permitted proposal against the DM projection `p`: runs every gate check for the
 * kind, then (mechanics only) calls the engine once. Writes nothing, reads no clock, and
 * mutates no input. `proposalId` is stamped on mechanics envelopes.
 */
export function planProposal(
  p: SessionProjections,
  proposer: Proposer,
  proposal: Proposal,
  rng: Rng,
  ids: PlanIds,
  proposalId: string | null,
  context?: PlanContext,
): PlanResult {
  return validate(plan(p, proposer, proposal, rng, ids, proposalId, context));
}
