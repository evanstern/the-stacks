import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import { enqueueTurn, listDmJobs } from "../../src/dm/jobs.js";
import { assemble } from "../../src/dm/nodes/assemble.js";
import { READ_FAILURE_TEXT } from "../../src/dm/nodes/resolve.js";
import { PURPOSE_OF } from "../../src/dm/purposes.js";
import { legalEscalation, runTalkTurn } from "../../src/dm/talk-turn.js";
import {
  RECONSTRUCTED_F1,
  RECONSTRUCTED_F1_RETRY,
  RECONSTRUCTED_F2,
  RECONSTRUCTED_F2_RETRY,
} from "./fixtures/react-params-hosted.js";
import {
  clearDmJobsBeforeEach,
  drainAll,
  script,
  tick,
  workerFor,
} from "./worker-world.js";
import {
  commitAction,
  createWorld,
  db,
  loudSkip,
  payloadOf,
  player,
  reachable,
  readRows,
  requireDb,
  startScene,
  TAMSIN_USER,
  type World,
} from "./world.js";

/** The talk path (specs/065-talk-triggers D3): reply, none, leak, full pipeline, reclaim, chain. */

loudSkip("talk-turn.integration.test.ts");
afterAll(async () => {
  await db?.$client.end();
});
clearDmJobsBeforeEach();

const KESTREL_USER = "00000000-0000-4000-8000-0000000000a2";
const chronicle = () => ({
  purpose: "dm.chronicle",
  respond: { type: "json", value: { entries: [] } },
});
const reactCall = (value: Record<string, unknown>) => ({
  purpose: "dm.narrate",
  respond: {
    type: "json",
    value: {
      outcome: "reply",
      triggers: [],
      speaker: "wenna",
      text: "Wenna nods slowly.",
      encounterId: null,
      companionPrompts: [],
      confirm: [],
      answer: null,
      reason: "r",
      ...value,
    },
  },
});

/** A duo table after scene start, with the talk script's calls queued after it. */
async function table(talkCalls: unknown[], dice: number[] = []) {
  const sceneStart = script("scene-start.json");
  const w = await createWorld({
    dice,
    calls: [...sceneStart.calls, chronicle(), ...talkCalls],
  });
  const wired = workerFor(w, { talkQuietMs: 0 });
  await enqueueTurn(requireDb(), w.sessionId, "scene-start", null, {
    start: {
      seedId: "greyhollow-ford-duo",
      seats: { tamsin: TAMSIN_USER, kestrel: KESTREL_USER },
    },
  });
  await drainAll(wired.worker);
  return { w, ...wired };
}

/** Posts talk, then lets the gate listener enqueue (it runs async). */
let intentN = 0;
const say = async (w: World, text: string, channel = "ic") => {
  const res = await w.as(player, {
    kind: "intent",
    intent: {
      id: `say-${++intentN}`,
      kind: channel === "ooc" ? "ooc" : "say",
      actor: { kind: "pc", id: "tamsin" },
      text,
      source: "composer",
      commit: "declared",
    },
  });
  if (!res.ok) throw new Error(`say refused: ${res.refusal.code}`);
  await tick();
  return res;
};

const dmNarrations = async (w: World) =>
  (await readRows(w)).filter(
    (r) => r.type === "narration" && r.actor === "ai:dm",
  );
const talkJobs = async (w: World) =>
  (await listDmJobs(requireDb(), w.sessionId, 50, "turn")).filter(
    (j) => (j.input as { trigger: string }).trigger === "talk",
  );
const MECHANICS = new Set([
  "roll",
  "combatant.added",
  "initiative",
  "table-mode.changed",
  "hp.changed",
]);

