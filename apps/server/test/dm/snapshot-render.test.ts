import { writeFileSync } from "node:fs";
import { estimateTokens } from "@the-stacks/srd";
import { describe, expect, it } from "vitest";
import { CAPS } from "../../src/dm/prompts/common.js";
import type { SceneSeed } from "../../src/dm/seed/schema.js";
import { dmOnlySeedText } from "../../src/dm/seed/views.js";
import {
  type ActorSnapshot,
  buildSnapshot,
  type RenderOptions,
  renderSnapshot,
  SnapshotOverflowError,
  snapshotSection,
} from "../../src/dm/snapshot/index.js";
import {
  clone,
  combatant,
  condition,
  greyhollowFight,
  PLAYER_USER,
} from "./snapshot-fixtures.js";

const VIEWS: RenderOptions[] = [
  { view: "dm", cap: CAPS.snapshotDm },
  { view: "seat", cap: CAPS.snapshotSeat, self: "odo" },
  { view: "fiction", cap: CAPS.snapshotFiction },
];

const tokens = (lines: readonly string[]) =>
  lines.reduce((n, l) => n + estimateTokens(l) + 1, 0);

/** n party members (the shipped sheets, cycled), m monsters, k NPCs without combatants. */
function big(parties: number, monsters: number, npcs: number) {
  const { projections, seed } = greyhollowFight();
  const p = clone(projections);
  const s: SceneSeed = clone(seed);
  const base = s.characters;
  s.characters = Array.from({ length: parties }, (_, i) => {
    const src = clone(base[i % base.length]);
    if (!src) throw new Error("no character");
    return { ...src, characterId: `pc-${i}`, name: `Hero ${"abcdefghij"[i]}` };
  });
  p.engine.combatants = {};
  p.party = s.characters.map((c, i) => {
    p.engine.combatants[c.characterId] = combatant(c.characterId, c.name, {
      hp: { current: 20, max: 24, temp: 0 },
      ac: 16,
      hitDice: [{ die: 8, total: 3, remaining: 3 }],
      spellSlots: {
        standard: {
          "1": { max: 4, expended: 1 },
          "2": { max: 3, expended: 0 },
        },
        pact: null,
      },
    });
    return {
      characterId: c.characterId,
      name: c.name,
      controller:
        i === 0
          ? { kind: "player" as const, userId: PLAYER_USER }
          : {
              kind: "ai-companion" as const,
              actor: `ai:companion:${c.characterId}`,
            },
      combatantId: c.characterId,
      combatant: null,
    };
  });
  for (let i = 0; i < monsters; i++) {
    const id = `mon-${String(i).padStart(2, "0")}`;
    p.engine.combatants[id] = combatant(
      id,
      `Goblin Skirmisher ${"abcdefghijkl"[i]}`,
      {
        hp: { current: 7, max: 7, temp: 0 },
        ac: 15,
      },
    );
  }
  const ids = Object.keys(p.engine.combatants);
  p.engine.encounter = {
    round: 4,
    turnIndex: 0,
    order: ids.map((id, i) => ({ combatantId: id, total: 30 - i, bonus: 1 })),
  };
  p.encounter = {
    round: 4,
    turnIndex: 0,
    activeCombatantId: ids[0] as string,
    order: ids.map((id, i) => {
      const c = p.engine.combatants[id] as ReturnType<typeof combatant>;
      return {
        combatantId: id,
        name: c.name,
        initiative: 30 - i,
        hp: c.hp,
        lifeState: c.lifeState,
        conditions: c.conditions,
        characterId: null,
      };
    }),
  };
  p.tableMode = { mode: "turn", activeActor: "ai:dm", activeCharacterId: null };
  const tpl = clone(seed.npcs[0]);
  if (!tpl) throw new Error("no npc");
  s.npcs = Array.from({ length: npcs }, (_, i) => ({
    ...clone(tpl),
    id: `npc-${i}`,
    name: `Villager ${"abcdefghijklmnopqrst"[i]}`,
    identity: { ...tpl.identity, combatant: null },
  }));
  return { projections: p, seed: s };
}

describe("renderSnapshot: capacity", () => {
  it("fits the schema-maximum shape in every view, uncompressed", () => {
    const { projections, seed } = big(6, 12, 20);
    const snap = buildSnapshot(projections, seed);
    expect(snap.actors).toHaveLength(38);
    const measured: Record<string, number> = {};
    for (const opts of VIEWS) {
      const r = renderSnapshot(snap, opts);
      expect(r.ok ? "ok" : r.detail).toBe("ok");
      if (!r.ok) continue;
      measured[opts.view] = tokens(r.lines);
      expect(measured[opts.view]).toBeLessThanOrEqual(opts.cap);
      // uncompressed: no compressed line form appears
      expect(r.lines.filter((l) => /: (dead|absent|gone)$/.test(l))).toEqual(
        [],
      );
    }
    writeFileSync(
      process.env.MEASURE_OUT ?? "/dev/null",
      JSON.stringify(measured),
    );
  });
});

