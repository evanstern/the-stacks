import type { SessionProjections } from "../projections/types.js";
import type { Proposer } from "./proposals.js";

/** The row actor of a proposer, or a bare actor string. */
export type ActorRef = Proposer | { actor: string };

export function actorString(ref: ActorRef): string {
  if ("actor" in ref) return ref.actor;
  return ref.userId;
}

/** True when the proposer is the human seated as DM. */
export function isSeatedDm(p: SessionProjections, ref: ActorRef): boolean {
  const { seat } = p.gate;
  return seat.kind === "human" && actorString(ref) === seat.userId;
}

/** True when the proposer is the AI DM. */
export function isAiDm(ref: ActorRef): boolean {
  return actorString(ref) === "ai:dm";
}

/** True for the seated human DM or the AI DM. */
export function isDm(p: SessionProjections, ref: ActorRef): boolean {
  return isAiDm(ref) || isSeatedDm(p, ref);
}

/** True when the proposer is a human with the operator role. */
export function isOperator(ref: ActorRef): boolean {
  return "kind" in ref && ref.kind === "human" && ref.role === "operator";
}

/** True when the party member `characterId` is controlled by the proposer. */
export function controls(
  p: SessionProjections,
  ref: ActorRef,
  characterId: string,
): boolean {
  const actor = actorString(ref);
  const member = p.party.find((m) => m.characterId === characterId);
  if (!member) return false;
  return member.controller.kind === "player"
    ? member.controller.userId === actor
    : member.controller.actor === actor;
}

/** True when the proposer controls at least one party member. */
export function isPartyMember(p: SessionProjections, ref: ActorRef): boolean {
  const actor = actorString(ref);
  return p.party.some((m) =>
    m.controller.kind === "player"
      ? m.controller.userId === actor
      : m.controller.actor === actor,
  );
}
