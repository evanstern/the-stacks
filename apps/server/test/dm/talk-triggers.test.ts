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

/** A free-mode AI-seat table holding one `say` Intent at seq 2 (its `talk` row is seq 1). */
function aiFree(): SessionProjections {
  const p = emptyProjections({ role: "dm" });
  p.gate = { ...p.gate, seat: { kind: "ai" } } as typeof p.gate;
  p.tableMode = { mode: "free" };
  return p;
}

const sayIntent = (
  p: SessionProjections,
  kind: "say" | "ooc" | "ask_dm" | "hide",
  over: { actor?: string; id?: string } = {},
): SessionProjections => {
  const seq = p.intents.length * 2 + 2;
  const actor = over.actor ?? PLAYER_USER;
  p.transcript.push({
    seq: seq - 1,
    ts: "2026-11-11T00:00:00.000Z",
    actor,
    visibility: "public",
    kind: "talk",
    text: "hi",
    channel: kind === "ooc" || kind === "ask_dm" ? "ooc" : "ic",
    characterId: "odo",
  } as never);
  p.intents.push({
    id: over.id ?? `i-${seq}`,
    seq,
    ts: "2026-11-11T00:00:00.000Z",
    actor,
    intent: {
      id: over.id ?? `i-${seq}`,
      kind,
      actor: { kind: "pc", id: "tamsin" },
      targets: [],
      params: {},
      text: "hi",
      source: "composer",
      commit: "declared",
    },
    status: kind === "hide" ? "declared" : "settled",
    request: null,
    batchIds: [],
    proposalId: null,
  } as never);
  return p;
};

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

describe("isReadable (spec 066: delegates to readablePosts)", () => {
  it("accepts a say Intent by a human under an AI seat in free mode", () => {
    const p = sayIntent(aiFree(), "say");
    expect(isReadable({ seq: 1 }, p)).toBe(true);
  });
  it("ignores ooc, a turn-mode table and a human seat", () => {
    expect(isReadable({ seq: 1 }, sayIntent(aiFree(), "ooc"))).toBe(false);
    const turn = sayIntent(aiFree(), "say");
    turn.tableMode = { mode: "turn" } as typeof turn.tableMode;
    expect(isReadable({ seq: 1 }, turn)).toBe(false);
    const human = sayIntent(aiFree(), "say");
    human.gate = {
      ...human.gate,
      seat: { kind: "human" },
    } as typeof human.gate;
    expect(isReadable({ seq: 1 }, human)).toBe(false);
  });
  it("reads an ask_dm in turn mode and a declared hide (rule 2)", () => {
    const ask = sayIntent(aiFree(), "ask_dm");
    ask.tableMode = { mode: "turn" } as typeof ask.tableMode;
    expect(isReadable({ seq: 1 }, ask)).toBe(true);
    expect(isReadable({ seq: 1 }, sayIntent(aiFree(), "hide"))).toBe(true);
  });
  it("a legacy companion talk row stays readable (rule 4)", () => {
    const p = aiFree();
    p.transcript.push({
      seq: 1,
      ts: "t",
      actor: "ai:companion:odo",
      visibility: "public",
      kind: "talk",
      text: "hi",
      channel: "ic",
      characterId: "odo",
    } as never);
    expect(isReadable({ seq: 1 }, p)).toBe(true);
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
  it("resets at a human Intent that has no transcript row", () => {
    const p = aiFree();
    p.transcript = [
      entry(1, "ai:dm", "narration"),
      entry(2, "ai:dm", "narration"),
    ];
    expect(capReached(p)).toBe(true);
    p.intents.push({ seq: 3, actor: PLAYER_USER } as never);
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

describe("needsModel (spec 066 FR-010)", () => {
  const post = (rule: 1 | 2 | 3 | 4, actor = PLAYER_USER) => ({
    seq: 1,
    ts: "t",
    actor,
    rule,
    intentId: null,
    text: "x",
  });
  it("calls the model for a human rule 1, 3 or 4 post", () => {
    expect(needsModel([post(1)])).toBe(true);
    expect(needsModel([post(3)])).toBe(true);
    expect(needsModel([post(4)])).toBe(true);
  });
  it("makes no call for rule 2 posts only", () => {
    expect(needsModel([post(2)])).toBe(false);
    expect(needsModel([post(2), post(2)])).toBe(false);
  });
  it("makes no call for a companion-only read", () => {
    expect(needsModel([post(1, "ai:companion:odo")])).toBe(false);
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
  const body = { kind: "hide", targets: [], params: {} };
  it("refines confirm and answer (spec 066)", () => {
    const confirm = {
      ...base,
      outcome: "confirm",
      text: "",
      confirm: [{ characterId: "kestrel", text: "Kestrel hides", body }],
    };
    expect(ReactOutput.safeParse(confirm).success).toBe(true);
    expect(ReactOutput.safeParse({ ...confirm, confirm: [] }).success).toBe(
      false,
    );
    expect(ReactOutput.safeParse({ ...confirm, text: "x" }).success).toBe(
      false,
    );
    expect(
      ReactOutput.safeParse({ ...base, confirm: confirm.confirm }).success,
    ).toBe(false);
    // a null characterId is only for a party attempt
    expect(
      ReactOutput.safeParse({
        ...confirm,
        confirm: [{ characterId: null, text: "x", body }],
      }).success,
    ).toBe(false);
    expect(
      ReactOutput.safeParse({
        ...confirm,
        confirm: [
          {
            characterId: null,
            text: "The party climbs",
            body: {
              kind: "attempt",
              targets: [],
              params: { scope: "party" },
              text: "climb",
            },
          },
        ],
      }).success,
    ).toBe(true);
    expect(
      ReactOutput.safeParse({ ...base, answer: "It is high." }).success,
    ).toBe(true);
  });
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