describe.skipIf(!reachable)("talk turn (database)", () => {
  it("a reply ships one narration row and no state-change row", async () => {
    const s = script("talk-reply.json");
    const { w, worker } = await table(s.calls);
    const before = await readRows(w);
    await say(w, "Wenna, who's missing from this house?");
    await drainAll(worker);
    const after = (await readRows(w)).slice(before.length);
    const narrations = after.filter((r) => r.type === "narration");
    expect(narrations).toHaveLength(1);
    expect(narrations[0]?.actor).toBe("ai:dm");
    expect(after.filter((r) => MECHANICS.has(r.type))).toEqual([]);
    const [job] = await talkJobs(w);
    expect(job?.status).toBe("succeeded");
    const result = job?.result as {
      talk: {
        outcome: string;
        codeTriggers: { kind: string; actorId: string }[];
      };
      calls: { purpose: string; promptVersion: string }[];
    };
    expect(result.talk.outcome).toBe("reply");
    expect(result.talk.codeTriggers).toContainEqual(
      expect.objectContaining({ kind: "addressed", actorId: "wenna" }),
    );
    expect(result.calls.map((c) => [c.purpose, c.promptVersion])).toEqual([
      [PURPOSE_OF.narrate, "dm.react-v7"],
    ]);
  });

  it("none ships nothing and records the reason", async () => {
    const s = script("talk-none.json");
    const { w, worker } = await table(s.calls);
    const before = (await readRows(w)).length;
    await say(w, "Does anyone answer?");
    await drainAll(worker);
    expect(
      (await readRows(w))
        .slice(before)
        .filter((r) => r.type !== "presence.recorded")
        .map((r) => r.type),
    ).toEqual(["talk", "intent.recorded"]);
    const [job] = await talkJobs(w);
    expect(job?.status).toBe("succeeded");
    expect(job?.result).toMatchObject({
      talk: { outcome: "none", reason: expect.stringContaining("chatter") },
    });
  });

  it("a DM-only leak drops its sentence, ships the rest and appends a dm correction (spec 103)", async () => {
    const leak =
      "Wenna leans in. Four goblins took the clapper into the reeds.";
    const { w, worker } = await table([reactCall({ text: leak })]);
    const before = (await readRows(w)).length;
    await say(w, "Wenna, what do you know?");
    await drainAll(worker);
    const after = (await readRows(w)).slice(before);
    const narrations = after.filter((r) => r.type === "narration");
    expect(narrations).toHaveLength(1);
    const shown = payloadOf<{ text: string }>(narrations[0]).text;
    expect(shown).toContain("Wenna leans in.");
    expect(shown).not.toContain("clapper");
    const fixes = after.filter(
      (r) =>
        r.type === "talk" &&
        r.actor === "ai:dm" &&
        payloadOf<{ text: string }>(r).text.startsWith("Correction (hidden)"),
    );
    expect(fixes).toHaveLength(1);
    expect(fixes[0]?.visibility).toBe("dm");
    expect(w.scripted.remaining().calls["dm.narrate"]).toBe(0);
    const [job] = await talkJobs(w);
    expect(job?.status).toBe("succeeded");
  });

  it("a reply that names an unmet actor in Wenna's quote ships without that sentence and appends a dm correction naming Snag (spec 112, R1 seq 21)", async () => {
    const seq21 = (
      JSON.parse(
        readFileSync(
          join(
            dirname(fileURLToPath(import.meta.url)),
            "fixtures/r1-spine-0106e608.json",
          ),
          "utf8",
        ),
      ) as { react: { seq21: { text: string } }; correctedSeq21: string }
    ).react.seq21.text;
    const { w, worker } = await table([reactCall({ text: seq21 })]);
    const before = (await readRows(w)).length;
    await say(w, "Wenna, who is out there?");
    await drainAll(worker);
    const after = (await readRows(w)).slice(before);
    const narrations = after.filter((r) => r.type === "narration");
    expect(narrations).toHaveLength(1);
    const shown = payloadOf<{ text: string }>(narrations[0]).text;
    expect(shown).toContain("Pell's not back.");
    expect(shown).not.toContain("Snag");
    const fixes = after.filter(
      (r) =>
        r.type === "talk" &&
        r.actor === "ai:dm" &&
        payloadOf<{ text: string }>(r).text.startsWith("Correction (hidden)"),
    );
    expect(fixes).toHaveLength(1);
    expect(payloadOf<{ text: string }>(fixes[0]).text).toContain("Snag");
    expect(fixes[0]?.visibility).toBe("dm");
  });

  it("a talk job with a committed beat runs the full pipeline", async () => {
    const s = script("exploration-check.json");
    const w = await createWorld({
      dice: s.dice,
      calls: [...s.calls, chronicle()],
    });
    const { worker } = workerFor(w, { listen: false });
    await startScene(w);
    await commitAction(
      w,
      "I search the ferry-house for the bell rope.",
      "act-search",
    );
    const projections = await w.projections();
    await enqueueTurn(requireDb(), w.sessionId, "talk", projections.throughSeq);
    await drainAll(worker);
    const [job] = await talkJobs(w);
    expect(job?.status).toBe("succeeded");
    const result = job?.result as {
      outcome: { status: string };
      talk?: unknown;
      calls: { purpose: string }[];
    };
    expect(result.outcome.status).toBe("completed");
    expect(result.talk).toBeUndefined();
    expect(result.calls.map((c) => c.purpose)).toContain(PURPOSE_OF.director);
  });

  it("a reclaim reuses the checkpointed react output and ships once", async () => {
    const { w } = await table([]);
    await say(w, "Wenna, who's missing from this house?");
    const react = {
      outcome: "reply" as const,
      triggers: [],
      speaker: "wenna",
      text: "Wenna keeps her counsel, and the fire pops.",
      encounterId: null,
      companionPrompts: [],
      confirm: [],
      answer: null,
      reason: "r",
    };
    const seq = (await w.projections()).throughSeq;
    const run = async () => {
      const base = w.ctx({
        job: { trigger: "talk", triggerSeq: seq, attempt: 2 },
        checkpoint: { ...w.checkpoint.current, react },
      });
      const assembled = await assemble(base);
      if (!assembled.ok) throw new Error("assemble failed");
      return runTalkTurn(
        { ...base, results: { assemble: assembled.output } },
        assembled.output,
      );
    };
    const first = await run();
    expect(first).toMatchObject({ status: "talk", shipped: true });
    const second = await run();
    expect(second).toMatchObject({ status: "talk" });
    expect(await dmNarrations(w)).toHaveLength(2); // scene start + one reaction
    expect(w.scripted.remaining().calls["dm.narrate"]).toBe(0);
  });

  it("a reclaimed escalation resumes without a second encounter.started or duplicate combatants", async () => {
    const { w } = await table([], [15, 12, 10, 8, 6, 4, 3, 2]);
    await say(w, "Wenna, draw steel! They are in the reeds!");
    const seq = (await w.projections()).throughSeq;
    const react = {
      outcome: "escalate" as const,
      triggers: [],
      speaker: null,
      text: "Goblins burst from the rushes with rusted blades raised.",
      encounterId: "reed-camp",
      companionPrompts: [],
      confirm: [],
      answer: null,
      reason: "r",
    };
    // Attempt 1 landed the opening move but died before the narration.
    const { result } = await w.runResolve({
      director: {
        beat: { decision: "resolve" },
        tableMode: { to: "turn", encounterId: "reed-camp", reason: "r" },
      },
      job: { trigger: "talk", triggerSeq: seq, attempt: 1 },
    });
    if (!result.ok) throw new Error("opening move failed");
    const before = await readRows(w);
    const count = (rows: typeof before, type: string) =>
      rows.filter((r) => r.type === type).length;
    const checkpoint = {
      ...w.checkpoint.current,
      react,
      submissions: result.output.submissions,
      lastSeq: result.output.lastSeq,
    };
    const base = w.ctx({
      job: { trigger: "talk", triggerSeq: seq, attempt: 2 },
      checkpoint,
    });
    const assembled = await assemble(base);
    if (!assembled.ok) throw new Error("assemble failed");
    const out = await runTalkTurn(
      { ...base, results: { assemble: assembled.output } },
      assembled.output,
    );
    expect(out).toMatchObject({ status: "talk", shipped: true });
    const after = await readRows(w);
    expect(count(after, "encounter.started")).toBe(1);
    expect(count(after, "combatant.added")).toBe(
      count(before, "combatant.added"),
    );
    expect(count(after, "narration")).toBe(count(before, "narration") + 1);
  });

  it("a companion's line queues a read that makes no model call, so the chain stops (spec 066 FR-010)", async () => {
    const s = script("talk-chain.json");
    const { w, worker } = await table(s.calls);
    const sceneRows = (await dmNarrations(w)).length;
    await say(w, "Wenna, who's missing from this house?");
    await drainAll(worker); // reply 1, Odo's line, then a read of Odo's line that calls nothing
    expect((await dmNarrations(w)).length - sceneRows).toBe(1);
    const rows = await readRows(w);
    expect(
      rows.filter((r) => r.type === "talk" && r.actor === "ai:companion:odo"),
    ).toHaveLength(1);
    expect(await talkJobs(w)).toHaveLength(2);
    expect(w.scripted.remaining().calls["dm.narrate"]).toBe(1); // react 2 never asked
    const second = (await talkJobs(w)).find(
      (j) => (j.result as { talk?: { posts: number[] } }).talk?.posts.length,
    );
    expect(second?.result).toMatchObject({
      talk: {
        outcome: "none",
        reason: expect.stringContaining("needs a read"),
      },
    });
    const companionJobs = await listDmJobs(
      requireDb(),
      w.sessionId,
      20,
      "companion",
    );
    expect(companionJobs).toHaveLength(1); // only reply 1 prompted Odo

    // A human post resets the count and draws a new read.
    await say(w, "Wenna, anything else?");
    expect(await talkJobs(w)).toHaveLength(3);
  });

  it("escalate writes combatant adds, initiative and a turn-mode row, then queues a turn", async () => {
    const s = script("talk-escalate.json");
    const { w, worker } = await table(s.calls, s.dice);
    const before = (await readRows(w)).length;
    await say(w, "Wenna, draw steel! They are in the reeds!");
    await tick();
    await drainAll(worker);
    const after = (await readRows(w)).slice(before);
    const types = after.map((r) => r.type);
    expect(types).toContain("combatant.added");
    expect(types).toContain("encounter.started");
    expect(types).toContain("table-mode.changed");
    expect(
      after.filter((r) => r.type === "narration" && r.actor === "ai:dm"),
    ).toHaveLength(1);
    // the narration lands after the mode starts; no tracker or scene-end row
    expect(types).not.toContain("tracker.changed");
    expect(types).not.toContain("scene.ended");
    const p = await w.projections();
    expect(p.tableMode.mode).toBe("turn");
    expect(p.encounter).not.toBeNull();
    const [job] = await talkJobs(w);
    expect(job?.result).toMatchObject({ talk: { outcome: "escalate" } });
    const queued = (await listDmJobs(requireDb(), w.sessionId, 50)).filter(
      (j) => j.id !== job?.id && j.kind !== "chronicle",
    );
    expect(queued.length).toBeGreaterThan(0);
  });

  it("an escalate into an unknown encounter ships as scene and stays free", async () => {
    const { w, worker } = await table([
      reactCall({
        outcome: "escalate",
        speaker: null,
        encounterId: "no-such-fight",
        text: "The reeds hiss and the lamp gutters.",
      }),
      chronicle(),
    ]);
    const before = (await readRows(w)).length;
    await say(w, "Wenna, what was that?");
    await drainAll(worker);
    const after = (await readRows(w)).slice(before);
    expect(after.filter((r) => MECHANICS.has(r.type))).toEqual([]);
    expect(after.filter((r) => r.type === "narration")).toHaveLength(1);
    expect((await w.projections()).tableMode.mode).toBe("free");
    const [job] = await talkJobs(w);
    expect(job?.result).toMatchObject({ talk: { outcome: "scene" } });
  });

  it("legalEscalation refuses a started or ended encounter", async () => {
    const esc = script("talk-escalate.json");
    const { w, worker } = await table(esc.calls, esc.dice);
    const free = await w.projections();
    const seed = w.ctx().seed;
    expect(legalEscalation(seed, free, "reed-camp")).toBe(true);
    expect(legalEscalation(seed, free, "no-such-fight")).toBe(false);
    // spec 088: a monster arrival alone does not make the encounter run
    const withLookout = {
      ...free,
      engine: {
        ...free.engine,
        combatants: {
          ...free.engine.combatants,
          "goblin-3": Object.values(free.engine.combatants)[0],
        },
      },
    } as never;
    expect(legalEscalation(seed, withLookout, "reed-camp")).toBe(true);
    await say(w, "Wenna, draw steel! They are in the reeds!");
    await drainAll(worker);
    // started: turn mode, monsters are combatants
    expect(legalEscalation(seed, await w.projections(), "reed-camp")).toBe(
      false,
    );
    // ended but monsters remain combatants, mode free again
    const ended = await w.projections();
    expect(
      legalEscalation(
        seed,
        { ...ended, tableMode: { mode: "free" }, encounter: null } as never,
        "reed-camp",
      ),
    ).toBe(false);
  });
});

