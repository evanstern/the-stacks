import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { LedgerRow } from "@the-stacks/session-model";
import { describe, expect, it } from "vitest";
import { createGateway } from "../../src/ai/gateway.js";
import { memorySink } from "../../src/ai/usage.js";
import {
  collectFacts,
  type NarrationFacts,
  renderDiceLines,
} from "../../src/dm/facts.js";
import { assemble } from "../../src/dm/nodes/assemble.js";
import { audit } from "../../src/dm/nodes/audit.js";
import type { DirectorNodeOutput } from "../../src/dm/nodes/director.js";
import type { NarrateOutput } from "../../src/dm/nodes/narrate.js";
import type { ResolveOutput } from "../../src/dm/nodes/resolve.js";
import { buildAuditPrompt } from "../../src/dm/prompts/audit.js";
import { createScriptedDm, loadDmScript } from "../../src/dm/script/load.js";
import { freeEventsThrough, makeCtx, projectDm } from "./helpers.js";
import { EMPTY_RESOLVE_SNAPSHOT } from "./snapshot-fixtures.js";

/**
 * Card AC #6: the auditor holds prose to the declared band, replayed over the
 * captured run verify-20261026T183818Z (seq 168-175 and 203-206). The fake
 * gateway scripts the model; the captured prose is real.
 */

const here = dirname(fileURLToPath(import.meta.url));
const capture = JSON.parse(
  readFileSync(
    join(here, "fixtures/stakes-capture-20261026T183818Z.json"),
    "utf8",
  ),
) as {
  rows: {
    seq: number;
    type: string;
    payload: Record<string, unknown> & { event?: Record<string, unknown> };
  }[];
};
const bySeq = (seq: number) => {
  const r = capture.rows.find((x) => x.seq === seq);
  if (!r) throw new Error(`seq ${seq} missing from the capture`);
  return r;
};
const proseOf = (seq: number) =>
  String((bySeq(seq).payload as { text: string }).text).split("\n\n")[0] ?? "";

const names: Record<string, string> = { odo: "Odo", "goblin-4": "Goblin-4" };
const nameOf = (id: string | null) => (id ? (names[id] ?? id) : "The scene");

/** The captured roll and check rows as ledger rows, with the band 070 adds. */
function ledgerFor(
  rollSeq: number,
  band: "severe-failure" | "failure",
  margin: number,
): LedgerRow[] {
  const mk = (seq: number, extra: Record<string, unknown>) => {
    const { payload } = bySeq(seq);
    const event = payload.event as Record<string, unknown>;
    return {
      seq,
      actor: "ai:dm",
      visibility: "public",
      reason: event.reason,
      batchId: payload.batchId,
      index: payload.index,
      actionId: payload.actionId,
      ...extra,
      event,
    };
  };
  const r = mk(rollSeq, {});
  const c = mk(rollSeq + 1, {});
  return [
    { kind: "roll", ...r, roll: r.event },
    { kind: "outcome", ...c, outcome: { ...c.event, band, margin } },
  ] as unknown as LedgerRow[];
}

const SEVERE = "Snag spurns the toll and orders Tamsin dragged to the post.";
const stakes = {
  success: "The attempt works as intended.",
  cost: "It works, at a small price.",
  failure: "The grab fails and Goblin-4 loses its footing.",
  severe: SEVERE,
};

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
  ...EMPTY_RESOLVE_SNAPSHOT,
  lastSeq: 0,
};

function factsFor(
  rollSeq: number,
  band: "severe-failure" | "failure",
  margin: number,
  declared: string,
): NarrationFacts {
  const rows = ledgerFor(rollSeq, band, margin);
  const batchId = rows[0]?.batchId as string;
  const c = collectFacts(rows, nameOf, new Map(), new Map([[batchId, stakes]]));
  expect(c.rolls[0]?.consequence).toBe(declared);
  return {
    trigger: "commit",
    actions: [
      {
        actionId: "a1",
        characterName: null,
        text: "the beat",
        outcome: "applied",
        refusalCode: null,
        ...c,
        followUps: [],
      },
    ],
    npcTurn: null,
    director: { pacing: director.pacing, goalNote: "", sceneEnded: false },
    modeChange: null,
    presentNpcs: [],
    rulings: [],
    clarify: [],
    party: [],
    events: [],
    setting: { locationName: "The Ford", openingFraming: "The ford waits." },
  } as unknown as NarrationFacts;
}

