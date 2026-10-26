import { execute, scriptedRng } from "@the-stacks/dnd5e-engine";
import { describe, expect, it } from "vitest";
import {
  fixtureIds,
  fixtures,
  freeModeAction,
  recipes,
  type SessionFixture,
  secretTracker,
  talkOnly,
  turnModeCombat,
  unknownAndInvalid,
} from "../src/fixtures/index.js";
import {
  type Diagnostics,
  decodeEvent,
  emptyProjections,
  project,
  type SessionProjections,
  type StoredEvent,
  StoredEventSchema,
  type Viewer,
} from "../src/index.js";

const dm: Viewer = { role: "dm" };
const ana: Viewer = { role: "player", userId: fixtureIds.playerUserId };
const other: Viewer = { role: "player", userId: fixtureIds.otherPlayerUserId };

function viewersOf(f: SessionFixture): Viewer[] {
  return [f.viewers.dm, ...f.viewers.players];
}

function foldUpTo(f: SessionFixture, seqExclusive: number): SessionProjections {
  return project(
    f.events.filter((e) => e.seq < seqExclusive),
    dm,
  );
}

const cleanDiagnostics: Diagnostics = emptyProjections(dm).diagnostics;

describe("fixture identity (guarantee 2)", () => {
  it("has the five contract fixtures with unique names and session ids", () => {
    expect(fixtures.map((f) => f.name)).toEqual([
      "talk-only",
      "free-mode-action",
      "turn-mode-combat",
      "secret-tracker",
      "unknown-and-invalid",
    ]);
    expect(new Set(fixtures.map((f) => f.name)).size).toBe(5);
    expect(new Set(fixtures.map((f) => f.sessionId)).size).toBe(5);
    for (const f of fixtures) {
      expect(f.name).toMatch(/^[a-z]+(-[a-z]+)*$/);
      expect(f.description.length).toBeGreaterThan(40);
      expect(f.viewers.dm).toEqual({ role: "dm" });
      expect(f.viewers.players.length).toBeGreaterThan(0);
    }
  });

  it("exports the fixed identities", () => {
    expect(fixtureIds).toEqual({
      playerUserId: "00000000-0000-4000-8000-000000000001",
      otherPlayerUserId: "00000000-0000-4000-8000-000000000002",
      dmActor: "ai:dm",
      companionActor: "ai:companion:bram",
    });
  });

  for (const f of fixtures) {
    it(`${f.name}: rows are valid, ascending from 1 and stamped one second apart`, () => {
      const seqs = f.events.map((e) => e.seq);
      const strictlyAscending = f.name !== "unknown-and-invalid";
      let max = 0;
      for (const [i, e] of f.events.entries()) {
        expect(StoredEventSchema.safeParse(e).success).toBe(true);
        expect(e.sessionId).toBe(f.sessionId);
        expect(e.ts).toBe(
          new Date(Date.UTC(2026, 9, 26, 18, 0, e.seq)).toISOString(),
        );
        if (e.seq > max) {
          expect(e.seq).toBe(max + 1);
          max = e.seq;
        } else {
          expect(strictlyAscending).toBe(false);
        }
        expect(i).toBeLessThan(seqs.length);
      }
      expect(seqs[0]).toBe(1);
    });
  }

  it("unknown-and-invalid holds exactly one deliberate duplicate seq", () => {
    const seqs = unknownAndInvalid.events.map((e) => e.seq);
    expect(seqs.length - new Set(seqs).size).toBe(1);
  });
});

describe("every event decodes (guarantee 1)", () => {
  for (const f of fixtures.filter((x) => x.name !== "unknown-and-invalid")) {
    it(`${f.name}: every event is known`, () => {
      for (const e of f.events) {
        expect(decodeEvent(e).status, `${f.name} seq ${e.seq} ${e.type}`).toBe(
          "known",
        );
      }
    });
  }
});

