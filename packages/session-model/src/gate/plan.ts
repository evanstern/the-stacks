import { execute, type Rng } from "@the-stacks/dnd5e-engine";
import { catalogEntry, currentVersion } from "../catalog.js";
import { REASON_TO_PRESENCE } from "../events/scene-presence.js";
import { memberOf } from "../projections/party.js";
import type { SessionProjections } from "../projections/types.js";
import { commitAuthority } from "./authority.js";
import { declareIntent } from "./declare.js";
import { endTurnRows } from "./floor-end.js";
import { fogRows } from "./fog.js";
import { planIntent } from "./intents.js";
import type { PlannerInputs } from "./plan-state.js";
import { actorOf, type Proposal, type Proposer } from "./proposals.js";
import { controls, isAiDm, isDm, isPartyMember, isSeatedDm } from "./roles.js";
import {
  mechanicsRows,
  type PlanIds,
  type PlannedRow,
  type PlanResult,
  refuse,
} from "./rows.js";
import { signoffState } from "./signoff.js";
import { activeActorFor, currentTurn, floorHeld } from "./turn.js";

/**
 * Facts the planner cannot read from the projection (specs/044-group-signoff/contracts/signoff.md).
 * `present` is the present set (user ids) the group sign-off quorum counts.
 */
export type { PlanIds, PlannedRow, PlanResult };
export { mechanicsRows };