const FAIL = {
  verdict: "fail",
  issues: [
    {
      kind: "ledger-mismatch",
      detail: "The prose tells a different consequence than the declared one.",
    },
  ],
};
const PASS = { verdict: "pass", issues: [] };

async function replay(facts: NarrationFacts, captured: string, second: string) {
  const seen: string[] = [];
  const scripted = createScriptedDm(
    loadDmScript({
      v: 1,
      name: "stakes-audit",
      dice: [],
      calls: [
        { purpose: "dm.audit", respond: { type: "json", value: FAIL } },
        { purpose: "dm.narrate", respond: { type: "text", value: second } },
        { purpose: "dm.audit", respond: { type: "json", value: PASS } },
      ],
    }),
  );
  const provider = scripted.provider;
  const orig = provider.chat?.bind(provider);
  if (!orig) throw new Error("scripted provider has no chat");
  (provider as { chat: typeof orig }).chat = (model, req, opts) => {
    seen.push(JSON.stringify(req));
    return orig(model, req, opts);
  };
  const gateway = createGateway({
    config: scripted.aiConfig,
    sink: memorySink(),
    adapters: { fake: () => provider },
  });
  const events = freeEventsThrough("action.resolved");
  const base = makeCtx({
    deps: { gateway, loadProjections: async () => projectDm(events) },
  });
  const assembled = await assemble(base);
  if (!assembled.ok) throw new Error("assemble failed");
  const diceLines = renderDiceLines(facts);
  const narrated: NarrateOutput = {
    prose: captured,
    diceLines,
    text: `${captured}\n\n${diceLines.join("\n")}`,
    actionIds: ["a1"],
    attempt: 1,
    skipped: false,
    facts,
    withheld: [],
  };
  const out = await audit({
    ...base,
    results: {
      assemble: assembled.output,
      director,
      resolve: resolved,
      narrate: narrated,
    },
  });
  if (!out.ok) throw new Error("audit failed");
  return { out: out.output, seen, scripted };
}

describe("stakes audit over the captured run (card AC #6)", () => {
  it("seq 171: the severe band and consequence reach the audit prompt", () => {
    const facts = factsFor(170, "severe-failure", -5, SEVERE);
    const p = buildAuditPrompt({
      facts,
      snapshot: EMPTY_RESOLVE_SNAPSHOT.snapshot,
      prose: proseOf(175),
    });
    expect(p.user).toContain("severe failure");
    expect(p.user).toContain(`consequence: ${SEVERE}`);
    expect(p.system).toContain("band and consequence are decided");
  });

  it("seq 175: a ledger-mismatch fail regenerates once and the second draft ships", async () => {
    const facts = factsFor(170, "severe-failure", -5, SEVERE);
    const second =
      "Snag spurns the toll with a sneer and snaps his fingers. Two goblins seize Tamsin and haul her toward the post.";
    const { out, scripted, seen } = await replay(facts, proseOf(175), second);
    expect(out.record.final).toBe("passed-after-regenerate");
    expect(out.record.attempts).toHaveLength(2);
    expect(out.record.attempts[0]?.llm).toMatchObject({
      verdict: "fail",
      issues: [{ kind: "ledger-mismatch", blocking: true }],
    });
    expect(out.shipped?.prose).toBe(second);
    expect(scripted.remaining().calls["dm.narrate"]).toBe(0);
    expect(seen.some((s) => s.includes(`consequence: ${SEVERE}`))).toBe(true);
  });

  it("seq 203: the F6 dodge on a plain failure regenerates the same way", async () => {
    const declared = stakes.failure;
    const facts = factsFor(202, "failure", -1, declared);
    const second =
      "The goblin lunges, but its grip slips and it stumbles, losing its footing in the mud.";
    const { out } = await replay(facts, proseOf(206), second);
    expect(out.record.final).toBe("passed-after-regenerate");
    expect(out.shipped?.prose).toBe(second);
  });
});
