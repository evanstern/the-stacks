import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { estimateTokens } from "@the-stacks/srd";
import { describe, expect, it } from "vitest";
import { partyNameTerms } from "../../src/dm/nodes/audit.js";
import { dmOnlySeedText } from "../../src/dm/seed/views.js";
import {
  buildSnapshot,
  nameTerms,
  renderSnapshot,
  SnapshotBuildError,
} from "../../src/dm/snapshot/index.js";
import {
  clone,
  combatant,
  greyhollowFight,
  PLAYER_USER,
} from "./snapshot-fixtures.js";

describe("buildSnapshot", () => {
  it("gives nine actors with Snag joined once, in contract order", () => {
    const { projections, seed } = greyhollowFight();
    const s = buildSnapshot(projections, seed);
    expect(s.actors).toHaveLength(9);
    expect(s.actors.filter((a) => a.id === "snag")).toHaveLength(1);
    // party; encounter order not yet listed; rest by id; NPCs with no combatant
    expect(s.actors.map((a) => a.id)).toEqual([
      "tamsin",
      "odo",
      "kestrel",
      "snag",
      "goblin-2",
      "goblin-3",
      "goblin-4",
      "wenna",
      "pell",
    ]);
    expect(s.v).toBe(1);
    expect(s.seedId).toBe(seed.seedId);
    expect(s.throughSeq).toBe(120);
  });

  it("fills every contract field", () => {
    const { projections, seed } = greyhollowFight();
    const odo = projections.engine.combatants.odo;
    if (!odo) throw new Error("no odo");
    odo.conditions = [
      {
        instanceId: "c1",
        condition: "frightened",
        level: null,
        source: "goblin",
        expiresAt: { round: 3, combatantId: "odo", boundary: "turn-end" },
      },
    ];
    odo.spellSlots = {
      standard: { "2": { max: 2, expended: 0 }, "1": { max: 3, expended: 1 } },
      pact: { level: 2, slot: { max: 1, expended: 1 } },
    };
    odo.deathSaves = { successes: 1, failures: 2 };
    const s = buildSnapshot(projections, seed);
    const tamsin = s.actors.find((a) => a.id === "tamsin");
    expect(tamsin).toMatchObject({
      id: "tamsin",
      combatantId: "tamsin",
      characterId: "tamsin",
      name: "Tamsin Vale",
      kind: "party",
      controller: { kind: "player", userId: PLAYER_USER },
      hp: { current: 18, max: 22, temp: 0 },
      lifeState: "conscious",
      conditions: [],
      ac: 15,
      initiative: 12,
      presence: "present",
    });
    expect(tamsin?.sheet?.proficiencyBonus).toBe(
      seed.characters[0]?.identity.proficiencyBonus,
    );
    expect(tamsin?.resources?.hitDice).toEqual([
      { die: 8, total: 3, remaining: 2 },
    ]);
    const o = s.actors.find((a) => a.id === "odo");
    expect(o?.controller).toEqual({
      kind: "ai-companion",
      actor: "ai:companion:odo",
    });
    expect(o?.conditions).toEqual([
      {
        instanceId: "c1",
        condition: "frightened",
        level: null,
        source: "goblin",
        expiresAt: { round: 3, combatantId: "odo", boundary: "turn-end" },
      },
    ]);
    expect(o?.resources?.spellSlots).toEqual([
      { level: 1, max: 3, expended: 1, pact: false },
      { level: 2, max: 2, expended: 0, pact: false },
      { level: 2, max: 1, expended: 1, pact: true },
    ]);
    expect(o?.resources?.deathSaves).toEqual({ successes: 1, failures: 2 });
    const snag = s.actors.find((a) => a.id === "snag");
    expect(snag).toMatchObject({
      kind: "npc",
      controller: { kind: "dm" },
      combatantId: "snag",
      characterId: null,
      sheet: null,
      ac: 13,
    });
    const goblin = s.actors.find((a) => a.id === "goblin-2");
    expect(goblin).toMatchObject({ kind: "monster", name: "Goblin" });
    expect(goblin?.aliases).toContain("Goblin with a pot-helm");
    const wenna = s.actors.find((a) => a.id === "wenna");
    expect(wenna).toMatchObject({
      kind: "npc",
      combatantId: null,
      hp: null,
      lifeState: null,
      conditions: [],
      ac: null,
      initiative: null,
      resources: null,
      sheet: null,
    });
  });

  it("resolves the stage active actor for ai:dm, a companion and a character", () => {
    const { projections, seed } = greyhollowFight();
    expect(buildSnapshot(projections, seed).stage).toMatchObject({
      tableMode: {
        mode: "turn",
        activeActor: "ai:dm",
        activeActorId: "snag",
      },
      encounter: {
        round: 2,
        activeCombatantId: "snag",
        activeActorId: "snag",
        order: ["kestrel", "snag", "tamsin", "goblin-2", "odo"],
      },
      scene: { sceneId: "greyhollow-ford", location: "the ford" },
      trackers: [{ trackerId: "dusk", filled: 2, segments: 6, name: "Dusk" }],
    });
    const companion = clone(projections);
    companion.tableMode = {
      mode: "turn",
      activeActor: "ai:companion:odo",
      activeCharacterId: null,
    };
    expect(buildSnapshot(companion, seed).stage.tableMode).toMatchObject({
      activeActorId: "odo",
    });
    const human = clone(projections);
    human.tableMode = {
      mode: "turn",
      activeActor: PLAYER_USER,
      activeCharacterId: "tamsin",
    };
    expect(buildSnapshot(human, seed).stage.tableMode).toMatchObject({
      activeActorId: "tamsin",
    });
    const free = clone(projections);
    free.tableMode = { mode: "free" };
    expect(buildSnapshot(free, seed).stage.tableMode).toEqual({ mode: "free" });
  });

  it("keeps a party member with no combatant as an actor with null state", () => {
    const { projections, seed } = greyhollowFight();
    const p = clone(projections);
    const m = p.party.find((x) => x.characterId === "kestrel");
    if (!m) throw new Error("no kestrel");
    m.combatantId = null;
    delete p.engine.combatants.kestrel;
    if (p.engine.encounter)
      p.engine.encounter.order = p.engine.encounter.order.filter(
        (o) => o.combatantId !== "kestrel",
      );
    p.encounter = null;
    p.engine.encounter = null;
    const s = buildSnapshot(p, seed);
    const k = s.actors.find((a) => a.id === "kestrel");
    expect(k).toMatchObject({
      combatantId: null,
      hp: null,
      lifeState: null,
      conditions: [],
      ac: null,
      initiative: null,
      resources: null,
    });
    expect(k?.sheet).not.toBeNull();
    expect(s.stage.encounter).toBeNull();
  });

  it("builds without a seed: no NPCs, no sheets, null seedId", () => {
    const { projections } = greyhollowFight();
    const s = buildSnapshot(projections, null);
    expect(s.seedId).toBeNull();
    // snag is now a plain combatant (kind monster)
    expect(s.actors.map((a) => a.id)).not.toContain("wenna");
    expect(s.actors.find((a) => a.id === "snag")?.kind).toBe("monster");
    expect(s.actors.every((a) => a.sheet === null)).toBe(true);
    expect(s.actors).toHaveLength(7);
  });

  it("throws ACTOR_ID_COLLISION when two actors share an id", () => {
    const { projections, seed } = greyhollowFight();
    const p = clone(projections);
    // A seed NPC with no combatant link whose id equals a monster combatant id.
    const s2 = clone(seed);
    const wenna = s2.npcs.find((n) => n.id === "wenna");
    if (!wenna) throw new Error("no wenna");
    wenna.id = "goblin-3";
    expect(() => buildSnapshot(p, s2)).toThrow(SnapshotBuildError);
    try {
      buildSnapshot(p, s2);
    } catch (e) {
      expect((e as SnapshotBuildError).code).toBe("ACTOR_ID_COLLISION");
    }
  });

  it("is deterministic and holds no DM-only seed text", () => {
    const { projections, seed } = greyhollowFight();
    const a = buildSnapshot(projections, seed);
    const b = buildSnapshot(clone(projections), clone(seed));
    expect(a).toEqual(b);
    const json = JSON.stringify(a);
    for (const secret of dmOnlySeedText(seed)) {
      expect(json).not.toContain(secret);
    }
  });

  it("uses a combatant name for a monster with no seed name", () => {
    const { projections, seed } = greyhollowFight();
    const p = clone(projections);
    p.engine.combatants["orc-9"] = combatant("orc-9", "Orc");
    const s = buildSnapshot(p, seed);
    expect(s.actors.find((a) => a.id === "orc-9")?.aliases).toEqual([
      "Orc",
      "orc-9",
    ]);
  });
});