describe("recipes regenerate the recorded batches (guarantee 3)", () => {
  it("lists a recipe for every mechanics batch and nothing else", () => {
    for (const f of fixtures) {
      const batchIds = new Set(
        f.events
          .map((e) => (e.payload as { batchId?: string } | null)?.batchId)
          .filter((b): b is string => typeof b === "string"),
      );
      const mine = recipes
        .filter((r) => r.fixture === f.name)
        .filter((r) => r.refusal === undefined)
        .map((r) => r.batchId);
      if (f.name === "unknown-and-invalid") {
        expect(mine).toEqual([]);
        continue;
      }
      expect(new Set(mine)).toEqual(batchIds);
    }
  });

  for (const recipe of recipes) {
    it(`${recipe.fixture} / ${recipe.batchId}`, () => {
      const f = fixtures.find(
        (x) => x.name === recipe.fixture,
      ) as SessionFixture;
      expect(f).toBeDefined();
      const rows = f.events.filter(
        (e) => (e.payload as { batchId?: string }).batchId === recipe.batchId,
      );
      const rng = scriptedRng(recipe.faces);

      if (recipe.refusal !== undefined) {
        // The refused command has no rows; the state is the fold just before the
        // action.resolved row that records the refusal code.
        const resolved = f.events.find(
          (e) =>
            e.type === "action.resolved" &&
            (e.payload as { refusalCode: string | null }).refusalCode ===
              recipe.refusal,
        ) as StoredEvent;
        expect(resolved).toBeDefined();
        expect(rows).toEqual([]);
        const result = execute(
          foldUpTo(f, resolved.seq).engine,
          recipe.command,
          rng,
        );
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.refusal.code).toBe(recipe.refusal);
        return;
      }

      expect(rows.length).toBeGreaterThan(0);
      const first = rows[0] as StoredEvent;
      const result = execute(
        foldUpTo(f, first.seq).engine,
        recipe.command,
        rng,
      );
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(rng.remaining()).toBe(0);
      expect(rows.map((r) => (r.payload as { event: unknown }).event)).toEqual(
        result.events,
      );
      // The rows are consecutive and in index order.
      rows.forEach((r, i) => {
        expect(r.seq).toBe(first.seq + i);
        expect((r.payload as { index: number }).index).toBe(i);
        expect((r.payload as { count: number }).count).toBe(rows.length);
      });
    });
  }
});

