import { describe, expect, it } from "vitest";
import { buildSnapshot } from "../../src/dm/snapshot/index.js";
import { knownTargets, normalizeReact } from "../../src/dm/talk-turn.js";
import { greyhollowDuo } from "./snapshot-fixtures.js";

/** Spec 114 SC-003: the confirm target repair, pure. */
const known = [
  { kind: "zone" as const, id: "ferry-house", name: "Ferry House" },
  { kind: "actor" as const, id: "wenna", name: "Wenna" },
  { kind: "zone" as const, id: "twin", name: "Twin zone" },
  { kind: "actor" as const, id: "twin", name: "Twin actor" },
];
const reply = (targets: unknown[]) => ({
  outcome: "confirm",
  confirm: [
    { characterId: "tamsin", text: "t", body: { kind: "search", targets } },
  ],
});
const targetsOf = (r: { json: unknown }) =>
  (r.json as { confirm: { body: { targets: unknown[] } }[] }).confirm[0]?.body
    .targets;

describe("normalizeReact (spec 114 D2)", () => {
  it("repairs a bare string (attempt 1 shape)", () => {
    const r = normalizeReact(reply(["ferry-house"]), known);
    expect(targetsOf(r)).toEqual([{ kind: "zone", id: "ferry-house" }]);
    expect(r.repairs).toBe(1);
  });

  it("repairs an id-only object (attempt 2 shape) and an actor", () => {
    const r = normalizeReact(reply([{ id: "ferry-house" }, "wenna"]), known);
    expect(targetsOf(r)).toEqual([
      { kind: "zone", id: "ferry-house" },
      { kind: "actor", id: "wenna" },
    ]);
    expect(r.repairs).toBe(2);
  });

  it("leaves unknown, ambiguous, complete and odd entries alone", () => {
    const input = reply([
      "mill",
      "twin",
      { kind: "zone", id: "x" },
      { id: "wenna", extra: 1 },
      7,
    ]);
    const r = normalizeReact(input, known);
    expect(r.json).toEqual(input);
    expect(r.repairs).toBe(0);
  });

  it("matches ids case-sensitively", () => {
    expect(normalizeReact(reply(["Ferry-House"]), known).repairs).toBe(0);
  });

  it("passes through a non-object, a reply with no confirm array, and a body with no targets", () => {
    expect(normalizeReact("x", known)).toEqual({ json: "x", repairs: 0 });
    const noConfirm = { outcome: "none" };
    expect(normalizeReact(noConfirm, known).json).toBe(noConfirm);
    const noTargets = { confirm: [{ body: { kind: "hide" } }, null] };
    expect(normalizeReact(noTargets, known).json).toEqual(noTargets);
  });

  it("does not mutate its input", () => {
    const input = reply(["ferry-house"]);
    const copy = structuredClone(input);
    normalizeReact(input, known);
    expect(input).toEqual(copy);
  });

  it("knownTargets lists revealed zones then present actors", () => {
    const { projections, seed } = greyhollowDuo();
    const snap = buildSnapshot(projections, seed);
    snap.stage.zones = [
      { id: "a", name: "A", kind: "room", revealed: true },
      { id: "b", name: "B", kind: "room", revealed: false },
    ];
    const t = knownTargets(snap);
    expect(t.filter((x) => x.kind === "zone").map((x) => x.id)).toEqual(["a"]);
    expect(t.some((x) => x.kind === "actor" && x.id === "wenna")).toBe(true);
    expect(t.findIndex((x) => x.kind === "actor")).toBeGreaterThan(0);
  });
});
