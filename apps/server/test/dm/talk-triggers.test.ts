import {
  emptyProjections,
  type SessionProjections,
  type StoredEvent,
} from "@the-stacks/session-model";
import { describe, expect, it } from "vitest";
import { ReactOutput } from "../../src/dm/nodes/schemas.js";
import { buildSnapshot } from "../../src/dm/snapshot/build.js";
import {
  capReached,
  codeTriggers,
  companionOnly,
  isReadable,
  needsModel,
  TALK_CHAIN_CAP,
} from "../../src/dm/talk-triggers.js";
import { greyhollowDuo, PLAYER_USER } from "./snapshot-fixtures.js";

const talk = (over: Partial<StoredEvent> = {}, channel = "ic"): StoredEvent =>
  ({
    sessionId: "s",
    seq: 1,
    actor: PLAYER_USER,
    type: "talk",
    payload: { text: "hi", channel, characterId: "odo" },
    payloadVersion: 1,
    visibility: "public",
    ...over,
  }) as StoredEvent;

function aiFree(): SessionProjections {
  const p = emptyProjections({ role: "dm" });
  p.gate = { ...p.gate, seat: { kind: "ai" } } as typeof p.gate;
  p.tableMode = { mode: "free" };
  return p;
}

const entry = (seq: number, actor: string, kind: "talk" | "narration") =>
  kind === "talk"
    ? {
        seq,
        ts: "",
        actor,
        visibility: "public",
        kind,
        text: "x",
        channel: "ic" as const,
        characterId: null,
      }
    : {
        seq,
        ts: "",
        actor,
        visibility: "public",
        kind,
        text: "x",
        actionIds: [],
      };

describe("isReadable", () => {
  it("accepts public IC talk by a human under an AI seat in free mode", () => {
    expect(isReadable(talk(), aiFree())).toBe(true);
    expect(isReadable(talk({ actor: "ai:companion:odo" }), aiFree())).toBe(
      true,
    );
  });
  it("rejects each failing condition", () => {
    const p = aiFree();
    expect(isReadable(talk({}, "ooc"), p)).toBe(false);
    expect(isReadable(talk({ visibility: "whisper" }), p)).toBe(false);
    expect(isReadable(talk({ actor: "ai:dm" }), p)).toBe(false);
    expect(isReadable(talk({ type: "narration" }), p)).toBe(false);
    p.tableMode = { mode: "turn" } as typeof p.tableMode;
    expect(isReadable(talk(), p)).toBe(false);
    const human = aiFree();
    human.gate = {
      ...human.gate,
      seat: { kind: "human" },
    } as typeof human.gate;
    expect(isReadable(talk(), human)).toBe(false);
  });
});

describe("capReached", () => {
  it("counts DM narration since the latest human row", () => {
    const p = aiFree();
    expect(TALK_CHAIN_CAP).toBe(2);
    p.transcript = [entry(1, PLAYER_USER, "talk")];
    expect(capReached(p)).toBe(false);
    p.transcript.push(entry(2, "ai:dm", "narration"));
    expect(capReached(p)).toBe(false);
    p.transcript.push(entry(3, "ai:companion:odo", "talk"));
    p.transcript.push(entry(4, "ai:dm", "narration"));
    expect(capReached(p)).toBe(true);
    p.transcript.push(entry(5, PLAYER_USER, "talk"));
    expect(capReached(p)).toBe(false);
  });
});

describe("codeTriggers", () => {
  const { projections, seed } = greyhollowDuo();
  const snap = buildSnapshot(projections, seed);
  const kinds = (text: string) =>
    codeTriggers(text, snap, seed).map((t) => `${t.kind}:${t.actorId}`);

  it("Odo's run 2 line addresses Wenna", () => {
    const k = kinds("Wenna, who's missing from this house?");
    expect(k).toContain("addressed:wenna");
    expect(k).toContain("overheard:pell");
    expect(
      needsModel(codeTriggers("Wenna, who's missing?", snap, seed), "x"),
    ).toBe(true);
  });
  it("matches a role word as mentioned", () => {
    expect(kinds("I ask the ferry keeper for passage")).toContain(
      "mentioned:wenna",
    );
  });
  it("a shared role word mentions both NPCs", () => {
    const s2 = structuredClone(seed);
    for (const n of s2.npcs)
      if (n.id === "wenna" || n.id === "pell") n.identity.role = "ferry hand";
    const k = codeTriggers("any ferry about?", snap, s2).map(
      (t) => `${t.kind}:${t.actorId}`,
    );
    expect(k).toContain("mentioned:wenna");
    expect(k).toContain("mentioned:pell");
  });
  it("does not match inside a longer word", () => {
    expect(kinds("Pellucid water")).not.toContain("mentioned:pell");
  });
  it("drops dead and absent actors", () => {
    const dead = structuredClone(snap);
    for (const a of dead.actors) {
      if (a.id === "wenna") a.lifeState = "dead";
      if (a.id === "pell") a.presence = "absent";
    }
    const k = codeTriggers("Wenna, Pell?", dead, seed);
    expect(k.find((t) => t.actorId === "wenna")).toBeUndefined();
    expect(k.find((t) => t.actorId === "pell")).toBeUndefined();
  });
  it("companion addressed only", () => {
    const t = codeTriggers("Odo, what do you think?", snap, seed);
    expect(t.find((x) => x.actorId === "odo")?.kind).toBe("addressed");
    expect(companionOnly(t)).toBe(true);
    expect(companionOnly(codeTriggers("Wenna, hello", snap, seed))).toBe(false);
  });
});

describe("needsModel", () => {
  it("is false with no named NPC and no question mark", () => {
    const { projections, seed } = greyhollowDuo();
    const snap = buildSnapshot(projections, seed);
    const text = "we should move on";
    expect(needsModel(codeTriggers(text, snap, seed), text)).toBe(false);
    expect(needsModel(codeTriggers("shall we?", snap, seed), "shall we?")).toBe(
      true,
    );
  });
});

describe("ReactOutput", () => {
  const base = {
    outcome: "scene",
    triggers: [],
    speaker: null,
    text: "x",
    encounterId: null,
    companionPrompts: [],
    reason: "r",
  };
  it("refines each outcome", () => {
    expect(ReactOutput.safeParse(base).success).toBe(true);
    expect(ReactOutput.safeParse({ ...base, outcome: "reply" }).success).toBe(
      false,
    );
    expect(
      ReactOutput.safeParse({ ...base, outcome: "reply", speaker: "wenna" })
        .success,
    ).toBe(true);
    expect(
      ReactOutput.safeParse({ ...base, outcome: "escalate" }).success,
    ).toBe(false);
    expect(
      ReactOutput.safeParse({
        ...base,
        outcome: "escalate",
        encounterId: "reed-camp",
      }).success,
    ).toBe(true);
    expect(ReactOutput.safeParse({ ...base, outcome: "none" }).success).toBe(
      false,
    );
    expect(
      ReactOutput.safeParse({ ...base, outcome: "none", text: "" }).success,
    ).toBe(true);
  });
});
