import type { Combatant } from "@the-stacks/dnd5e-engine";
import { reachOf, type SessionProjections } from "@the-stacks/session-model";
import type { SceneSeed } from "../seed/schema.js";
import { namedActorIds, nameTerms } from "./aliases.js";
import {
  type ActorController,
  type ActorResources,
  type ActorSheet,
  type ActorSnapshot,
  type ScenePresence,
  SNAPSHOT_VERSION,
  type SnapshotActor,
  SnapshotBuildError,
  type SnapshotStage,
} from "./types.js";

/**
 * Builds the actor snapshot from the DM projections and the scene seed
 * (contract §3). Pure and deterministic. It copies engine numbers; it computes none.
 */

function resourcesOf(c: Combatant): ActorResources {
  const slots: ActorResources["spellSlots"] = [];
  const levels = Object.keys(c.spellSlots.standard)
    .map((k) => Number(k))
    .sort((a, b) => a - b);
  for (const level of levels) {
    const slot = c.spellSlots.standard[String(level) as "1"];
    if (slot)
      slots.push({
        level,
        max: slot.max,
        expended: slot.expended,
        pact: false,
      });
  }
  if (c.spellSlots.pact) {
    slots.push({
      level: c.spellSlots.pact.level,
      max: c.spellSlots.pact.slot.max,
      expended: c.spellSlots.pact.slot.expended,
      pact: true,
    });
  }
  return {
    deathSaves: {
      successes: c.deathSaves.successes,
      failures: c.deathSaves.failures,
    },
    hitDice: c.hitDice.map((h) => ({
      die: h.die,
      total: h.total,
      remaining: h.remaining,
    })),
    spellSlots: slots,
  };
}

/** The combatant-derived fields of one actor (contract §3 rule 2). */
function stateOf(
  combatant: Combatant | undefined,
  initiative: number | null,
): Pick<
  SnapshotActor,
  "hp" | "lifeState" | "conditions" | "ac" | "initiative" | "resources"
> {
  if (!combatant) {
    return {
      hp: null,
      lifeState: null,
      conditions: [],
      ac: null,
      initiative: null,
      resources: null,
    };
  }
  return {
    hp: {
      current: combatant.hp.current,
      max: combatant.hp.max,
      temp: combatant.hp.temp,
    },
    lifeState: combatant.lifeState,
    conditions: combatant.conditions.map((x) => ({
      instanceId: x.instanceId,
      condition: x.condition,
      level: x.level,
      source: x.source,
      expiresAt: x.expiresAt
        ? {
            round: x.expiresAt.round,
            combatantId: x.expiresAt.combatantId,
            boundary: x.expiresAt.boundary,
          }
        : null,
    })),
    ac: combatant.ac,
    initiative,
    resources: resourcesOf(combatant),
  };
}

function sheetOf(
  seed: SceneSeed | null,
  characterId: string,
): ActorSheet | null {
  const c = seed?.characters.find((x) => x.characterId === characterId);
  if (!c) return null;
  const i = c.identity;
  return {
    abilityMods: { ...i.abilityMods },
    proficiencyBonus: i.proficiencyBonus,
    saves: { ...i.saves },
    skills: { ...i.skills },
    attacks: i.attacks.map((a) => ({
      name: a.name,
      expression: a.expression,
      damage: a.damage.map((d) => ({ dice: d.dice, damageType: d.damageType })),
    })),
    spells: [...i.spells],
  };
}

/**
 * The logged scene presence of an actor id (specs/048-scene-presence plan D4).
 * No entry means `present`. An entry for an id that matches no actor is never
 * read: the build looks up actor ids only.
 */
function presenceOf(
  projections: SessionProjections,
  id: string,
): ScenePresence {
  return projections.scenePresence[id]?.presence ?? "present";
}

function dedupe(values: readonly (string | null | undefined)[]): string[] {
  const out = new Set<string>();
  for (const v of values) if (v) out.add(v);
  return [...out];
}

const knowsOf = (
  id: string,
  rels: readonly { to: string }[] | undefined,
): string[] => dedupe([id, ...(rels ?? []).map((r) => r.to)]);

