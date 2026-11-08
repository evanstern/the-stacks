import { describe, expect, it } from "vitest";
import { INVALID } from "../src/fixtures/index.js";
import {
  type ActorRef,
  IntentRefusalCodeSchema,
  parse,
  toText,
} from "../src/index.js";
import type { IntentRefusalCode } from "../src/refusals.js";

const pc: ActorRef = { kind: "pc", id: "thorin" };
const ctx = (actor: ActorRef = pc) => ({
  id: "i-1",
  actor,
  source: "composer" as const,
  commit: "confirmed" as const,
});
const dm: ActorRef = { kind: "dm" };
const ok = (s: string, actor?: ActorRef) => {
  const r = parse(s, ctx(actor));
  if (!r.ok) throw new Error(`${s}: ${r.refusal.code} ${r.refusal.message}`);
  return r.intent;
};
const code = (s: string, actor?: ActorRef) => {
  const r = parse(s, ctx(actor));
  return r.ok ? "OK" : r.refusal.code;
};

describe("parse refusal fixtures", () => {
  for (const f of INVALID.filter((x) => x.text !== undefined))
    it(`${f.code}: ${f.name}`, () => {
      const r = parse(f.text as string, ctx(f.actor));
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.refusal.code).toBe(f.code);
    });

  it("every parse and schema code has a text fixture", () => {
    const want: IntentRefusalCode[] = IntentRefusalCodeSchema.options.slice(
      0,
      9,
    );
    for (const c of want)
      if (c !== "INTENT_CHANNEL_MISMATCH")
        expect(
          INVALID.some((f) => f.code === c && f.text !== undefined),
          c,
        ).toBe(true);
  });
});

describe("edge cases (spec Edge Cases)", () => {
  it("a sigil-leading body is speech through /say", () => {
    const i = ok("/say @home is where the heart is");
    expect(i.kind).toBe("say");
    expect(i.text).toBe("@home is where the heart is");
    expect(toText(i)).toBe("/say @home is where the heart is");
  });
  it("a quoted weapon name with a space", () => {
    const i = ok('/attack @goblin-2 with "light crossbow"');
    expect(i.params).toMatchObject({ weapon: "light crossbow" });
    expect(toText(i)).toBe('/attack @goblin-2 with "light crossbow"');
  });
  it("a body with )) inside closes at the last ))", () => {
    const i = ok('((he said "))" twice))');
    expect(i.kind).toBe("ooc");
    expect(i.text).toBe('he said "))" twice');
  });
  it("unclosed (( or quote", () => {
    expect(code("((oops")).toBe("PARSE_UNCLOSED");
    expect(code('"oops')).toBe("PARSE_UNCLOSED");
  });
  it("an empty /w recipient list", () => {
    expect(code("/w")).toBe("PARSE_MISSING_ARGUMENT");
  });
  it("nested ready / predeclare", () => {
    expect(code('/ready "t" /ready "u" /dash')).toBe("INTENT_SCHEMA");
    expect(code("/next /next /dash")).toBe("INTENT_SCHEMA");
  });
  it("a 4001-character body", () => {
    expect(code("x".repeat(4001))).toBe("INTENT_SCHEMA");
    expect(code("x".repeat(4000))).toBe("OK");
  });
  it("an unserved kind parses (the planner refuses it later)", () => {
    expect(ok("/dodge").kind).toBe("dodge");
  });
});

describe("aliases and rules (contract §8)", () => {
  it("aliases parse; toText emits the canonical form", () => {
    const pairs: [string, string][] = [
      ['"hello"', "hello"],
      ["*bows*", "/me bows"],
      ["/ooc brb", "((brb))"],
      ["/attack crossbow @g-1", "/attack @g-1 with crossbow"],
      ["/use-object &lever", "/utilize &lever"],
      ["/end-turn", "/end"],
      ["/predeclare /dodge", "/next /dodge"],
      ["/ATTACK @g-1 WITH sword +ADV", "/attack @g-1 with sword +adv"],
    ];
    for (const [alias, canon] of pairs) expect(toText(ok(alias))).toBe(canon);
    expect(toText(ok("/resume", dm))).toBe("/pause off");
  });
  it("plain text is say; @dm is ask_dm; @id is say_to", () => {
    expect(ok("hello there").kind).toBe("say");
    expect(ok("@dm may I?").kind).toBe("ask_dm");
    expect(ok("@innkeeper a room").kind).toBe("say_to");
  });
  it("unknown verbs are never speech", () => {
    expect(code("/frobnicate")).toBe("PARSE_UNKNOWN_VERB");
  });
  it("whitespace outside quotes collapses; bodies keep it", () => {
    expect(toText(ok("  /save   dex   dc=14  "))).toBe("/save dex dc=14");
    expect(ok("/say a   b").text).toBe("a   b");
  });
  it("a bare name resolves only through ctx.resolve", () => {
    expect(code("/grapple goblin")).toBe("PARSE_BAD_TARGET");
    const r = parse("/grapple goblin", {
      ...ctx(),
      resolve: (n) =>
        n === "goblin" ? { kind: "actor", id: "goblin-1" } : null,
    });
    expect(r.ok && r.intent.targets).toEqual([
      { kind: "actor", id: "goblin-1" },
    ]);
  });
  it("/as sets an npc actor for DM seats only", () => {
    const i = ok("/as @goblin-2 /attack @thorin with scimitar", dm);
    expect(i.actor).toEqual({ kind: "npc", id: "goblin-2" });
    expect(toText(i)).toBe("/as @goblin-2 /attack @thorin with scimitar");
    const n = ok("/as @goblin-2 Halt.", dm);
    expect(n.kind).toBe("npc_say");
    expect(code("/as @goblin-2 Halt.")).toBe("PARSE_UNEXPECTED_TOKEN");
  });
  it("an ai:dm /damage with dice is allowed, with a number is MODEL_NUMBER", () => {
    expect(code("/damage @g-1 1d6+2 fire", { kind: "ai:dm" })).toBe("OK");
    expect(code("/damage @g-1 7 fire", { kind: "ai:dm" })).toBe("MODEL_NUMBER");
  });
  it("IntentBody may be any kind but ruling and whisper (C-CON)", () => {
    expect(code("/rule r1 amend /say hello", dm)).toBe("OK");
    expect(code("/rule r1 amend /rule r2 accept", dm)).toBe("INTENT_SCHEMA");
    expect(code("/rule r1 amend /w @dm hi", dm)).toBe("INTENT_SCHEMA");
  });
});
