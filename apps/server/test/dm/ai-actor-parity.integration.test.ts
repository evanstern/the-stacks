import { type Intent, IntentSchema, parse, toText } from "@the-stacks/intent";
import { afterAll, describe, expect, it } from "vitest";
import { runCompanionJob } from "../../src/dm/companion.js";
import { enqueueTurn } from "../../src/dm/jobs.js";
import { stampIntent } from "../../src/dm/nodes/interpret.js";
import {
  COMPANION_TURN_KINDS,
  type CompanionIntentBody,
} from "../../src/dm/nodes/schemas.js";
import { loadSeed } from "../../src/dm/seed/load.js";
import {
  cmd,
  fresh,
  initDice,
  nextJob,
  run,
  turnInto,
} from "./encounter-lifecycle.js";
import { clearDmJobsBeforeEach, drainAll, workerFor } from "./worker-world.js";
import {
  createWorld,
  db,
  loudSkip,
  player,
  reachable,
  readRows,
  requireDb,
  startScene,
  type World,
} from "./world.js";

/**
 * Spec 107 US-3 (TASK-0299): AI-actor Intents meet the same gate and planner as a player's.
 * Strict fake gateway: no `dm.interpret` is scripted, so an interpret call fails the job.
 * US-2 #2 (move then attack) stays unit-tested: every seed monster has a ranged entry.
 */
loudSkip("ai-actor-parity.integration.test.ts");
afterAll(async () => {
  await db?.$client.end();
});
clearDmJobsBeforeEach();

type Row = Awaited<ReturnType<typeof readRows>>[number];
const pay = <T>(r: Row) => r.payload as T;
type Carrier = {
  intent: { id: string; kind: string; actor: { kind: string; id: string } };
  outcome: string;
  batchId: string | null;
  stopped: { code: string } | null;
  answers: string | null;
};
const carriers = async (w: World) =>
  (await readRows(w))
    .filter((r) => r.type === "intent.recorded")
    .map((r) => pay<Carrier>(r));
const resolved = async (w: World) =>
  (await readRows(w))
    .filter((r) => r.type === "action.resolved")
    .map((r) => pay<{ outcome: string; code?: string }>(r));
const purposes = (w: World) =>
  w.scripted.provider.chatCalls.map((c) => c.request.purpose);

const json = (purpose: string, value: unknown) => ({
  purpose,
  respond: { type: "json", value },
});
const text = (purpose: string, value: string) => ({
  purpose,
  respond: { type: "text", value },
});
const narrate = text("dm.narrate", "The fight turns.");
const chronicle = [1, 2, 3].map(() => json("dm.chronicle", { entries: [] }));
const director = json("dm.director", {
  beat: { decision: "resolve" },
  tableMode: { to: "stay" },
  trackers: [],
  scene: { status: "continue" },
  pacing: { tension: "high", spotlight: null, beatId: null },
  goalNote: "",
  companionPrompts: [],
});
const companionReply = (turn: unknown) =>
  json("dm.companion", {
    say: null,
    comment: null,
    act: null,
    pending: [],
    turn,
  });

// ------------------------------------------------------------------ companion source

const lastLogs: unknown[][] = [];
let lastRun: unknown; // TASK-0333 AC1: the job's plays, shown when an assertion fails
let lastPurposes: unknown[] = [];
async function odoTurn(
  turn: unknown,
  opts: { inReach: boolean; extra?: unknown[] },
) {
  const w = await createWorld({
    dice: [15, 4, 4, 4, 4, 4, 4, 4],
    calls: [
      companionReply(turn),
      director,
      ...(opts.extra ?? []),
      narrate,
      ...chronicle,
    ],
  });
  await startScene(w);
  const res = await w.gate.submit(
    w.sessionId,
    { kind: "ai", actor: "ai:dm" },
    {
      kind: "table-mode",
      summary: null,
      rationale: null,
      reason: "Test: Odo's turn.",
      after: {
        mode: "turn",
        activeActor: "ai:companion:odo",
        activeCharacterId: "odo",
      },
    },
  );
  if (!res.ok) throw new Error(`table-mode refused: ${res.refusal.code}`);
  if (opts.inReach) {
    // goblin-2 starts in the reed camp; Odo walks there by DM placement.
    await cmd(w, {
      type: "combatant.place",
      combatantId: "odo",
      zoneId: "reed-camp",
    });
  }
  const { worker } = workerFor(w);
  const base = w.ctx().deps;
  lastLogs.length = 0; // TASK-0333 AC1: surface why a companion play was skipped
  lastRun = await runCompanionJob(
    {
      gateway: base.gateway,
      gate: base.gate,
      loadProjections: base.loadProjections,
      loadSeed: (id: string) => loadSeed(id),
      enqueueTurnForced: async () => {},
      fence: async () => true,
      log: (...a: unknown[]) => void lastLogs.push(a),
    },
    {
      id: "00000000-0000-4000-8000-0000000000c9",
      input: {
        v: 1 as const,
        sessionId: w.sessionId,
        companions: ["odo"],
        reason: "turn",
        beatJobId: null,
      },
    },
    new AbortController().signal,
  );
  const afterJob = purposes(w);
  await drainAll(worker);
  lastPurposes = [afterJob, purposes(w)];
  return w;
}
const attackOdo = [
  {
    kind: "attack",
    targets: [{ kind: "actor", id: "goblin-2" }],
    params: { weapon: "Mace" },
  },
];

