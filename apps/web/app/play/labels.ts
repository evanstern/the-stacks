import type { PartyMemberView } from "@the-stacks/session-model";

const DM_ACTOR = "ai:dm";

/** A display name for an actor id: DM, "You", a party member's name, else the raw id. */
export function actorLabel(
  actorId: string,
  party: readonly PartyMemberView[],
  viewerActor: string,
): string {
  if (actorId === DM_ACTOR) return "DM";
  if (actorId === viewerActor) return "You";
  const member = party.find((m) =>
    m.controller.kind === "player"
      ? m.controller.userId === actorId
      : m.controller.actor === actorId,
  );
  return member ? member.name : actorId;
}

/** A character's display name; null stays null, an unknown id stays raw. */
export function characterLabel(
  characterId: string | null,
  party: readonly PartyMemberView[],
): string | null {
  if (characterId === null) return null;
  return party.find((m) => m.characterId === characterId)?.name ?? characterId;
}

const REFUSAL_LABEL: Record<string, string> = {
  FLOOR_NOT_HELD: "Only the active player or the DM can end this turn.",
  TURN_MOVED: "The turn moved on. Try again.",
  NOT_TURN_MODE: "The table is not in turn mode.",
  CONFLICT: "The table was busy, so your line was not sent. Send it again.",
  SUGGESTION_STALE: "The table moved on. That suggestion is out of date.",
  SUGGESTION_NOT_FOUND: "That suggestion is no longer there.",
  INTENT_EXISTS: "That line was already sent.",
  NOT_YOUR_TURN: "It is not your turn.",
};

/** Plain wording for a refusal code; null for any other code (the server message stands). */
export function refusalLabel(code: string | undefined): string | null {
  return (code && REFUSAL_LABEL[code]) || null;
}

/** Display words for an Intent kind on a confirm row; a kind with no entry shows its id (spec 105 OQ-6). */
export const KIND_LABEL: Record<string, string> = {
  attempt: "Action",
  attack: "Attack",
  cast: "Cast",
  dash: "Dash",
  dodge: "Dodge",
  disengage: "Disengage",
  help: "Help",
  hide: "Hide",
  search: "Search",
  move: "Move",
  check: "Check",
  save: "Save",
  say: "Say",
  emote: "Emote",
};

export function kindLabel(kind: string): string {
  return KIND_LABEL[kind] ?? kind;
}
