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