describe.skipIf(!reachable)(
  "AI actor parity: companion source (database)",
  () => {
    it("attack in reach: settled with a batch, declared and confirmed under the companion actor", async () => {
      const w = await odoTurn(attackOdo, { inReach: true });
      const c = await carriers(w);
      expect(c.map((x) => x.outcome)).toEqual(["declared", "settled"]);
      expect(c[1]?.batchId).not.toBeNull();
      expect(c.every((x) => x.intent.actor.id === "odo")).toBe(true);
      expect(purposes(w)).not.toContain("dm.interpret");
    });

    it("attack out of reach: refused OUT_OF_REACH, the action resolves refused", async () => {
      const w = await odoTurn(attackOdo, { inReach: false });
      const c = await carriers(w);
      expect(c.at(-1)?.stopped?.code).toBe("OUT_OF_REACH");
      expect((await resolved(w)).length).toBe(1);
      expect(purposes(w)).not.toContain("dm.interpret");
    });

    it("attempt: needs_ruling, then the AI seat answers it in the same job", async () => {
      const w = await odoTurn(
        [
          {
            kind: "attempt",
            targets: [],
            params: {},
            text: "Odo rolls a barrel at the goblins.",
          },
        ],
        {
          inReach: false,
          extra: [
            json("dm.adjudicate", {
              decision: "accept",
              reason: "The barrel rolls.",
            }),
          ],
        },
      );
      const c = await carriers(w);
      expect(
        c.map((x) => x.outcome),
        JSON.stringify({
          logs: lastLogs,
          plays: lastRun,
          purposes: lastPurposes,
        }),
      ).toEqual(["declared", "needs_ruling", "settled"]);
      expect(c[2]?.answers).toBe(c[1]?.intent.id);
    });

    it("an item stamped with another character's actor is refused NOT_YOUR_ACTOR", async () => {
      const w = await createWorld({ dice: [] });
      await startScene(w);
      const intent = IntentSchema.parse({
        id: "hand-1",
        kind: "attack",
        targets: [{ kind: "actor", id: "goblin-2" }],
        params: { weapon: "Mace" },
        actor: { kind: "companion", id: "kestrel" },
        source: "ai",
        commit: "declared",
      });
      const res = await w.gate.submit(
        w.sessionId,
        { kind: "ai", actor: "ai:companion:odo" },
        { kind: "intent", intent } as never,
      );
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.refusal.code).toBe("NOT_YOUR_ACTOR");
    });
  },
);

// ------------------------------------------------------------------ monster source

const DM = { kind: "ai", actor: "ai:dm" } as const;
void DM;

async function monsterFight(calls: unknown[], dice: number[]) {
  const w = await createWorld({ dice, calls: [...calls, ...chronicle] });
  await startScene(w);
  await run(w, { director: turnInto(), job: nextJob() });
  fresh(w);
  return w;
}
const monsterJob = async (w: World) => {
  const { worker } = workerFor(w);
  await enqueueTurn(requireDb(), w.sessionId, "npc-turn", null);
  await worker.processOne();
  return worker;
};

