import { describe, expect, it } from "vitest";
import { createGateway } from "../../src/ai/gateway.js";
import { memorySink } from "../../src/ai/usage.js";
import {
  type FactAction,
  type FactChange,
  type FactOutcome,
  type NarrationFacts,
  renderDiceLines,
} from "../../src/dm/facts.js";
import { assemble } from "../../src/dm/nodes/assemble.js";
import {
  audit,
  deterministicChecks,
  MAX_NARRATION_ATTEMPTS,
} from "../../src/dm/nodes/audit.js";
import type { DirectorNodeOutput } from "../../src/dm/nodes/director.js";
import { narrate } from "../../src/dm/nodes/narrate.js";
import type { ResolveOutput } from "../../src/dm/nodes/resolve.js";
import { createScriptedDm, loadDmScript } from "../../src/dm/script/load.js";
import { freeEventsThrough, makeCtx, projectDm } from "./helpers.js";

const roll = (outcome: FactOutcome | null = "success") => ({
  name: "Ana",
  reason: "Ana picks the lock",
  expression: "1d20+5",
  shown: "13",
  total: 18,
  against: { kind: "DC" as const, value: 15 },
  outcome,
  autoFail: false,
  target: null,
});

function action(over: Partial<FactAction> = {}): FactAction {
  return {
    actionId: "a1",
    characterName: "Ana",
    text: "picks the lock",
    outcome: "applied",
    refusalCode: null,
    rolls: [roll()],
    outcomes: ["success"],
    changes: [],
    ...over,
  };
}

function facts(actions: FactAction[] = [action()]): NarrationFacts {
  return {
    trigger: "commit",
    actions,
    npcTurn: null,
    director: {
      pacing: { tension: "low", spotlight: null, beatId: null },
      goalNote: "",
      sceneEnded: false,
    },
    modeChange: null,
    presentNpcs: [],
    rulings: [],
    clarify: [],
    party: [],
    npcNames: [],
    events: [],
    setting: { locationName: "The Vault", openingFraming: "The vault waits." },
  };
}

const CLEAN =
  "The last tumbler gives, and the vault door sighs open on cold air. Something shifts in the dark beyond.";

function check(prose: string, f = facts()) {
  return deterministicChecks(f, { prose, diceLines: renderDiceLines(f) });
}

describe("deterministicChecks", () => {
  it("passes a clean narration", () => {
    expect(check(CLEAN)).toEqual({ pass: true, issues: [] });
  });

  it("fails on digits", () => {
    const r = check("Ana opens 3 locks. The door groans.");
    expect(r.pass).toBe(false);
    expect(r.issues[0]?.kind).toBe("ledger-mismatch");
  });

  it("fails on dice language when the turn has no roll", () => {
    const f = facts([action({ rolls: [], outcomes: [] })]);
    const bad = check("Ana rolls a die and the lock gives way.", f);
    expect(bad.issues.map((i) => i.kind)).toContain("invented-mechanics");
    expect(check("Ana rolls a die and the lock gives way.").pass).toBe(true);
  });

  it("fails on an unrecorded death and on an omitted one", () => {
    expect(check("The guard dies where he stands.").issues[0]?.kind).toBe(
      "ledger-mismatch",
    );
    const dead: FactChange = {
      kind: "life-state",
      target: "Guard",
      before: "conscious",
      after: "dead",
    };
    const f = facts([action({ changes: [dead] })]);
    expect(
      check(CLEAN, f)
        .issues.map((i) => i.detail)
        .join(),
    ).toMatch(/omits it/);
    expect(check("The guard is dead, and the lock gives.", f).pass).toBe(true);
  });

  it("fails on an unrecorded or omitted unconscious state", () => {
    expect(check("The guard is knocked out.").pass).toBe(false);
    const down: FactChange = {
      kind: "life-state",
      target: "Guard",
      before: "conscious",
      after: "unconscious",
    };
    const f = facts([action({ changes: [down] })]);
    expect(check(CLEAN, f).pass).toBe(false);
    expect(check("The guard falls unconscious. The lock gives.", f).pass).toBe(
      true,
    );
  });

  it("fails when the actor's name pairs with the opposite outcome word", () => {
    const r = check("Ana fails to move the lock at all.");
    expect(r.issues[0]?.kind).toBe("ledger-mismatch");
    const miss = facts([action({ outcomes: ["miss"] })]);
    expect(check("Ana hits the door with her sword.", miss).pass).toBe(false);
    expect(check("Ana swings and the blade bites air.", miss).pass).toBe(true);
  });

  it("matches a full name by its first or last word", () => {
    const f = facts([action({ characterName: "Brother Odo" })]);
    expect(check("Odo fails to move the lock.", f).pass).toBe(false);
    expect(check("Brother fails to move the lock.", f).pass).toBe(false);
  });

  it("fails on length over 220 words", () => {
    const long = Array.from({ length: 230 }, () => "word").join(" ");
    expect(check(long).issues.map((i) => i.kind)).toContain("doctrine");
  });

  it("fails on a list line or an either-or ending", () => {
    expect(check("- the door\n- the lock").pass).toBe(false);
    expect(check("1. The door opens.").pass).toBe(false);
    expect(check("The door opens. Do you fight or flee?").pass).toBe(false);
    expect(check("The door opens. What waits behind it?").pass).toBe(true);
  });

  it("fails when the dice lines differ from the renderer", () => {
    const f = facts();
    const r = deterministicChecks(f, { prose: CLEAN, diceLines: ["forged"] });
    expect(r.issues[0]?.detail).toMatch(/dice lines/);
  });
});