export function buildSnapshot(
  projections: SessionProjections,
  seed: SceneSeed | null,
): ActorSnapshot {
  const combatants = projections.engine.combatants;
  const initiativeOf = new Map<string, number>();
  for (const o of projections.encounter?.order ?? []) {
    initiativeOf.set(o.combatantId, o.initiative);
  }
  const claimed = new Set<string>();

  // Rule 1: party actors, in party order.
  const party: SnapshotActor[] = projections.party.map((m) => {
    const combatantId = m.combatantId;
    if (combatantId) claimed.add(combatantId);
    const combatant = combatantId ? combatants[combatantId] : undefined;
    const controller: ActorController =
      m.controller.kind === "player"
        ? { kind: "player", userId: m.controller.userId }
        : { kind: "ai-companion", actor: m.controller.actor };
    return {
      id: m.characterId,
      combatantId,
      characterId: m.characterId,
      name: m.name,
      aliases: nameTerms(m.name, [m.characterId, combatantId ?? ""]),
      kind: "party",
      controller,
      ...stateOf(
        combatant,
        combatantId ? (initiativeOf.get(combatantId) ?? null) : null,
      ),
      sheet: sheetOf(seed, m.characterId),
      presence: presenceOf(projections, m.characterId),
      met: true,
      knows: knowsOf(
        m.characterId,
        seed?.characters.find((c) => c.characterId === m.characterId)?.hooks
          .relationships,
      ),
      zone: null,
      reach: [],
    };
  });

  // Rule 3: seed NPCs; one joined to a live combatant is one actor.
  const npcActors: SnapshotActor[] = [];
  for (const npc of seed?.npcs ?? []) {
    const linked =
      npc.identity.combatant ?? (combatants[npc.id] ? npc.id : null);
    const combatant = linked ? combatants[linked] : undefined;
    const combatantId = combatant ? (linked as string) : null;
    if (combatantId) claimed.add(combatantId);
    npcActors.push({
      id: npc.id,
      combatantId,
      characterId: null,
      name: npc.name,
      aliases: dedupe([
        ...nameTerms(npc.name, [npc.id, combatantId ?? ""]),
        combatant?.name,
        ...npc.identity.aliases,
      ]),
      kind: "npc",
      controller: { kind: "dm" },
      ...stateOf(
        combatant,
        combatantId ? (initiativeOf.get(combatantId) ?? null) : null,
      ),
      sheet: null,
      presence: presenceOf(projections, npc.id),
      met: false,
      knows: knowsOf(npc.id, npc.hooks.relationships),
      zone: null,
      reach: [],
    });
  }

  // Rule 4: every other combatant is a monster actor.
  const monsters: SnapshotActor[] = [];
  for (const c of Object.values(combatants)) {
    if (claimed.has(c.id)) continue;
    const seedName = seed?.encounters
      .flatMap((e) => e.monsters)
      .find((m) => m.combatantId === c.id)?.name;
    monsters.push({
      id: c.id,
      combatantId: c.id,
      characterId: null,
      name: c.name,
      aliases: dedupe([...nameTerms(c.name, [c.id]), seedName]),
      kind: "monster",
      controller: { kind: "dm" },
      ...stateOf(c, initiativeOf.get(c.id) ?? null),
      sheet: null,
      presence: presenceOf(projections, c.id),
      met: false,
      knows: [c.id],
      zone: null,
      reach: [],
    });
  }

  // Rule 9: a duplicate id is a build error, never a merge or a drop.
  const all = [...party, ...npcActors, ...monsters];
  const seen = new Set<string>();
  for (const a of all) {
    if (seen.has(a.id)) {
      throw new SnapshotBuildError(
        "ACTOR_ID_COLLISION",
        `two actors share the id "${a.id}"`,
      );
    }
    seen.add(a.id);
  }

  // Spec 112 D1: met. Rule 4 reads public ai:dm narration/talk rows (never a companion's own talk).
  // ponytail: `removed` means "never introduced" only for scene-start seed rows; a mid-scene
  // `removed` presence also reads as unmet. Upgrade to a per-row `introduced` marker when a
  // playtest shows a removed-after-met actor dropped from prompts.
  const named = new Set<string>();
  for (const e of projections.transcript) {
    if (
      e.actor === "ai:dm" &&
      e.visibility === "public" &&
      (e.kind === "narration" || e.kind === "talk")
    )
      for (const id of namedActorIds({ actors: all }, e.text)) named.add(id);
  }
  for (const a of all) {
    const logged = projections.scenePresence[a.id];
    a.met =
      a.kind === "party" ||
      named.has(a.id) ||
      !logged ||
      logged.presence !== "absent" ||
      logged.reason !== "removed";
  }

  // Spec 100: zone and reach from the DM projection's spatial view (engine placements).
  const spatial = projections.spatial;
  const actorOfCombatant = new Map<string, string>();
  for (const a of all)
    if (a.combatantId) actorOfCombatant.set(a.combatantId, a.id);
  for (const a of all) {
    if (!a.combatantId) continue;
    const zone = spatial.placements[a.combatantId];
    if (zone === undefined) continue;
    a.zone = zone;
    a.reach = reachOf(spatial, a.combatantId).map(
      (id) => actorOfCombatant.get(id) ?? id,
    );
  }

  // Rule 5: party; encounter order; remaining combatant actors by id; seed NPCs with no combatant.
  const byCombatant = new Map<string, SnapshotActor>();
  for (const a of all) if (a.combatantId) byCombatant.set(a.combatantId, a);
  const actors: SnapshotActor[] = [...party];
  const listed = new Set(actors.map((a) => a.id));
  const push = (a: SnapshotActor | undefined) => {
    if (a && !listed.has(a.id)) {
      listed.add(a.id);
      actors.push(a);
    }
  };
  for (const o of projections.encounter?.order ?? [])
    push(byCombatant.get(o.combatantId));
  const rest = all
    .filter((a) => a.combatantId !== null && !listed.has(a.id))
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  for (const a of rest) push(a);
  for (const a of npcActors) push(a);

  return {
    v: SNAPSHOT_VERSION,
    throughSeq: projections.throughSeq,
    seedId: seed ? seed.seedId : null,
    actors,
    stage: stageOf(projections, actors, byCombatant),
  };
}

