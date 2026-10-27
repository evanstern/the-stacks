import { EngineEventSchema } from "@the-stacks/dnd5e-engine";
import { describe, expect, it } from "vitest";
import {
  catalog,
  catalogEntry,
  currentVersion,
  MECHANICS_EVENT_TYPES,
  SESSION_EVENT_TYPES,
} from "../src/index.js";
import {
  engineExamples,
  envelope,
  invalidSessionPayloads,
  sessionPayloads,
} from "./helpers.js";

const examples = engineExamples();

describe("catalog shape", () => {
  it("has 17 session entries and 18 mechanics entries", () => {
    expect(SESSION_EVENT_TYPES).toHaveLength(17);
    expect(MECHANICS_EVENT_TYPES).toHaveLength(18);
    expect(catalog).toHaveLength(35);
  });

  it("catalogues the five gate types at version 1 with their kinds and visibility", () => {
    const expected: Record<string, [string, string]> = {
      "proposal.created": ["proposal", "dm-only"],
      "proposal.approved": ["proposal", "dm-only"],
      "proposal.rejected": ["proposal", "dm-only"],
      "dm.seat.changed": ["state-change", "any"],
      "gate.policy.changed": ["state-change", "any"],
    };
    for (const [type, [kind, visibility]] of Object.entries(expected)) {
      const entry = catalogEntry(type, 1);
      expect(entry?.kind).toBe(kind);
      expect(entry?.visibility).toBe(visibility);
      expect(entry?.current).toBe(true);
      expect(SESSION_EVENT_TYPES).toContain(type);
    }
  });

  it("derives mechanics types from the engine schema", () => {
    const fromSchema = EngineEventSchema.options.map(
      (o) => (o.shape.type as unknown as { value: string }).value,
    );
    expect([...MECHANICS_EVENT_TYPES]).toEqual(fromSchema);
  });

  it("keeps session-native and engine type sets disjoint", () => {
    const engine = new Set(MECHANICS_EVENT_TYPES);
    expect(SESSION_EVENT_TYPES.filter((t) => engine.has(t))).toEqual([]);
  });

  it("has unique (type, version) pairs and exactly one current per type", () => {
    const pairs = catalog.map((e) => `${e.type}@${e.version}`);
    expect(new Set(pairs).size).toBe(pairs.length);
    for (const type of new Set(catalog.map((e) => e.type))) {
      expect(catalog.filter((e) => e.type === type && e.current)).toHaveLength(
        1,
      );
      expect(currentVersion(type)).toBeDefined();
    }
  });

  it("looks entries up by type and version", () => {
    expect(catalogEntry("talk", 1)?.kind).toBe("talk");
    expect(catalogEntry("talk", 2)).toBeUndefined();
    expect(catalogEntry("nope", 1)).toBeUndefined();
    expect(currentVersion("nope")).toBeUndefined();
  });

  it("marks tracker.changed and proposal.* dm-only and everything else any", () => {
    for (const entry of catalog) {
      const dmOnly =
        entry.type === "tracker.changed" || entry.type.startsWith("proposal.");
      expect(entry.visibility).toBe(dmOnly ? "dm-only" : "any");
    }
  });

  it("classifies engine marker and state-change kinds", () => {
    const markers = catalog
      .filter((e) => e.kind === "marker")
      .map((e) => e.type);
    expect(markers.sort()).toEqual(
      [
        "attack.resolved",
        "check.resolved",
        "dice.rolled",
        "rest.completed",
      ].sort(),
    );
  });
});

describe("session payload schemas", () => {
  for (const type of SESSION_EVENT_TYPES) {
    const entry = catalogEntry(type, 1);
    it(`${type}: accepts a valid payload`, () => {
      expect(entry?.schema.safeParse(sessionPayloads[type]).success).toBe(true);
    });
    it(`${type}: rejects invalid payloads`, () => {
      const invalid = invalidSessionPayloads[type] ?? [];
      expect(invalid.length).toBeGreaterThan(0);
      for (const payload of invalid) {
        expect(entry?.schema.safeParse(payload).success).toBe(false);
      }
    });
  }

  it("accepts an approve stance with empty text and a party action without a character", () => {
    expect(
      catalogEntry("action.commented", 1)?.schema.safeParse({
        actionId: "act-1",
        stance: "approve",
        text: "",
      }).success,
    ).toBe(true);
    expect(
      catalogEntry("action.declared", 1)?.schema.safeParse({
        actionId: "act-1",
        characterId: null,
        scope: "party",
        text: "We rest.",
      }).success,
    ).toBe(true);
  });

  it("accepts the other resolved outcomes", () => {
    const schema = catalogEntry("action.resolved", 1)?.schema;
    expect(
      schema?.safeParse({
        actionId: "a",
        outcome: "refused",
        batchIds: [],
        refusalCode: "NOT_DYING",
      }).success,
    ).toBe(true);
    expect(
      schema?.safeParse({
        actionId: "a",
        outcome: "no-effect",
        batchIds: [],
        refusalCode: null,
      }).success,
    ).toBe(true);
  });
});

describe("mechanics envelope", () => {
  for (const type of MECHANICS_EVENT_TYPES) {
    const entry = catalogEntry(type, 1);
    it(`${type}: accepts an enveloped engine event`, () => {
      expect(examples[type]).toBeDefined();
      expect(
        entry?.schema.safeParse(envelope(examples[type] as never)).success,
      ).toBe(true);
    });
  }

  it("rejects index >= count, an empty batch and a malformed engine event", () => {
    const schema = catalogEntry("dice.rolled", 1)?.schema;
    const event = examples["dice.rolled"] as never;
    expect(
      schema?.safeParse(envelope(event, { index: 1, count: 1 })).success,
    ).toBe(false);
    expect(schema?.safeParse(envelope(event, { count: 0 })).success).toBe(
      false,
    );
    expect(schema?.safeParse(envelope(event, { count: 501 })).success).toBe(
      false,
    );
    expect(
      schema?.safeParse(envelope({ ...(event as object), total: "x" } as never))
        .success,
    ).toBe(false);
  });
});

describe("AC #6: reason, before and after are required", () => {
  function without(obj: unknown, key: string): unknown {
    const copy = { ...(obj as Record<string, unknown>) };
    delete copy[key];
    return copy;
  }

  for (const entry of catalog.filter(
    (e) => e.kind === "state-change" && !MECHANICS_EVENT_TYPES.includes(e.type),
  )) {
    for (const key of ["reason", "before", "after"]) {
      it(`${entry.type} fails without ${key}`, () => {
        expect(
          entry.schema.safeParse(sessionPayloads[entry.type]).success,
        ).toBe(true);
        expect(
          entry.schema.safeParse(without(sessionPayloads[entry.type], key))
            .success,
        ).toBe(false);
      });
    }
  }

  for (const entry of catalog.filter((e) =>
    MECHANICS_EVENT_TYPES.includes(e.type),
  )) {
    const keys =
      entry.kind === "marker" ? ["reason"] : ["reason", "before", "after"];
    for (const key of keys) {
      it(`${entry.type} (${entry.kind}) fails without event.${key}`, () => {
        const event = examples[entry.type] as never;
        expect(entry.schema.safeParse(envelope(event)).success).toBe(true);
        expect(
          entry.schema.safeParse(envelope(without(event, key) as never))
            .success,
        ).toBe(false);
      });
    }
  }
});