const director: DirectorNodeOutput = {
  beat: { decision: "resolve" },
  tableMode: { to: "stay" },
  trackers: [],
  scene: { status: "continue" },
  pacing: { tension: "low", spotlight: null, beatId: null },
  goalNote: "",
  companionPrompts: [],
  overrides: [],
};

const resolved: ResolveOutput = {
  submissions: [],
  actionResults: [],
  appendedRows: [],
  nextJob: null,
  chronicle: false,
  npcTurn: null,
  lastSeq: 0,
};

type Call = { purpose: string; respond: unknown };
const text = (purpose: string, value: string): Call => ({
  purpose,
  respond: { type: "text", value },
});
const json = (purpose: string, value: unknown): Call => ({
  purpose,
  respond: { type: "json", value },
});
const PASS = { verdict: "pass", issues: [] };
const FAIL = {
  verdict: "fail",
  issues: [{ kind: "ledger-mismatch", detail: "The door did not open." }],
};

async function loop(calls: Call[]) {
  const scripted = createScriptedDm(
    loadDmScript({ v: 1, name: "audit", dice: [], calls }),
  );
  const gateway = createGateway({
    config: scripted.aiConfig,
    sink: memorySink(),
    adapters: { fake: () => scripted.provider },
  });
  const events = freeEventsThrough("action.resolved");
  const base = makeCtx({
    deps: { gateway, loadProjections: async () => projectDm(events) },
  });
  const assembled = await assemble(base);
  if (!assembled.ok) throw new Error("assemble failed");
  const ctx0 = {
    ...base,
    results: { assemble: assembled.output, director, resolve: resolved },
  };
  const narrated = await narrate(ctx0);
  if (!narrated.ok) throw new Error("narrate failed");
  const ctx = {
    ...ctx0,
    results: { ...ctx0.results, narrate: narrated.output },
  };
  const out = await audit(ctx);
  return { out, scripted, narrated: narrated.output };
}

describe("audit loop", () => {
  it("passes on the first attempt", async () => {
    const { out, scripted } = await loop([
      text("dm.narrate", CLEAN),
      json("dm.audit", PASS),
    ]);
    if (!out.ok) throw new Error("audit failed");
    expect(out.output.record.final).toBe("passed");
    expect(out.output.record.flagged).toBe(false);
    expect(out.output.shipped?.prose).toBe(CLEAN);
    expect(scripted.remaining().calls["dm.narrate"]).toBe(0);
  });

  it("regenerates after a failed verdict and records the failed attempt", async () => {
    const { out } = await loop([
      text("dm.narrate", CLEAN),
      json("dm.audit", FAIL),
      text("dm.narrate", `${CLEAN} A draft stirs.`),
      json("dm.audit", PASS),
    ]);
    if (!out.ok) throw new Error("audit failed");
    const r = out.output.record;
    expect(r.final).toBe("passed-after-regenerate");
    expect(r.flagged).toBe(true);
    expect(r.attempts).toHaveLength(2);
    expect(r.attempts[0]?.llm).toMatchObject({ verdict: "fail" });
    expect(out.output.shipped?.prose).toContain("A draft stirs.");
    expect(out.output.shipped?.fallback).toBe(false);
  });

  it("skips the model audit when a deterministic check fails", async () => {
    const { out } = await loop([
      text("dm.narrate", "Ana opens 3 locks."),
      text("dm.narrate", CLEAN),
      json("dm.audit", PASS),
    ]);
    if (!out.ok) throw new Error("audit failed");
    expect(out.output.record.attempts[0]?.llm).toEqual({ skipped: true });
    expect(out.output.record.attempts[0]?.deterministic.pass).toBe(false);
  });

  it("stops at three attempts and ships the fallback with a flag", async () => {
    expect(MAX_NARRATION_ATTEMPTS).toBe(3);
    const { out, scripted } = await loop([
      text("dm.narrate", CLEAN),
      json("dm.audit", FAIL),
      text("dm.narrate", CLEAN),
      json("dm.audit", FAIL),
      text("dm.narrate", CLEAN),
      json("dm.audit", FAIL),
    ]);
    if (!out.ok) throw new Error("audit failed");
    expect(out.output.record.attempts).toHaveLength(3);
    expect(out.output.record.final).toBe("fallback");
    expect(out.output.shipped?.fallback).toBe(true);
    expect(out.output.shipped?.flagBody).toMatch(/Attempt 3/);
    expect(scripted.remaining().calls["dm.narrate"]).toBe(0);
  });

  it("ships the fallback when the audit call itself errors", async () => {
    const { out } = await loop([
      text("dm.narrate", CLEAN),
      {
        purpose: "dm.audit",
        respond: { type: "error", kind: "upstream", message: "down" },
      },
    ]);
    if (!out.ok) throw new Error("audit failed");
    expect(out.output.record.attempts).toHaveLength(1);
    expect(out.output.record.attempts[0]?.llm).toEqual({ error: "gateway" });
    expect(out.output.shipped?.fallback).toBe(true);
    expect(out.output.shipped?.text).toContain("\n\n");
  });

  it("records a hash, not the prose", async () => {
    const { out } = await loop([
      text("dm.narrate", CLEAN),
      json("dm.audit", PASS),
    ]);
    if (!out.ok) throw new Error("audit failed");
    expect(JSON.stringify(out.output.record)).not.toContain("tumbler");
    expect(out.output.record.attempts[0]?.proseSha256).toMatch(
      /^[0-9a-f]{64}$/,
    );
  });
});