describe.skipIf(!reachable)(
  "AI actor parity: monster source (database)",
  () => {
    // Snag acts first. The encounter starts with everyone in the reed camp.
    const place = (w: World, zoneId: string) =>
      cmd(w, { type: "combatant.place", combatantId: "snag", zoneId });
    const dice = [...initDice(3), 15, 4, 4, 4];

    it("attack in reach: settled with a batch under the npc actor; no director or interpret call", async () => {
      const w = await monsterFight([narrate], dice);
      await monsterJob(w);
      const c = await carriers(w);
      // an npc stage carries one confirmed row: it needs no declare step
      expect(c.map((x) => x.outcome)).toEqual(["settled"]);
      expect(c[0]?.batchId).not.toBeNull();
      expect(c[0]?.intent.actor.kind).toBe("npc");
      expect(purposes(w)).not.toContain("dm.director");
      expect(purposes(w)).not.toContain("dm.interpret");
    });

    it("attack out of range: refused, no carrier row appended, the turn advances", async () => {
      const w = await monsterFight([narrate], dice);
      await place(w, "near-bank");
      await monsterJob(w);
      expect(await carriers(w)).toEqual([]);
      expect((await readRows(w)).some((r) => r.type === "turn.advanced")).toBe(
        true,
      );
      expect(purposes(w)).not.toContain("dm.interpret");
    });

    it("US-2 #6: a free-scope player item in the beat runs director and interpret for that item only", async () => {
      const w = await monsterFight(
        [
          director,
          json("dm.interpret", {
            readings: [
              {
                actionId: "act-look",
                stages: [],
                clarify: null,
                followUps: [],
              },
            ],
          }),
          narrate,
        ],
        dice,
      );
      const declared = await w.as(player, {
        kind: "action.declare",
        action: {
          actionId: "act-look",
          characterId: "tamsin",
          scope: "party",
          text: "We watch the goblins.",
        },
      });
      if (!declared.ok) throw new Error(`declare: ${declared.refusal.code}`);
      const committed = await w.as(player, {
        kind: "action.commit",
        actionId: "act-look",
      });
      if (!committed.ok) throw new Error(`commit: ${committed.refusal.code}`);
      const { worker } = workerFor(w, { listen: false });
      await enqueueTurn(requireDb(), w.sessionId, "npc-turn", null);
      await worker.processOne();
      const used = purposes(w);
      expect(used.filter((x) => x === "dm.interpret")).toHaveLength(1);
      expect(used.filter((x) => x === "dm.director")).toHaveLength(1);
      // the monster reading is still code-built: an npc attack landed
      const c = await carriers(w);
      expect(
        c.some(
          (x) => x.intent.actor.kind === "npc" && x.intent.kind === "attack",
        ),
      ).toBe(true);
    });
  },
);

// ------------------------------------------------------------------ schema and round trip

describe("AI actor parity: schema and round trip", () => {
  const bodies: Record<string, CompanionIntentBody> = {
    attack: {
      kind: "attack",
      targets: [{ kind: "actor", id: "goblin-2" }],
      params: { weapon: "Mace", mode: "normal" },
    },
    cast: {
      kind: "cast",
      targets: [{ kind: "actor", id: "tamsin" }],
      params: { spell: "cure-wounds", mode: "normal" },
    },
    help: {
      kind: "help",
      targets: [{ kind: "actor", id: "tamsin" }],
      params: { assist: { kind: "attack" } },
    },
    grapple: {
      kind: "grapple",
      targets: [{ kind: "actor", id: "goblin-2" }],
      params: {},
    },
    shove: {
      kind: "shove",
      targets: [{ kind: "actor", id: "goblin-2" }],
      params: { effect: "prone" },
    },
    move: {
      kind: "move",
      targets: [{ kind: "zone", id: "near-bank" }],
      params: {},
    },
    dash: { kind: "dash", targets: [], params: {} },
    disengage: { kind: "disengage", targets: [], params: {} },
    stand: { kind: "stand", targets: [], params: {} },
    drop_prone: { kind: "drop_prone", targets: [], params: {} },
    attempt: {
      kind: "attempt",
      targets: [],
      params: { scope: "character" },
      text: "Odo rolls a barrel.",
    },
  } as never;

  it("covers every companion turn kind", () => {
    expect(Object.keys(bodies).sort()).toEqual(
      [...COMPANION_TURN_KINDS].sort(),
    );
  });

  for (const [kind, body] of Object.entries(bodies)) {
    it(`${kind}: a stamped Intent parses and parse(toText(i)) equals i`, () => {
      const actors: Intent["actor"][] = [{ kind: "companion", id: "odo" }];
      if (kind === "attack" || kind === "move")
        actors.push({ kind: "npc", id: "snag" });
      for (const actor of actors) {
        const stamp = {
          id: "a.0",
          actor,
          source: "ai",
          commit: "declared",
        } as const;
        const s = stampIntent(body, stamp);
        expect(s.ok).toBe(true);
        if (!s.ok) return;
        const again = parse(toText(s.intent), stamp);
        expect(again.ok).toBe(true);
        if (again.ok) expect(again.intent satisfies Intent).toEqual(s.intent);
      }
    });
  }
});