/** Contract §3 rule 6. */
function stageOf(
  projections: SessionProjections,
  actors: readonly SnapshotActor[],
  byCombatant: ReadonlyMap<string, SnapshotActor>,
): SnapshotStage {
  const enc = projections.encounter;
  const tm = projections.tableMode;
  let tableMode: SnapshotStage["tableMode"];
  if (tm.mode === "free") {
    tableMode = { mode: "free" };
  } else {
    let activeActorId: string | null = null;
    const byChar = tm.activeCharacterId
      ? actors.find((a) => a.characterId === tm.activeCharacterId)
      : undefined;
    if (byChar) activeActorId = byChar.id;
    else if (tm.activeActor === "ai:dm" && enc) {
      activeActorId = byCombatant.get(enc.activeCombatantId)?.id ?? null;
    } else {
      const companion = actors.find(
        (a) =>
          a.controller.kind === "ai-companion" &&
          a.controller.actor === tm.activeActor,
      );
      activeActorId = companion?.id ?? null;
    }
    tableMode = { mode: "turn", activeActor: tm.activeActor, activeActorId };
  }
  return {
    tableMode,
    encounter: enc
      ? {
          round: enc.round,
          activeCombatantId: enc.activeCombatantId,
          activeActorId: byCombatant.get(enc.activeCombatantId)?.id ?? null,
          order: enc.order
            .map((o) => byCombatant.get(o.combatantId)?.id)
            .filter((id): id is string => id !== undefined),
        }
      : null,
    scene: projections.scene
      ? {
          sceneId: projections.scene.sceneId,
          title: projections.scene.title,
          location: projections.scene.location,
        }
      : null,
    trackers: projections.trackers.map((t) => ({
      trackerId: t.trackerId,
      name: t.name,
      filled: t.filled,
      segments: t.segments,
    })),
    zones: zonesOf(projections),
  };
}

/** Spec 100: the engine space's zones, each flagged with whether the players' map holds it. */
function zonesOf(projections: SessionProjections): SnapshotStage["zones"] {
  const space = projections.engine.space;
  if (!space) return null;
  const onMap = new Set(
    (projections.spatial.map?.zones ?? []).map((z) => z.id),
  );
  return space.zones.map((z) => ({
    id: z.id,
    name: z.name,
    kind: z.kind,
    revealed: onMap.has(z.id),
  }));
}