describe("buildSnapshot: logged scene presence", () => {
  const entry = (presence: "absent" | "yielded", seq = 125) => ({
    presence,
    reason: presence === "absent" ? ("fled" as const) : ("conceded" as const),
    seq,
  });

  it("reads an absent monster keyed by combatant id", () => {
    const { projections, seed } = greyhollowFight();
    projections.scenePresence["goblin-3"] = entry("absent");
    const s = buildSnapshot(projections, seed);
    expect(s.actors.find((a) => a.id === "goblin-3")?.presence).toBe("absent");
    expect(s.actors.find((a) => a.id === "goblin-2")?.presence).toBe("present");
  });

  it("reads a party member keyed by character id, not combatant id", () => {
    const { projections, seed } = greyhollowFight();
    projections.scenePresence.odo = entry("yielded");
    const s = buildSnapshot(projections, seed);
    expect(s.actors.find((a) => a.id === "odo")?.presence).toBe("yielded");
  });

  it("reads a joined NPC keyed by NPC id", () => {
    const { projections, seed } = greyhollowFight();
    projections.scenePresence.snag = entry("absent");
    const s = buildSnapshot(projections, seed);
    expect(s.actors.find((a) => a.id === "snag")?.presence).toBe("absent");
    expect(s.actors.filter((a) => a.id === "snag")).toHaveLength(1);
  });

  it("compresses an absent actor under the fiction cap", () => {
    const { projections, seed } = greyhollowFight();
    projections.scenePresence["goblin-3"] = entry("absent");
    const snap = buildSnapshot(projections, seed);
    const full = renderSnapshot(snap, { view: "fiction", cap: 1_000_000 });
    if (!full.ok) throw new Error("overflow");
    const tight = renderSnapshot(snap, {
      view: "fiction",
      cap: full.lines.reduce((n, l) => n + estimateTokens(l) + 1, 0) - 1,
    });
    if (!tight.ok) throw new Error("overflow");
    expect(tight.lines).toContain("Goblin (monster): gone");
  });

  it("ignores an entry for an unknown id", () => {
    const { projections, seed } = greyhollowFight();
    const before = buildSnapshot(projections, seed);
    projections.scenePresence["nobody-9"] = entry("absent");
    expect(buildSnapshot(projections, seed)).toEqual(before);
  });
});

