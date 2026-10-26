import type { SessionProjections } from "../projections/types.js";
import type { GateRequest, Proposer } from "./proposals.js";
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
  "journal",
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
    case "action.commit":
      return ok;
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
