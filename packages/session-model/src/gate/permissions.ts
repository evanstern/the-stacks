import type { SessionProjections } from "../projections/types.js";
import { actorOf, type GateRequest, type Proposer } from "./proposals.js";
import {
  controls,
  isAiDm,
  isDm,
  isOperator,
  isPartyMember,
  isSeatedDm,
} from "./roles.js";

export type PermissionResult =
  | { ok: true }
  | { ok: false; code: "NOT_AUTHORIZED" | "NOT_DM"; message: string };

const DM_KINDS: ReadonlySet<string> = new Set([
  "action.resolve",
  "mechanics",
  "narration",
  "table-mode",
  "scene",
  "party",
  "tracker",
  "scene-presence",
  "journal",
  "action.suggest",
]);

const ok: PermissionResult = { ok: true };

function no(message: string): PermissionResult {
  return { ok: false, code: "NOT_AUTHORIZED", message };
}

/**
 * The permission matrix of contracts/proposals.md. Pure: reads the DM projection only.
 * `action.commit` passes here for any table member; commit authority decides at plan time.
 */
export function checkPermission(
  p: SessionProjections,
  proposer: Proposer,
  request: GateRequest,
): PermissionResult {
  const seated = isSeatedDm(p, proposer);
  const ai = isAiDm(proposer);
  const kind = request.kind;

  switch (kind) {
    case "talk": {
      if (
        request.kind === "talk" &&
        request.talk.channel === "ic" &&
        request.talk.characterId !== null &&
        !isDm(p, proposer) &&
        !controls(p, proposer, request.talk.characterId)
      ) {
        return no("an in-character line needs control of the character");
      }
      return ok;
    }
    case "action.declare": {
      if (request.kind !== "action.declare" || ai) {
        return no("the AI DM does not declare actions");
      }
      const { characterId, scope } = request.action;
      if (scope === "character") {
        return characterId !== null && controls(p, proposer, characterId)
          ? ok
          : no("a declaration needs control of the character");
      }
      return isPartyMember(p, proposer)
        ? ok
        : no("a party declaration needs a party member");
    }
    case "action.comment":
      return seated || ai || isPartyMember(p, proposer)
        ? ok
        : no("a comment needs a party member or the DM");
    case "action.accept":
      // Humans only; the planner checks who may accept the item (spec 066 FR-016, FR-020).
      return proposer.kind === "human"
        ? ok
        : no("only a human accepts a suggestion");
    case "action.commit":
    case "intent":
      // `planIntent` decides seat, actor and turn (FR-005 to FR-012).
      return ok;
    case "floor": {
      if (request.kind !== "floor") return no("not a floor request");
      // `end` by a party member, the seated DM or ai:dm passes here; the planner narrows it
      // (FLOOR_NOT_HELD, the absent-human rule).
      if (request.op === "end") {
        return seated || ai || isPartyMember(p, proposer)
          ? ok
          : no("only a party member or the DM ends a turn");
      }
      if (seated) return ok;
      if (ai) return no("the AI DM does not take or return the floor");
      return isPartyMember(p, proposer)
        ? { ok: false, code: "NOT_DM", message: "only the seated DM does this" }
        : no("only the seated DM takes or returns the floor");
    }
    case "action.withdraw": {
      if (request.kind !== "action.withdraw" || ai) {
        return no("the AI DM does not withdraw actions");
      }
      const action = p.actions.find((a) => a.actionId === request.actionId);
      // An unknown action passes here; the planner refuses it with UNKNOWN_ACTION.
      if (!action || seated || action.actor === actorOf(proposer)) return ok;
      return no("only the declarer or the seated DM withdraws an action");
    }
    case "proposal.approve":
    case "proposal.reject":
      return seated
        ? ok
        : { ok: false, code: "NOT_DM", message: "only the seated DM decides" };
    case "gate.policy":
      return seated || isOperator(proposer)
        ? ok
        : no("only the seated DM or an operator sets policy");
    case "dm.seat":
      return isOperator(proposer) ? ok : no("only an operator seats the DM");
    default:
      return DM_KINDS.has(kind) && (seated || ai)
        ? ok
        : no("only the DM submits this kind");
  }
}
