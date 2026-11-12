import { IntentSchema, parse, toText } from "@the-stacks/intent";
import { VALID } from "@the-stacks/intent/fixtures";
import { describe, expect, it } from "vitest";
import type { BeatItem } from "../../src/dm/nodes/assemble.js";
import {
  actorOfItem,
  parseSlashItem,
  stampIntent,
} from "../../src/dm/nodes/interpret.js";
import {
  INTERPRET_KINDS,
  IntentBodySchema,
  InterpretOutput,
  InterpretReadingSchema,
} from "../../src/dm/nodes/schemas.js";

/** A fixture reduced to a model body: no envelope fields, no `dc`. */
function bodyOf(i: (typeof VALID)[(typeof INTERPRET_KINDS)[number]][number]) {
  const { dc: _dc, ...params } = i.params as Record<string, unknown>;
  return {
    kind: i.kind,
    targets: i.targets,
    params,
    ...(i.text !== undefined ? { text: i.text } : {}),
  };
}

const pc = { kind: "pc", id: "thorin" } as const;
const item = (text: string, over: Partial<BeatItem> = {}): BeatItem => ({
  actionId: "act-1",
  committedSeq: 1,
  actor: "user-1",
  characterId: "thorin",
  scope: "character",
  text,
  status: "committed",
  ...over,
});

describe("interpret body schema (spec 104 FR-002, CR-004)", () => {
  for (const kind of INTERPRET_KINDS) {
    it(`${kind}: every fixture body passes and stamps to a valid Intent that round-trips`, () => {
      for (const fx of VALID[kind]) {
        const body = bodyOf(fx);
        const parsed = IntentBodySchema.safeParse(body);
        expect(parsed.success, JSON.stringify(parsed.error?.issues)).toBe(true);
        if (!parsed.success) continue;
        const stamped = stampIntent(parsed.data, {
          id: "act-1.0",
          actor: pc,
          source: "ai",
          commit: "declared",
        });
        expect(stamped.ok).toBe(true);
        if (!stamped.ok) continue;
        expect(IntentSchema.safeParse(stamped.intent).success).toBe(true);
        const again = parse(toText(stamped.intent), {
          id: stamped.intent.id,
          actor: pc,
          source: "ai",
          commit: "declared",
        });
        expect(again).toEqual({ ok: true, intent: stamped.intent });
      }
    });
  }

  it("rejects a dc, an actor field, an envelope field and an unknown kind", () => {
    const base = {
      kind: "check",
      targets: [],
      params: { skill: "stealth" },
    };
    expect(IntentBodySchema.safeParse(base).success).toBe(true);
    expect(
      IntentBodySchema.safeParse({
        ...base,
        params: { skill: "stealth", dc: 12 },
      }).success,
    ).toBe(false);
    expect(IntentBodySchema.safeParse({ ...base, actor: pc }).success).toBe(
      false,
    );
    expect(IntentBodySchema.safeParse({ ...base, id: "x" }).success).toBe(
      false,
    );
    expect(IntentBodySchema.safeParse({ ...base, kind: "say" }).success).toBe(
      false,
    );
    expect(IntentBodySchema.safeParse({ ...base, kind: "dance" }).success).toBe(
      false,
    );
  });

  it("beside rides only on check-like kinds and an ability check needs cost and severe", () => {
    const beside = {
      stakes: { success: "s", cost: null, failure: "f", severe: null },
    };
    const stage = (kind: string, params: object, b: unknown) =>
      InterpretReadingSchema.safeParse({
        actionId: "a",
        clarify: null,
        stages: [{ intent: { kind, targets: [], params }, beside: b }],
      });
    expect(stage("dodge", {}, beside).success).toBe(false);
    expect(stage("check", { skill: "stealth" }, beside).success).toBe(false);
    expect(stage("save", { ability: "dex" }, beside).success).toBe(true);
    expect(stage("dodge", {}, null).success).toBe(true);
  });

  it("converts to JSON Schema and keeps the old fields out", () => {
    expect(InterpretOutput.safeParse({ readings: [] }).success).toBe(true);
    const old = InterpretReadingSchema.safeParse({
      actionId: "a",
      intent: "check",
      clarify: null,
      stages: [],
    });
    expect(old.success).toBe(false);
  });
});