describe("renderSnapshot: compression", () => {
  it("compresses only the dead and shows all 50 actors exactly once", () => {
    const { projections, seed } = big(6, 24, 20);
    // 6 party + 24 combatants (goblins) + 20 NPCs = 50 actors; goblins die
    const p = clone(projections);
    for (const c of Object.values(p.engine.combatants)) {
      if (c.id.startsWith("mon-")) {
        c.hp = { current: 0, max: 7, temp: 0 };
        c.lifeState = "dead";
      }
    }
    const snap = buildSnapshot(p, seed);
    expect(snap.actors).toHaveLength(50);
    const uncompressed = renderSnapshot(snap, { view: "dm", cap: 1_000_000 });
    if (!uncompressed.ok) throw new Error("unexpected");
    // one token under the uncompressed total: only compression can make it fit
    const opts: RenderOptions = {
      view: "dm",
      cap: tokens(uncompressed.lines) - 1,
    };
    const r = renderSnapshot(snap, opts);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    for (const a of snap.actors) {
      const lines = r.lines.filter((l) => l.startsWith(`${a.id} "`));
      expect(lines, a.id).toHaveLength(1);
    }
    const deadLines = r.lines.filter((l) => l.includes("): dead"));
    expect(deadLines).toHaveLength(24);
    for (const l of deadLines)
      expect(l).toMatch(/^mon-\d\d "[^"]+" \(monster\): dead$/);
    // living actors keep their full line
    const tamsin = r.lines.find((l) => l.startsWith('pc-0 "'));
    expect(tamsin).toContain("HP 20/24");
    expect(tokens(r.lines)).toBeLessThanOrEqual(opts.cap);
  });

  it("compresses an absent actor, and dead plus absent", () => {
    const { projections, seed } = greyhollowFight();
    const snap = clone(buildSnapshot(projections, seed));
    const wenna = snap.actors.find((a) => a.id === "wenna");
    const goblin = snap.actors.find((a) => a.id === "goblin-3");
    if (!wenna || !goblin) throw new Error("missing");
    wenna.presence = "absent";
    goblin.presence = "absent";
    goblin.lifeState = "dead";
    const fullDm = renderSnapshot(snap, { view: "dm", cap: 1_000_000 });
    if (!fullDm.ok) throw new Error("unexpected");
    const r = renderSnapshot(snap, {
      view: "dm",
      cap: tokens(fullDm.lines) - 1,
    });
    if (!r.ok) throw new Error("overflow");
    expect(r.lines).toContain('wenna "Wenna Marsh" (npc): absent');
    expect(r.lines).toContain('goblin-3 "Goblin" (monster): dead, absent');
    const fullFic = renderSnapshot(snap, { view: "fiction", cap: 1_000_000 });
    if (!fullFic.ok) throw new Error("unexpected");
    const f = renderSnapshot(snap, {
      view: "fiction",
      cap: tokens(fullFic.lines) - 1,
    });
    if (!f.ok) throw new Error("overflow");
    expect(f.lines).toContain("Wenna Marsh (npc): gone");
    expect(f.lines).toContain("Goblin (monster): dead");
  });
});

