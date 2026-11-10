import { describe, expect, it } from "vitest";
import { type PlanResult, plan, type RulingRequest } from "../src/index.js";
import { actors, baseState, intent, tgt, view } from "./fixtures.js";

const open = (r: PlanResult): RulingRequest => {
  expect(r.kind).toBe("needs_ruling");
  return r.kind === "needs_ruling" ? r.request : (undefined as never);
};
const withOpen = (req: RulingRequest) =>
  baseState({ openRequests: { [req.requestId]: req } });
const run = (i: ReturnType<typeof intent>, s = baseState()) =>
  plan(s, view(s), i);

const climb = () =>
  intent("check", { id: "i-climb", params: { skill: "athletics" } });

describe("rulings", () => {
  it("accept with a tier plans the stored check with that tier", () => {
    const req = open(run(climb()));
    const r = run(
      intent("ruling", {
        actor: actors.aiDm,
        params: {
          requestId: req.requestId,
          decision: "accept",
          difficulty: "hard",
        },
      }),
      withOpen(req),
    );
    expect(r.kind).toBe("commands");
    if (r.kind !== "commands") return;
    expect(r.commands).toHaveLength(1);
    expect(r.commands[0]?.command).toMatchObject({
      type: "check.roll",
      combatantId: "thorin",
      difficulty: "hard",
    });
    expect(r.facts).toContainEqual({
      kind: "ruling",
      requestId: "i-climb",
      decision: "accept",
      by: "ai:dm",
    });
    expect(r.facts).toContainEqual({
      kind: "dc",
      source: "difficulty",
      difficulty: "hard",
    });
  });

  it("accept with a dc from the dm seat plans a dc source", () => {
    const req = open(run(climb()));
    const r = run(
      intent("ruling", {
        actor: actors.dm,
        params: { requestId: req.requestId, decision: "accept", dc: 17 },
      }),
      withOpen(req),
    );
    expect(r.kind === "commands" && r.commands[0]?.command).toMatchObject({
      dc: 17,
    });
    expect(r.facts).toContainEqual(
      expect.objectContaining({ kind: "ruling", by: "dm" }),
    );
  });

  it("the replan cites the stored Intent as its reason, not the ruling", () => {
    const req = open(run(climb()));
    const r = run(
      intent("ruling", {
        actor: actors.dm,
        params: { requestId: req.requestId, decision: "accept", dc: 12 },
      }),
      withOpen(req),
    );
    const cmd = r.kind === "commands" ? r.commands[0]?.command : undefined;
    const reason = (cmd as { reason: string } | undefined)?.reason ?? "";
    expect(reason).toContain("/check");
    expect(reason).not.toContain("/rule");
  });

  it("a tierless accept on a difficulty ask asks again, keyed on the ruling id", () => {
    const req = open(run(climb()));
    const ruling = intent("ruling", {
      id: "i-ruling-x",
      actor: actors.dm,
      params: { requestId: req.requestId, decision: "accept" },
    });
    const again = open(run(ruling, withOpen(req)));
    expect(again.requestId).toBe("i-ruling-x");
    expect(again.ask).toBe("difficulty");
  });

  it("reject plans no command and records the decision", () => {
    const req = open(run(climb()));
    const r = run(
      intent("ruling", {
        actor: actors.dm,
        params: {
          requestId: req.requestId,
          decision: "reject",
          reason: "the wall is sheer glass",
        },
      }),
      withOpen(req),
    );
    expect(r).toEqual({
      kind: "commands",
      commands: [],
      facts: [
        {
          kind: "ruling",
          requestId: "i-climb",
          decision: "reject",
          by: "dm",
          reason: "the wall is sheer glass",
        },
      ],
    });
  });

  it("amend plans the body with the stored actor", () => {
    const req = open(run(climb()));
    const r = run(
      intent("ruling", {
        actor: actors.dm,
        params: {
          requestId: req.requestId,
          decision: "amend",
          amend: {
            kind: "contest",
            targets: [tgt("goblin-2")],
            params: { skill: "athletics" },
          },
        },
      }),
      withOpen(req),
    );
    expect(r.kind === "commands" && r.commands[0]?.command).toMatchObject({
      type: "check.roll",
      combatantId: "thorin",
      opposition: { opponentId: "goblin-2", rule: "unarmed-strike" },
    });
  });

  it("amend to an attempt returns a new request keyed on the ruling id", () => {
    const req = open(run(climb()));
    const r = run(
      intent("ruling", {
        id: "i-ruling-amend",
        actor: actors.dm,
        params: {
          requestId: req.requestId,
          decision: "amend",
          amend: {
            kind: "attempt",
            targets: [],
            params: {},
            text: "Scale the wall.",
          },
        },
      }),
      withOpen(req),
    );
    const next = open(r);
    expect(next.requestId).toBe("i-ruling-amend");
    expect(next.ask).toBe("outcome");
  });

  it("refuses REQUEST_NOT_OPEN for an unknown request", () => {
    const r = run(
      intent("ruling", {
        actor: actors.dm,
        params: { requestId: "nope", decision: "reject" },
      }),
    );
    expect(r.kind === "refusal" && r.refusal.code).toBe("REQUEST_NOT_OPEN");
  });
});

describe("set_dc", () => {
  it("answers an open request with its tier", () => {
    const req = open(run(climb()));
    const r = run(
      intent("set_dc", {
        actor: actors.aiDm,
        params: { for: req.requestId, difficulty: "very-hard" },
      }),
      withOpen(req),
    );
    expect(r.kind === "commands" && r.commands[0]?.command).toMatchObject({
      difficulty: "very-hard",
    });
  });

  it("answers with a dc from the dm seat", () => {
    const req = open(run(climb()));
    const r = run(
      intent("set_dc", {
        actor: actors.dm,
        params: { for: req.requestId, dc: 14 },
      }),
      withOpen(req),
    );
    expect(r.kind === "commands" && r.commands[0]?.command).toMatchObject({
      dc: 14,
    });
  });

  it("refuses REQUEST_NOT_OPEN", () => {
    const r = run(
      intent("set_dc", { actor: actors.dm, params: { for: "gone", dc: 14 } }),
    );
    expect(r.kind === "refusal" && r.refusal.code).toBe("REQUEST_NOT_OPEN");
  });
});

describe("attempt and use_object", () => {
  it("attempt asks for an outcome; accept plans no command and a no-roll fact", () => {
    const i = intent("attempt", { id: "i-grab", text: "I grab the clapper." });
    const req = open(run(i));
    expect(req).toMatchObject({
      requestId: "i-grab",
      ask: "outcome",
      roll: null,
    });
    const r = run(
      intent("ruling", {
        actor: actors.aiDm,
        params: { requestId: "i-grab", decision: "accept" },
      }),
      withOpen(req),
    );
    expect(r.kind).toBe("commands");
    if (r.kind !== "commands") return;
    expect(r.commands).toEqual([]);
    expect(r.facts).toContainEqual({ kind: "no-roll", reason: "uncontested" });
  });

  it("use_object asks for an outcome", () => {
    const r = run(
      intent("use_object", { targets: [{ kind: "entity", id: "lever" }] }),
    );
    expect(open(r)).toMatchObject({ ask: "outcome", stakes: "self" });
  });
});
