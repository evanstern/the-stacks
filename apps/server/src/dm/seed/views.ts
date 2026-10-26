import type { SceneSeed, SeedCharacterT } from "./schema.js";

/**
 * The player-facing seed view (specs/034-narration-quality
 * contracts/player-facing-context.md). It copies only player-facing fields.
 * Player-facing generators (narrate, companion, chronicle) take this view,
 * never the full seed.
 */
export interface PlayerSeedView {
  seedId: string;
  title: string;
  goalStatement: string;
  location: {
    name: string;
    features: string[];
    mood: string;
    senses: string[];
  };
  openingFraming: string;
  npcs: {
    id: string;
    name: string;
    role: string;
    voice: string;
    want: string;
    detail: string;
    appearance: string;
  }[];
  characters: {
    characterId: string;
    name: string;
    seat: "human" | "companion";
    identity: SeedCharacterT["identity"];
    portrayal: SeedCharacterT["portrayal"];
    knows: string[];
    relationships: { to: string; kind: string }[];
  }[];
}

export function playerFacingSeed(seed: SceneSeed): PlayerSeedView {
  return {
    seedId: seed.seedId,
    title: seed.title,
    goalStatement: seed.goal.statement,
    location: {
      name: seed.location.name,
      features: [...seed.location.identity.features],
      mood: seed.location.portrayal.mood,
      senses: [...seed.location.portrayal.senses],
    },
    openingFraming: seed.opening.framing,
    npcs: seed.npcs.map((n) => ({
      id: n.id,
      name: n.name,
      role: n.identity.role,
      voice: n.portrayal.voice,
      want: n.portrayal.want,
      detail: n.portrayal.detail,
      appearance: n.portrayal.appearance,
    })),
    characters: seed.characters.map((c) => ({
      characterId: c.characterId,
      name: c.name,
      seat: c.seat,
      identity: c.identity,
      portrayal: c.portrayal,
      knows: [...c.hooks.knows],
      relationships: c.hooks.relationships.map((r) => ({
        to: r.to,
        kind: r.kind,
      })),
    })),
  };
}

/** Every DM-only string in the seed, for tests. Non-empty strings only. */
export function dmOnlySeedText(seed: SceneSeed): string[] {
  const out: string[] = [
    seed.goal.success,
    seed.goal.failure,
    ...seed.location.hooks.secrets,
  ];
  for (const n of seed.npcs) {
    out.push(...n.hooks.knows, ...n.hooks.secrets);
  }
  for (const c of seed.characters) out.push(...c.hooks.secrets);
  for (const b of seed.beats) {
    out.push(b.summary);
    for (const k of b.clues) out.push(k.text);
  }
  for (const e of seed.encounters) out.push(e.terrain, e.trigger, e.morale);
  for (const t of seed.trackers) out.push(t.note, t.advanceWhen);
  return out.filter((s) => s.length > 0);
}