const KESTREL = "kestrel";
const hideBody = { kind: "hide", targets: [], params: {} };
const confirmReact = (over: Record<string, unknown> = {}) => ({
  outcome: "confirm" as const,
  triggers: [],
  speaker: null,
  text: "",
  encounterId: null,
  companionPrompts: [],
  confirm: [
    {
      characterId: "tamsin",
      text: "Tamsin slips behind the barrels",
      body: hideBody,
    },
  ],
  answer: null,
  reason: "r",
  ...over,
});

const declareHide = async (w: World, id: string) => {
  const res = await w.as(player, {
    kind: "intent",
    intent: {
      id,
      kind: "hide",
      actor: { kind: "pc", id: "tamsin" },
      source: "composer",
      commit: "declared",
    },
  });
  if (!res.ok) throw new Error(`declare refused: ${res.refusal.code}`);
  await tick();
};

const suggested = async (w: World) =>
  (await readRows(w)).filter((r) => r.type === "action.suggested");

/** Runs one talk turn by hand at `triggerSeq` over the current log. */
async function readAt(
  w: World,
  triggerSeq: number,
  opts: { react?: unknown; attempt?: number } = {},
) {
  const base = w.ctx({
    job: { trigger: "talk", triggerSeq, attempt: opts.attempt ?? 1 },
    checkpoint: {
      ...w.checkpoint.current,
      ...(opts.react ? { react: opts.react as never } : {}),
    },
  });
  const assembled = await assemble(base);
  if (!assembled.ok) throw new Error("assemble failed");
  return runTalkTurn(
    { ...base, results: { assemble: assembled.output } },
    assembled.output,
  );
}