export interface PlanContext {
  present?: readonly string[];
  /** Seed-derived planner inputs for `intent` requests (spec 102 FR-013). */
  planner?: PlannerInputs;
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

/**
 * The AI DM's stall override (specs/049-turn-floor, research R11, ruling FT-5). The time
 * window is the job's check; the planner has no clock. It refuses unless the proposer is
 * `ai:dm`, the action is an open party action and the party has two or more humans, and it
 * refuses `GROUP_SIGNOFF_REQUIRED` when a present quorum member objects. The `signoff`
 * marker holds exactly the present set: `ai:dm` is not a party human, so it is not added.
 */
function planStall(
  p: SessionProjections,
  proposer: Proposer,
  actionId: string,
  present: readonly string[] | undefined,
): PlanResult {
  const action = findAction(p, actionId);
  if (!action) return refuse("UNKNOWN_ACTION", "no such action");
  if (action.status !== "declared" && action.status !== "discussed") {
    return refuse("ACTION_NOT_OPEN", "the action is not open");
  }
  if (!isAiDm(proposer)) {
    return refuse("INVALID_PROPOSAL", "only the AI DM overrides a stall");
  }
  if (action.scope !== "party") {
    return refuse("INVALID_PROPOSAL", "a stall override needs a party action");
  }
  if (partyHumans(p).size < 2) {
    return refuse(
      "INVALID_PROPOSAL",
      "a stall override needs two or more party humans",
    );
  }
  if (present === undefined) {
    return refuse("INVALID_PROPOSAL", "a stall override needs the present set");
  }
  const state = signoffState(p, actionId, present);
  if (state && state.objecting.length > 0) {
    return refuse("GROUP_SIGNOFF_REQUIRED", "a present party member objects", {
      waiting: state.waiting,
      objecting: state.objecting,
    });
  }
  return {
    ok: true,
    rows: [
      {
        actor: "system",
        type: "presence.recorded",
        visibility: "public",
        payload: {
          present: [...new Set(present)].sort(),
          purpose: "signoff",
          actionId,
        },
      },
      {
        actor: "ai:dm",
        type: "action.committed",
        payload: { actionId, authority: "dm" },
        visibility: "public",
      },
    ],
    batchId: null,
  };
}

type FloorProposal = Extract<Proposal, { kind: "floor" }>;

/**
 * Plans a `floor` request (specs/049-turn-floor, research R3 to R5). Checks run in order
 * before any die is drawn; a refusal plans no rows. `end` runs `turn.advance` and the
 * shared settling rule on an evolving engine state, then names the next holder.
 */
function planFloor(
  p: SessionProjections,
  proposer: Proposer,
  proposal: FloorProposal,
  rng: Rng,
  ids: PlanIds,
  proposalId: string | null,
  context: PlanContext | undefined,
): PlanResult {
  const actor = actorOf(proposer);
  const now = currentTurn(p);
  if (p.tableMode.mode !== "turn" || now === null) {
    return refuse("NOT_TURN_MODE", "the table is not in turn mode");
  }
  if (
    proposal.turn.round !== now.round ||
    proposal.turn.combatantId !== now.combatantId
  ) {
    return refuse("TURN_MOVED", "the turn has moved", {
      expected: proposal.turn,
      actual: now,
    });
  }
  const holder = p.tableMode.activeActor;
  const seated = isSeatedDm(p, proposer);
  const toModeRow = (after: unknown): PlannedRow => ({
    actor,
    type: "table-mode.changed",
    visibility: "public",
    payload: { reason: proposal.reason, before: p.tableMode, after },
  });

  if (proposal.op !== "end") {
    if (!seated) {
      return isAiDm(proposer)
        ? refuse(
            "NOT_AUTHORIZED",
            "the AI DM does not take or return the floor",
          )
        : refuse("NOT_DM", "only the seated DM takes or returns the floor");
    }
    const held = floorHeld(p);
    if (proposal.op === "take") {
      if (held) return refuse("INVALID_PROPOSAL", "the DM holds the floor");
      return one(
        actor,
        "table-mode.changed",
        toModeRow({
          mode: "turn",
          activeActor: actor,
          activeCharacterId: null,
        }).payload,
      );
    }
    if (!held)
      return refuse("INVALID_PROPOSAL", "the DM does not hold the floor");
    return one(
      actor,
      "table-mode.changed",
      toModeRow({ mode: "turn", ...activeActorFor(p, now.combatantId) })
        .payload,
    );
  }

  if (isAiDm(proposer)) {
    const absent =
      !holder.startsWith("ai:") &&
      context?.present !== undefined &&
      !context.present.includes(holder);
    if (!absent) {
      return refuse(
        "NOT_AUTHORIZED",
        "the AI DM passes only an absent human's turn",
      );
    }
  } else if (!seated && actor !== holder) {
    return refuse("FLOOR_NOT_HELD", "the floor is not yours", { holder });
  }

  return endTurnRows(
    p,
    proposer,
    proposal.reason,
    rng,
    ids,
    proposalId,
    isAiDm(proposer) ? (context?.present ?? []) : undefined,
  );
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
      const downed =
        action.scope === "character"
          ? p.party.filter((m) => m.characterId === action.characterId)
          : p.party.filter((m) => controls(p, proposer, m.characterId));
      const absent = (m: (typeof downed)[number]) =>
        p.scenePresence[m.characterId]?.presence === "absent";
      const unable = (m: (typeof downed)[number]) =>
        absent(m) ||
        (m.combatant !== null && m.combatant.lifeState !== "conscious");
      if (downed.length > 0 && downed.every(unable)) {
        const firstAbsent = downed.find(absent);
        const first = firstAbsent ?? downed[0];
        if (firstAbsent) {
          return refuse(
            "CHARACTER_UNABLE",
            "the character cannot act: absent from the scene",
            { characterId: first.characterId, reason: "absent" },
          );
        }
        return refuse(
          "CHARACTER_UNABLE",
          "the character cannot act: not conscious",
          {
            characterId: first.characterId,
            reason: "life-state",
            lifeState: first.combatant?.lifeState,
          },
        );
      }
      // FR-027: the envelope validates the request as an Intent; the rows stay today's.
      const envelope = declareIntent(action, proposer, p);
      if (!envelope.ok) {
        return refuse("INVALID_PROPOSAL", envelope.message);
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
      if (proposal.override === "stall") {
        return planStall(p, proposer, proposal.actionId, context?.present);
      }
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
    case "scene-presence": {
      if (proposal.actionId !== null && !findAction(p, proposal.actionId)) {
        return refuse("UNKNOWN_ACTION", "no such action");
      }
      const before = p.scenePresence[proposal.actorId]?.presence ?? "present";
      const after = REASON_TO_PRESENCE[proposal.reason];
      if (before === after) {
        return refuse(
          "INVALID_PROPOSAL",
          "a presence change changes the value",
        );
      }
      const changed: PlannedRow = {
        actor,
        type: "scene-presence.changed",
        payload: {
          actorId: proposal.actorId,
          before,
          after,
          reason: proposal.reason,
          actionId: proposal.actionId,
        },
        visibility: proposal.visibility,
      };
      const member = p.party.find((m) => m.characterId === proposal.actorId);
      const cid = member ? member.combatantId : proposal.actorId;
      const encounter = p.engine.encounter;
      const inOrder =
        cid !== null &&
        (encounter?.order.some((e) => e.combatantId === cid) ?? false);
      const placed = cid !== null && p.engine.combatants[cid]?.placement;
      let command: unknown = null;
      if (cid !== null && after === "absent" && (inOrder || placed)) {
        // Spec 099: a departure leaves the order and the zone.
        command = {
          type: "combatant.depart",
          combatantId: cid,
          reason: `${proposal.actorId} ${proposal.reason}`,
        };
      } else if (
        cid !== null &&
        after === "yielded" &&
        p.engine.combatants[cid]?.side === "hostile"
      ) {
        command = {
          type: "combatant.side",
          combatantId: cid,
          side: "neutral",
          reason: `${proposal.actorId} ${proposal.reason}`,
        };
      } else if (
        cid !== null &&
        proposal.reason === "arrived" &&
        encounter !== null &&
        !inOrder &&
        p.engine.combatants[cid] !== undefined
      ) {
        command = {
          type: "initiative.join",
          combatantId: cid,
          mode: "normal",
          reason: `${proposal.actorId} ${proposal.reason}`,
        };
      }
      if (command === null) return { ok: true, rows: [changed], batchId: null };
      const result = execute(p.engine, command, rng);
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
        visibility: "public",
      });
      return {
        ok: true,
        rows: [changed, ...rows],
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
    case "floor":
      return planFloor(p, proposer, proposal, rng, ids, proposalId, context);
    case "intent":
      return planIntent(
        p,
        proposer,
        proposal.intent,
        rng,
        ids,
        proposalId,
        context,
      );
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
  const planned = plan(p, proposer, proposal, rng, ids, proposalId, context);
  if (!planned.ok) return validate(planned);
  // Spec 100: every spatial row passes the fog rule before validation.
  const rows = fogRows(p, planned.rows);
  // Spec 102 OQ-12: a carrier row is `dm` when the fog rule made any row of its batch `dm`.
  const hidden = rows.some(
    (r) => r.type !== "intent.recorded" && r.visibility === "dm",
  );
  return validate({
    ...planned,
    rows: hidden
      ? rows.map((r) =>
          r.type === "intent.recorded" ? { ...r, visibility: "dm" } : r,
        )
      : rows,
  });
}