describe("renderSnapshot: overflow", () => {
  it("returns ok false after compression, and snapshotSection throws", () => {
    const { projections, seed } = greyhollowFight();
    const snap = buildSnapshot(projections, seed);
    const r = renderSnapshot(snap, { view: "dm", cap: 100 });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.detail).toMatchObject({
      view: "dm",
      cap: 100,
      actors: 9,
      compressed: 0,
    });
    expect(r.detail.tokens).toBeGreaterThan(100);
    let err: unknown;
    try {
      snapshotSection("State", snap, { view: "dm", cap: 100 });
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(SnapshotOverflowError);
    expect((err as SnapshotOverflowError).code).toBe("SNAPSHOT_OVERFLOW");
    expect((err as SnapshotOverflowError).detail).toEqual(r.detail);
  });

  it("counts compressed actors in the overflow detail and never drops a line", () => {
    const { projections, seed } = greyhollowFight();
    const p = clone(projections);
    const g = p.engine.combatants["goblin-2"];
    if (g) {
      g.hp = { current: 0, max: 10, temp: 0 };
      g.lifeState = "dead";
    }
    const snap = buildSnapshot(p, seed);
    const r = renderSnapshot(snap, { view: "dm", cap: 100 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.detail.compressed).toBe(1);
  });

  it("returns a labelled section when it fits", () => {
    const { projections, seed } = greyhollowFight();
    const snap = buildSnapshot(projections, seed);
    const text = snapshotSection("State", snap, {
      view: "dm",
      cap: CAPS.snapshotDm,
    });
    expect(
      text.startsWith("## State\nTable mode: turn; active ai:dm (Snag)"),
    ).toBe(true);
  });
});

describe("renderSnapshot: views", () => {
  const { projections, seed } = greyhollowFight();
  const frightened = clone(projections);
  const mon = frightened.engine.combatants["goblin-2"];
  if (mon)
    mon.conditions = [
      condition("f1", "frightened"),
      condition("e1", "exhaustion", 2),
    ];
  const snap: ActorSnapshot = buildSnapshot(frightened, seed);

  it("dm view shows a monster's AC and condition", () => {
    const r = renderSnapshot(snap, { view: "dm", cap: CAPS.snapshotDm });
    if (!r.ok) throw new Error("overflow");
    const line = r.lines.find((l) => l.startsWith('goblin-2 "'));
    expect(line).toContain("AC 15");
    expect(line).toContain("frightened");
    expect(line).toContain("exhaustion 2");
    expect(line).toContain("init 10");
  });

  it("fiction view of the shipped seed holds no digit, no actor id and no DM-only text", () => {
    const r = renderSnapshot(snap, {
      view: "fiction",
      cap: CAPS.snapshotFiction,
    });
    if (!r.ok) throw new Error("overflow");
    const text = r.lines.join("\n");
    expect(text).not.toMatch(/\d/);
    for (const a of snap.actors) {
      // ids that equal the lowercase name are fine only if they are not tokens in the text
      if (a.id !== a.name.toLowerCase() && /[-\d]/.test(a.id))
        expect(text).not.toContain(a.id);
    }
    expect(text).not.toContain("goblin-2");
    for (const secret of dmOnlySeedText(seed))
      expect(text).not.toContain(secret);
    expect(text).toContain("frightened");
    expect(text).toContain("exhaustion");
    expect(text).toContain("Tamsin Vale (party, human player)");
    expect(text).toContain("Brother Odo (party, AI companion)");
    expect(text.startsWith("A fight is on. It is Snag's turn.")).toBe(true);
  });

  it("seat view shows no AC, resources or sheet for a non-party actor", () => {
    const r = renderSnapshot(snap, {
      view: "seat",
      cap: CAPS.snapshotSeat,
      self: "odo",
    });
    if (!r.ok) throw new Error("overflow");
    const gob = r.lines.find((l) => l.startsWith('goblin-2 "'));
    const snag = r.lines.find((l) => l.startsWith('snag "'));
    for (const l of [gob, snag]) {
      expect(l).toBeDefined();
      expect(l).not.toMatch(/AC |slots|hit dice|mods |attack /);
    }
    expect(gob).toContain("HP 10/10");
    const odo = r.lines.find((l) => l.startsWith('odo "'));
    expect(odo).toContain("AC 16");
    expect(odo).toContain("slots left");
    expect(odo).toContain("mods ");
  });

  it("trackers render only in the dm view, only when asked", () => {
    const advance = new Map([["dusk", "the sun sets"]]);
    const dmOn = renderSnapshot(snap, {
      view: "dm",
      cap: CAPS.snapshotDm,
      trackers: { advanceWhen: advance },
    });
    const dmOff = renderSnapshot(snap, { view: "dm", cap: CAPS.snapshotDm });
    if (!dmOn.ok || !dmOff.ok) throw new Error("overflow");
    expect(dmOn.lines).toContain(
      "Tracker dusk (Dusk) 2/6; advance when: the sun sets",
    );
    expect(dmOff.lines.join("\n")).not.toContain("Tracker");
    for (const view of ["seat", "fiction"] as const) {
      const r = renderSnapshot(snap, {
        view,
        cap: 5000,
        trackers: { advanceWhen: advance },
      });
      if (!r.ok) throw new Error("overflow");
      const text = r.lines.join("\n");
      expect(text).not.toContain("Tracker");
      expect(text).not.toContain("the sun sets");
      expect(text).not.toContain("Dusk");
    }
  });

  it("renders a free table without an encounter", () => {
    const p = clone(projections);
    p.tableMode = { mode: "free" };
    p.encounter = null;
    p.engine.encounter = null;
    const s = buildSnapshot(p, seed);
    const dm = renderSnapshot(s, { view: "dm", cap: CAPS.snapshotDm });
    const fic = renderSnapshot(s, {
      view: "fiction",
      cap: CAPS.snapshotFiction,
    });
    if (!dm.ok || !fic.ok) throw new Error("overflow");
    expect(dm.lines[0]).toBe("Table mode: free");
    expect(dm.lines.some((l) => l.startsWith("Encounter"))).toBe(false);
    expect(fic.lines[0]).toBe("No fight is on.");
  });
});