describe.skipIf(!reachable)("the read: confirm and answer (spec 066)", () => {
  it("two schema failures fail the talk job and post the public read-failure notice (spec 114 SC-004)", async () => {
    const bad = {
      purpose: "dm.narrate",
      respond: { type: "json", value: { outcome: "bogus" } },
    };
    const { w, worker } = await table([bad, bad]);
    const before = (await readRows(w)).length;
    await say(w, "I look for the cellar door.");
    await drainAll(worker);
    const [job] = await talkJobs(w);
    expect(job?.status).toBe("failed");
    const talks = (await readRows(w))
      .slice(before)
      .filter((r) => r.type === "talk" && r.actor === "ai:dm")
      .map((r) => ({
        text: payloadOf<{ text: string; channel: string }>(r).text,
        channel: payloadOf<{ channel: string }>(r).channel,
        visibility: r.visibility,
      }));
    const readNotice = talks.filter((t) => t.text === READ_FAILURE_TEXT);
    expect(readNotice).toEqual([
      { text: READ_FAILURE_TEXT, channel: "ooc", visibility: "public" },
    ]);
    expect(
      talks.filter(
        (t) => t.visibility === "dm" && t.text.startsWith("The DM runtime"),
      ),
    ).toHaveLength(1);
  });

  it("a model confirm ships one action.suggested row with a declared Intent, no state change", async () => {
    const s = script("talk-confirm.json");
    const { w, worker } = await table(s.calls);
    const before = (await readRows(w)).length;
    await say(w, "I slip behind the barrels and wait.");
    await drainAll(worker);
    const rows = (await readRows(w)).slice(before);
    const sug = rows.filter((r) => r.type === "action.suggested");
    expect(sug).toHaveLength(1);
    expect(sug[0]?.actor).toBe("ai:dm");
    const pl = payloadOf<{
      suggestionId: string;
      items: {
        itemId: string;
        intent: { id: string; commit: string; kind: string };
      }[];
    }>(sug[0]);
    expect(pl.items).toHaveLength(1);
    expect(pl.items[0]?.intent).toMatchObject({
      id: `${pl.suggestionId}.i1`,
      kind: "hide",
      commit: "declared",
    });
    expect(rows.filter((r) => MECHANICS.has(r.type))).toEqual([]);
    expect(rows.filter((r) => r.type === "narration")).toEqual([]);
    const [job] = await talkJobs(w);
    expect(job?.result).toMatchObject({
      talk: { outcome: "confirm", confirmItems: 1, answered: false },
    });
  });

  it("a declared Intent confirms in code with no model call", async () => {
    const { w, worker } = await table([]);
    await declareHide(w, "hide-1");
    await drainAll(worker);
    const sug = await suggested(w);
    expect(sug).toHaveLength(1);
    const pl = payloadOf<{
      items: { intent: { kind: string; commit: string } }[];
    }>(sug[0]);
    expect(pl.items[0]?.intent).toMatchObject({
      kind: "hide",
      commit: "declared",
    });
    const [job] = await talkJobs(w);
    expect(job?.result).toMatchObject({ calls: [] });
  });

  it("drops a companion item and ships nothing when none is left", async () => {
    const w0 = await table([
      {
        purpose: "dm.narrate",
        respond: {
          type: "json",
          value: confirmReact({
            confirm: [
              { characterId: "odo", text: "Odo prays", body: hideBody },
            ],
          }),
        },
      },
    ]);
    await say(w0.w, "We should hide.");
    await drainAll(w0.worker);
    expect(await suggested(w0.w)).toHaveLength(0);
    const [job] = await talkJobs(w0.w);
    expect(job?.result).toMatchObject({
      talk: { outcome: "none", confirmItems: 0 },
    });
  });

  it("answers an ask_dm to the asker only, before any confirm, and drops a leaking sentence", async () => {
    const reply = confirmReact({
      answer:
        "The room above is a ladder high. Four goblins took the clapper into the reeds.",
    });
    const { w, worker } = await table([
      { purpose: "dm.narrate", respond: { type: "json", value: reply } },
    ]);
    const before = (await readRows(w)).length;
    const res = await w.as(player, {
      kind: "intent",
      intent: {
        id: "ask-1",
        kind: "ask_dm",
        actor: { kind: "pc", id: "tamsin" },
        text: "@dm how high is the room above?",
        source: "composer",
        commit: "declared",
      },
    });
    expect(res.ok).toBe(true);
    await tick();
    await drainAll(worker);
    const rows = (await readRows(w)).slice(before);
    const answerIdx = rows.findIndex(
      (r) => r.type === "talk" && r.actor === "ai:dm",
    );
    const confirmIdx = rows.findIndex((r) => r.type === "action.suggested");
    expect(answerIdx).toBeGreaterThan(-1);
    expect(confirmIdx).toBeGreaterThan(answerIdx);
    const answer = rows[answerIdx];
    expect(answer?.visibility).toBe(TAMSIN_USER);
    expect(payloadOf<{ text: string; channel: string }>(answer)).toMatchObject({
      channel: "ooc",
    });
    expect(payloadOf<{ text: string }>(answer).text).toContain("ladder high");
    expect(payloadOf<{ text: string }>(answer).text).not.toContain("clapper");
    const [job] = await talkJobs(w);
    expect(job?.result).toMatchObject({ talk: { answered: true } });
  });

  it("a stale suggest (a later post during the read) is refused and recorded as interrupted", async () => {
    const { w } = await table([]);
    await say(w, "I slip behind the barrels.");
    const first = (await w.projections()).throughSeq;
    await say(w, "Actually, I wait here instead.");
    const out = await readAt(w, first, { react: confirmReact() });
    expect(out).toMatchObject({ status: "talk", shipped: false });
    expect(out.status === "talk" && out.talk.outcome).toBe("interrupted");
    expect(await suggested(w)).toHaveLength(0);
  });

  it("a reclaim ships the confirm once", async () => {
    const { w } = await table([]);
    await say(w, "I slip behind the barrels.");
    const seq = (await w.projections()).throughSeq;
    await readAt(w, seq, { react: confirmReact(), attempt: 1 });
    await readAt(w, seq, { react: confirmReact(), attempt: 2 });
    expect(await suggested(w)).toHaveLength(1);
  });

  it("a confirm item for an absent character is dropped", async () => {
    const { w } = await table([]);
    await say(w, "Kestrel hides.");
    const seq = (await w.projections()).throughSeq;
    const out = await readAt(w, seq, {
      react: confirmReact({
        confirm: [
          { characterId: "nobody", text: "Nobody hides", body: hideBody },
        ],
      }),
    });
    expect(out.status === "talk" && out.talk.confirmItems).toBe(0);
    expect(await suggested(w)).toHaveLength(0);
    expect(KESTREL).toBe("kestrel");
  });
});