describe("stampIntent", () => {
  it("fails with the issue path when the envelope is invalid", () => {
    const r = stampIntent(
      { kind: "dodge", targets: [], params: {}, text: undefined },
      { id: "BAD ID", actor: pc, source: "ai", commit: "declared" },
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.path).toBe("id");
  });
});

describe("actorOfItem (FR-005)", () => {
  it("maps a human item to pc and an AI companion item to companion", () => {
    expect(actorOfItem(item("x"))).toEqual(pc);
    expect(
      actorOfItem(
        item("x", { actor: "ai:companion:mira", characterId: "mira" }),
      ),
    ).toEqual({ kind: "companion", id: "mira" });
    expect(actorOfItem(item("x", { characterId: null }))).toBeNull();
  });
});

describe("parseSlashItem (plan D2, OQ-5)", () => {
  it("parses a slash attack into one stage with no beside", () => {
    const r = parseSlashItem(item('/attack @goblin-2 with "Longsword"'), pc);
    expect(r.clarify).toBeNull();
    expect(r.stages).toHaveLength(1);
    expect(r.stages[0]?.intent.kind).toBe("attack");
    expect(r.stages[0]?.beside).toBeNull();
    expect(InterpretReadingSchema.safeParse(r).success).toBe(true);
  });

  it("returns a clarify and no stage for a bad slash item", () => {
    const r = parseSlashItem(item("/nonsense @@ ??"), pc);
    expect(r.stages).toEqual([]);
    expect(r.clarify).toBeTruthy();
    expect((r.clarify ?? "").length).toBeLessThanOrEqual(200);
  });

  it("returns a clarify for a kind interpret does not emit", () => {
    const r = parseSlashItem(item('/say "hello"'), pc);
    expect(r.stages).toEqual([]);
    expect(r.clarify).toBeTruthy();
  });
});

describe("SC-002 proxy: the 2026-10-26 capture's turn reads on attempt 1", () => {
  // The capture (npc-turn, trigger seq 61) held Kestrel's open action and Snag's turn. Each has a
  // scripted reading in the Intent shape; each validates, stamps and round-trips.
  const readings = {
    readings: [
      {
        actionId: "act-kestrel-1",
        stages: [
          {
            intent: {
              kind: "search",
              targets: [],
              params: { skill: "perception" },
              text: "Kestrel scans the high ground for the goblin lookout.",
            },
            beside: {
              stakes: {
                success: "She spots the lookout before he spots her.",
                cost: "She spots him, but he sees her move.",
                failure: "She sees nothing and the lookout stays hidden.",
                severe: "The lookout spots her first and shouts.",
              },
              onSuccess: [],
              onFailure: [],
              onCost: [],
              onSevere: [],
              newRisk: null,
              reveals: null,
              autoFail: null,
            },
          },
        ],
        clarify: null,
        followUps: [],
      },
      {
        actionId: null,
        stages: [
          {
            intent: {
              kind: "attack",
              targets: [{ kind: "actor", id: "kestrel" }],
              params: { weapon: "Scimitar" },
            },
            beside: null,
          },
        ],
        clarify: null,
        followUps: [],
        say: "Big-feet come to my reeds, pay the toll!",
      },
    ],
  };

  it("validates on attempt 1 and each stage stamps to a round-tripping Intent", () => {
    const parsed = InterpretOutput.safeParse(readings);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    for (const r of parsed.data.readings) {
      for (const [n, st] of r.stages.entries()) {
        const stamped = stampIntent(st.intent, {
          id: `${r.actionId ?? "npc.job"}.${n}`,
          actor:
            r.actionId === null
              ? { kind: "npc", id: "snag" }
              : { kind: "pc", id: "kestrel" },
          source: "ai",
          commit: r.actionId === null ? "confirmed" : "declared",
        });
        expect(stamped.ok).toBe(true);
        if (!stamped.ok) continue;
        const again = parse(toText(stamped.intent), {
          id: stamped.intent.id,
          actor: stamped.intent.actor,
          source: "ai",
          commit: stamped.intent.commit,
        });
        expect(again.ok).toBe(true);
      }
    }
  });
});
