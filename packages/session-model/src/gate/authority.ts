import type {
  ActionAuthority,
  SessionProjections,
} from "../projections/types.js";
import type { Proposer } from "./proposals.js";
import { type ActorRef, actorString, controls, isDm } from "./roles.js";
import { signoffState } from "./signoff.js";

export type CommitDecision =
  | { ok: true; authority: ActionAuthority }
  | {
      ok: false;
      code: "UNKNOWN_ACTION" | "ACTION_NOT_OPEN" | "COMMIT_NOT_ALLOWED";
    }
  | {
      ok: false;
      code: "GROUP_SIGNOFF_REQUIRED";
      waiting: string[];
      objecting: string[];
    };

const refuse = (
  code: "UNKNOWN_ACTION" | "ACTION_NOT_OPEN" | "COMMIT_NOT_ALLOWED",
): CommitDecision => ({ ok: false, code });

/**
 * decision-0016's commit-authority table, made executable
 * (contracts/policy-and-authority.md). Pure over public projection data.
 */
export function commitAuthority(
  p: SessionProjections,
  committer: Proposer | { actor: string },
  actionId: string,
  present?: readonly string[],
): CommitDecision {
  const action = p.actions.find((a) => a.actionId === actionId);
  if (!action) return refuse("UNKNOWN_ACTION");
  if (action.status !== "declared" && action.status !== "discussed") {
    return refuse("ACTION_NOT_OPEN");
  }
  const ref: ActorRef = committer;
  if (isDm(p, ref)) return { ok: true, authority: "dm" };
  const actor = actorString(ref);

  if (action.scope === "party") {
    const humans = new Set(
      p.party.flatMap((m) =>
        m.controller.kind === "player" ? [m.controller.userId] : [],
      ),
    );
    if (!humans.has(actor)) return refuse("COMMIT_NOT_ALLOWED");
    if (humans.size > 1) {
      if (present === undefined) {
        return {
          ok: false,
          code: "GROUP_SIGNOFF_REQUIRED",
          waiting: [...humans].filter((u) => u !== actor).sort(),
          objecting: [],
        };
      }
      const state = signoffState(p, actionId, present, actor);
      if (state?.met) return { ok: true, authority: "group" };
      return {
        ok: false,
        code: "GROUP_SIGNOFF_REQUIRED",
        waiting: state?.waiting ?? [],
        objecting: state?.objecting ?? [],
      };
    }
    return { ok: true, authority: "group" };
  }

  if (action.characterId === null || !controls(p, ref, action.characterId)) {
    return refuse("COMMIT_NOT_ALLOWED");
  }
  if (p.tableMode.mode === "turn") {
    const { activeActor, activeCharacterId } = p.tableMode;
    return actor === activeActor &&
      (activeCharacterId === null || activeCharacterId === action.characterId)
      ? { ok: true, authority: "active-player" }
      : refuse("COMMIT_NOT_ALLOWED");
  }
  return actor === action.actor
    ? { ok: true, authority: "declarer" }
    : refuse("COMMIT_NOT_ALLOWED");
}