describe.skipIf(!reachable)("react confirm targets replay (spec 114)", () => {
  const searchReact = (target: unknown) =>
    confirmReact({
      confirm: [
        {
          characterId: "tamsin",
          text: "Tamsin searches the ferry house.",
          body: { kind: "search", targets: [target], params: {} },
        },
      ],
    });

  it.each([
    ["attempt 1 body (bare id)", "ferry-house"],
    ["attempt 2 body (id only)", { id: "ferry-house" }],
  ])(
    "repairs the %s in one call and ships a zone target",
    async (_n, target) => {
      const { w, worker } = await table([
        {
          purpose: "dm.narrate",
          respond: { type: "json", value: searchReact(target) },
        },
      ]);
      await say(w, "I search the ferry house");
      await drainAll(worker);
      const sug = await suggested(w);
      expect(sug).toHaveLength(1);
      const pl = payloadOf<{
        items: { intent: { kind: string; targets: unknown[] } }[];
      }>(sug[0]);
      expect(pl.items[0]?.intent).toMatchObject({
        kind: "search",
        targets: [{ kind: "zone", id: "ferry-house" }],
      });
      const [job] = await talkJobs(w);
      expect(job?.result).toMatchObject({
        talk: { outcome: "confirm", confirmItems: 1, targetRepairs: 1 },
      });
      expect(job?.result).toMatchObject({ calls: [expect.anything()] });
    },
  );
});

