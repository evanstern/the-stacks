import type { CastEntry, Scene, Way } from "@the-stacks/session-model";
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
    ways: Way[];
  };
  openingFraming: string;
  openingPremise: string;
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

/**
 * TASK-0334: the ways a player may see. A way gated by `after` shows once that zone is revealed.
 * `revealed` defaults to the scene-start map: every zone that is not hidden, plus the start zone.
 */
export function visibleWays(
  seed: SceneSeed,
  revealed?: ReadonlySet<string>,
): Way[] {
  const shown =
    revealed ??
    new Set(
      (seed.space?.zones ?? [])
        .filter((z) => !z.hidden || z.id === seed.space?.start)
        .map((z) => z.id),
    );
  return seed.location.ways
    .filter((w) => !w.after || shown.has(w.after))
    .map((w) => ({ label: w.label, draft: w.draft }));
}

export function playerFacingSeed(
  seed: SceneSeed,
  revealed?: ReadonlySet<string>,
): PlayerSeedView {
  return {
    seedId: seed.seedId,
    title: seed.title,
    goalStatement: seed.goal.statement,
    location: {
      name: seed.location.name,
      features: [...seed.location.identity.features],
      mood: seed.location.portrayal.mood,
      senses: [...seed.location.portrayal.senses],
      ways: visibleWays(seed, revealed),
    },
    openingFraming: seed.opening.framing,
    openingPremise: seed.opening.premise,
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

/** Spec 091 D2: the scene-start payload. It reads the player-facing view only. */
export function openingScene(view: PlayerSeedView): Scene {
  const cast: CastEntry[] = view.npcs.map((n) => ({
    id: n.id,
    name: n.name,
    role: n.role,
    appearance: n.appearance,
  }));
  return {
    sceneId: view.seedId,
    title: view.title,
    summary: view.goalStatement,
    location: view.location.name,
    description: view.location.features.join(" ").slice(0, 1000),
    ...(view.location.ways.length > 0 ? { ways: view.location.ways } : {}),
    cast,
  };
}

/** Every non-empty DM-only string in the seed, with its JSON Pointer into the seed. */
function dmOnlyEntries(seed: SceneSeed): [string, string][] {
  const out: [string, string][] = [
    ["/goal/success", seed.goal.success],
    ["/goal/failure", seed.goal.failure],
  ];
  const list = (base: string, items: string[]) =>
    items.forEach((s, i) => {
      out.push([`${base}/${i}`, s]);
    });
  list("/location/hooks/secrets", seed.location.hooks.secrets);
  seed.npcs.forEach((n, i) => {
    list(`/npcs/${i}/hooks/knows`, n.hooks.knows);
    list(`/npcs/${i}/hooks/secrets`, n.hooks.secrets);
  });
  seed.characters.forEach((c, i) => {
    list(`/characters/${i}/hooks/secrets`, c.hooks.secrets);
  });
  seed.beats.forEach((b, i) => {
    out.push([`/beats/${i}/summary`, b.summary]);
    b.clues.forEach((k, j) => {
      out.push([`/beats/${i}/clues/${j}/text`, k.text]);
    });
  });
  seed.encounters.forEach((e, i) => {
    out.push([`/encounters/${i}/terrain`, e.terrain]);
    out.push([`/encounters/${i}/trigger`, e.trigger]);
    out.push([`/encounters/${i}/morale`, e.morale]);
  });
  seed.trackers.forEach((t, i) => {
    out.push([`/trackers/${i}/note`, t.note]);
    out.push([`/trackers/${i}/advanceWhen`, t.advanceWhen]);
  });
  return out.filter(([, s]) => s.length > 0);
}

/** JSON Pointers into the seed of every non-empty DM-only field. */
export function dmOnlySeedPaths(seed: SceneSeed): string[] {
  return dmOnlyEntries(seed).map(([path]) => path);
}

/** Every DM-only string in the seed, for tests. Non-empty strings only. */
export function dmOnlySeedText(seed: SceneSeed): string[] {
  return dmOnlyEntries(seed).map(([, s]) => s);
}