describe("aliases", () => {
  it('"Brother Odo" gives "Odo"', () => {
    const { projections, seed } = greyhollowFight();
    const odo = buildSnapshot(projections, seed).actors.find(
      (a) => a.id === "odo",
    );
    expect(odo?.aliases).toEqual(["Brother Odo", "odo", "Odo"]);
  });

  it("Snag carries its engine name; ids join only when they differ", () => {
    const { projections, seed } = greyhollowFight();
    const p = clone(projections);
    const e = p.engine.combatants.snag;
    if (!e) throw new Error("no snag");
    e.name = "Snag the Quick";
    const snag = buildSnapshot(p, seed).actors.find((a) => a.id === "snag");
    // name "Snag", id "snag" (differs from the name by case), engine name
    expect(snag?.aliases).toEqual(["Snag", "snag", "Snag the Quick"]);
    const tamsin = buildSnapshot(projections, seed).actors.find(
      (a) => a.id === "tamsin",
    );
    expect(tamsin?.aliases).toEqual(["Tamsin Vale", "tamsin", "Tamsin"]);
  });

  it("nameTerms matches partyNameTerms output", () => {
    const party = [
      { characterId: "odo", name: "Brother Odo" },
      { characterId: "tamsin", name: "Tamsin Vale" },
      { characterId: "x", name: "  " },
    ];
    expect(partyNameTerms(party as never)).toEqual([
      "Brother Odo",
      "odo",
      "Odo",
      "Tamsin Vale",
      "tamsin",
      "Tamsin",
      "x",
    ]);
    expect(nameTerms("Sir Dame", [])).toEqual(["Sir Dame"]);
  });
});

describe("fiction render of the world (moved from facts.test.ts)", () => {
  const worldNames = (): string[] => {
    const { projections, seed } = greyhollowFight();
    const r = renderSnapshot(buildSnapshot(projections, seed), {
      view: "fiction",
      cap: 800,
    });
    if (!r.ok) throw new Error("overflow");
    return r.lines;
  };

  it("lists Snag once, joined across the seed NPC and the combatant", () => {
    const lines = worldNames();
    expect(lines.filter((l) => l.startsWith("Snag "))).toHaveLength(1);
  });

  it("lists every world character once and no party member as a world character", () => {
    const lines = worldNames();
    const monsters = lines.filter((l) => l.includes("(monster)"));
    expect(monsters).toHaveLength(3);
    expect(lines.filter((l) => l.startsWith("Brother Odo "))).toHaveLength(1);
    expect(lines.some((l) => l.startsWith("Brother Odo (npc)"))).toBe(false);
  });
});

describe("retired names (T026)", () => {
  const SRC = join(dirname(fileURLToPath(import.meta.url)), "../../src");
  const walk = (dir: string): string[] =>
    readdirSync(dir).flatMap((n) => {
      const f = join(dir, n);
      return statSync(f).isDirectory() ? walk(f) : f.endsWith(".ts") ? [f] : [];
    });

  it("no file under src names projectionEntries or npcNames", () => {
    const hits = walk(SRC).filter((f) =>
      /projectionEntries|npcNames/.test(readFileSync(f, "utf8")),
    );
    expect(hits).toEqual([]);
  });
});