describe("fixture facts (guarantee 4)", () => {
  it("talk-only: transcript lengths per viewer, every other projection empty (AC #2)", () => {
    expect(project(talkOnly.events, dm).transcript).toHaveLength(6);
    expect(project(talkOnly.events, ana).transcript).toHaveLength(5);
    expect(project(talkOnly.events, other).transcript).toHaveLength(6);
    for (const viewer of viewersOf(talkOnly)) {
      const p = project(talkOnly.events, viewer);
      const { transcript: _t, throughSeq: _s, ...rest } = p;
      const {
        transcript: _et,
        throughSeq: _es,
        ...emptyRest
      } = emptyProjections(viewer);
      expect(rest).toEqual(emptyRest);
    }
    expect(
      project(talkOnly.events, ana).transcript.some((t) =>
        t.kind === "talk" ? t.text.includes("scratch near the hinge") : false,
      ),
    ).toBe(false);
  });

  it("free-mode-action: action sequence, ledger, scene, party and journal (AC #1, #4, #6)", () => {
    const f = freeModeAction;
    const seqOf = (type: string) =>
      (f.events.find((e) => e.type === type) as StoredEvent).seq;
    const statusAfter = (type: string) =>
      foldUpTo(f, seqOf(type) + 1).actions.map((a) => a.status);
    expect(statusAfter("action.declared")).toEqual(["declared"]);
    expect(statusAfter("action.commented")).toEqual(["discussed"]);
    expect(statusAfter("action.committed")).toEqual(["committed"]);
    expect(statusAfter("action.resolved")).toEqual(["resolved"]);

    for (const viewer of viewersOf(f)) {
      const p = project(f.events, viewer);
      expect(p.diagnostics).toEqual(cleanDiagnostics);
      expect(p.scene?.title).toBe("The vault door");
      expect(p.journal.map((j) => j.entryId)).toEqual(["j-vault"]);
      expect(p.actions).toHaveLength(1);
      expect(p.actions[0]?.committed?.authority).toBe("declarer");
      expect(p.actions[0]?.resolved?.outcome).toBe("applied");
      expect(p.ledger.filter((l) => l.kind === "roll")).toHaveLength(1);
      expect(p.ledger.filter((l) => l.kind === "outcome")).toHaveLength(1);
      expect(
        p.ledger.filter(
          (l) => l.kind === "change" && l.type === "combatant.added",
        ),
      ).toHaveLength(2);
      expect(p.party.map((m) => m.name)).toEqual(["Ana", "Bram"]);
      expect(p.party.map((m) => m.combatant?.hp)).toEqual([
        { current: 12, max: 12, temp: 0 },
        { current: 10, max: 10, temp: 0 },
      ]);
    }
  });

  it("turn-mode-combat: table mode, encounter, goblin HP and the refusal (AC #3, #4, #6)", () => {
    const f = turnModeCombat;
    const modeRows = f.events.filter((e) => e.type === "table-mode.changed");
    expect(modeRows).toHaveLength(3);
    const modes = modeRows.map((e) => foldUpTo(f, e.seq + 1).tableMode);
    expect(modes).toEqual([
      {
        mode: "turn",
        activeActor: fixtureIds.playerUserId,
        activeCharacterId: "ana",
      },
      {
        mode: "turn",
        activeActor: fixtureIds.companionActor,
        activeCharacterId: "bram",
      },
      { mode: "free" },
    ]);

    const encounterAt = (type: string) =>
      foldUpTo(
        f,
        (f.events.find((e) => e.type === type) as StoredEvent).seq + 1,
      ).encounter;
    const started = encounterAt("encounter.started");
    expect(started?.round).toBe(1);
    expect(started?.order.map((o) => o.combatantId)).toEqual([
      "ana",
      "bram",
      "goblin",
    ]);
    expect(started?.activeCombatantId).toBe("ana");
    expect(started?.order.map((o) => o.characterId)).toEqual([
      "ana",
      "bram",
      null,
    ]);
    expect(encounterAt("turn.advanced")?.activeCombatantId).toBe("bram");

    for (const viewer of viewersOf(f)) {
      const p = project(f.events, viewer);
      expect(p.diagnostics).toEqual(cleanDiagnostics);
      expect(p.encounter).toBeNull();
      expect(p.tableMode).toEqual({ mode: "free" });
      const goblinHp = p.ledger.filter(
        (l) =>
          l.kind === "change" &&
          l.type === "hp.changed" &&
          l.subject === "goblin",
      );
      expect(goblinHp).toHaveLength(1);
      const hp = goblinHp[0] as {
        before: { current: number };
        after: { current: number };
      };
      expect(hp.before.current).toBe(7);
      expect(hp.after.current).toBe(2);
      const refused = p.actions.find((a) => a.actionId === "act-bram-attack");
      expect(refused?.resolved).toMatchObject({
        outcome: "refused",
        refusalCode: "D20_TERM_REQUIRED",
        batchIds: [],
      });
      const applied = p.actions.find((a) => a.actionId === "act-ana-attack");
      expect(applied?.resolved?.outcome).toBe("applied");
    }
  });

  it("secret-tracker: the DM sees the secrets and players see none of them (AC #5)", () => {
    const f = secretTracker;
    const d = project(f.events, dm);
    expect(d.trackers).toHaveLength(1);
    expect(d.trackers[0]).toMatchObject({
      trackerId: "ritual",
      filled: 2,
      segments: 6,
    });
    expect(
      d.ledger.some((l) => l.kind === "roll" && l.visibility === "dm"),
    ).toBe(true);
    expect(d.journal.map((j) => j.title)).toEqual(["Cult plans"]);
    expect(d.diagnostics).toEqual(cleanDiagnostics);

    const secrets = [
      "ritual",
      "The cult completes the ritual",
      "three more nights",
      "Cult scout hides",
      "Cult plans",
      "alarm bell",
    ];
    for (const viewer of f.viewers.players) {
      const p = project(f.events, viewer);
      expect(p.trackers).toEqual([]);
      const json = JSON.stringify(p);
      for (const secret of secrets) expect(json).not.toContain(secret);
      expect(p.journal).toEqual([]);
      expect(p.ledger.every((l) => l.visibility === "public")).toBe(true);
      expect(p.diagnostics).toEqual(cleanDiagnostics);
    }
  });

  it("unknown-and-invalid: the fold returns, counters match, only valid talk remains (AC #8)", () => {
    for (const viewer of viewersOf(unknownAndInvalid)) {
      const p = project(unknownAndInvalid.events, viewer);
      expect(p.diagnostics).toEqual({
        ...cleanDiagnostics,
        skippedUnknownType: 2,
        skippedUnknownVersion: 1,
        skippedInvalid: 2,
        outOfOrder: 1,
      });
      expect(p.transcript).toHaveLength(1);
      expect(p.transcript[0]).toMatchObject({ kind: "talk", seq: 1 });
      expect(p.ledger).toEqual([]);
    }
  });
});

describe("fixtures are plain data (guarantee 5)", () => {
  it("serializes to JSON without loss", () => {
    for (const f of fixtures) {
      expect(JSON.parse(JSON.stringify(f))).toEqual(f);
    }
    expect(JSON.parse(JSON.stringify(recipes))).toEqual(recipes);
  });
});