describe.skipIf(!reachable)("react confirm params replay (spec 116)", () => {
  it.each([
    ["F1 attempt 1", RECONSTRUCTED_F1, ["skill"]],
    ["F1 attempt 2", RECONSTRUCTED_F1_RETRY, []],
    ["F2 attempt 1", RECONSTRUCTED_F2, ["ready", "caution"]],
    ["F2 attempt 2", RECONSTRUCTED_F2_RETRY, []],
  ])(
    "%s ships a move to the causeway with params {} in one call",
    async (_n, fixture, keys) => {
      const { w, worker } = await table([
        { purpose: "dm.narrate", respond: { type: "json", value: fixture } },
      ]);
      await say(w, "I wade out onto the causeway");
      await drainAll(worker);
      const sug = await suggested(w);
      expect(sug).toHaveLength(1);
      const pl = payloadOf<{
        items: {
          intent: { kind: string; targets: unknown[]; params: unknown };
        }[];
      }>(sug[0]);
      expect(pl.items[0]?.intent).toMatchObject({
        kind: "move",
        targets: [{ kind: "zone", id: "causeway" }],
        params: {},
      });
      const [job] = await talkJobs(w);
      expect(job?.result).toMatchObject({ calls: [expect.anything()] });
      const res = job?.result as {
        check?: { stripped?: { key: string }[] };
      };
      const stripped = res.check?.stripped;
      expect((stripped ?? []).map((s) => s.key)).toEqual(keys);
    },
  );
});
