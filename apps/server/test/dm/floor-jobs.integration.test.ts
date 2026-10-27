import type { Proposer } from "@the-stacks/session-model";
import { afterAll, describe, expect, it } from "vitest";
import { type FloorDeps, runFloorJob } from "../../src/dm/floor.js";
import {
  enqueueFloorCheck,
  type FloorJobInput,
  listDmJobs,
} from "../../src/dm/jobs.js";
import type { PresenceReader } from "../../src/presence/index.js";
import {
  clearDmJobsBeforeEach,
  script,
  tick,
  workerFor,
} from "./worker-world.js";
import {
  createWorld,
  db,
  HUMAN_DM,
  loudSkip,
  operator,
  player,
  reachable,
  readRows,
  requireDb,
  startScene,
  TAMSIN_USER,
  type World,
} from "./world.js";

/**
 * The `floor` job kind (specs/049-turn-floor Phase 5, FR-013 to FR-018, FR-025): the AI DM
 * passes an absent human's turn after the wait and commits a stalled party action after the
 * window, in code. Presence is a mutable reader and the waits are injected, so no test sleeps.
 */

loudSkip("floor-jobs.integration.test.ts");
afterAll(async () => {
  await db?.$client.end();
});
clearDmJobsBeforeEach();

const BRAM_USER = "00000000-0000-4000-8000-0000000000a2";
const bram: Proposer = { kind: "human", userId: BRAM_USER, role: "player" };
const aiDm: Proposer = { kind: "ai", actor: "ai:dm" };

/** A presence reader the test moves: the injected clock for "who is at the table". */
function crowd(initial: string[]) {
  let present = [...initial];
  const reader: PresenceReader = {
    presentUsers: () =>
      present.map((userId) => ({ userId, displayName: userId })),
    isPresent: (_sessionId, actor) =>
      actor.startsWith("ai:") || present.includes(actor),
    onChange: () => () => {},
  };
  return {
    reader,
    set(ids: string[]) {
      present = [...ids];
    },
  };
}

/** Two human seats (Ana on Tamsin, Bram on Kestrel), a companion, one goblin; Ana holds the floor. */
async function floorWorld(presence: PresenceReader): Promise<World> {
  const s = script("turn-floor-round.json");
  const w = await createWorld({ dice: s.dice, calls: [], presence });
  await startScene(w);
  const { result } = await w.runResolve({
    director: {
      tableMode: { to: "turn", encounterId: "reed-camp", reason: "Fight." },
    },
    job: { id: "00000000-0000-4000-8000-000000000a60" },
  });
  if (!result.ok) throw new Error(`turn mode failed: ${result.error.message}`);
  const p0 = await w.projections();
  const kestrel = p0.party.find((m) => m.characterId === "kestrel");
  if (!kestrel) throw new Error("no kestrel");
  const party = await w.as(aiDm, {
    kind: "party",
    reason: "Bram takes Kestrel",
    characterId: "kestrel",
    after: {
      characterId: "kestrel",
      name: kestrel.name,
      controller: { kind: "player", userId: BRAM_USER },
      combatantId: kestrel.combatantId,
    },
  });
  if (!party.ok) throw new Error(`party refused: ${party.refusal.code}`);
  return w;
}

const floorJobs = (w: World) =>
  listDmJobs(requireDb(), w.sessionId, 20, "floor");
const resultOf = (job: { result: unknown } | undefined) =>
  job?.result as {
    outcome: string;
    seqs: number[];
    refusal?: { code: string };
  };

function directDeps(w: World, presence: PresenceReader): FloorDeps {
  return {
    db: requireDb(),
    gate: w.gate,
    loadProjections: () => w.projections(),
    presence,
    log: () => {},
  };
}

const absenceInput = (w: World, holder: string): FloorJobInput => ({
  v: 1,
  sessionId: w.sessionId,
  check: "absence",
  actionId: null,
  holder,
  stanceSeq: null,
  notBefore: new Date().toISOString(),
});

const stallInput = (
  w: World,
  actionId: string,
  stanceSeq: number | null,
): FloorJobInput => ({
  v: 1,
  sessionId: w.sessionId,
  check: "stall",
  actionId,
  holder: null,
  stanceSeq,
  notBefore: new Date().toISOString(),
});

async function declareParty(w: World, actionId: string) {
  const declared = await w.as(player, {
    kind: "action.declare",
    action: {
      actionId,
      characterId: null,
      scope: "party",
      text: "The party crosses the ford together.",
    },
  });
  if (!declared.ok)
    throw new Error(`declare refused: ${declared.refusal.code}`);
}

describe.skipIf(!reachable)("floor jobs (database)", () => {
  it("passes an absent active human after the wait and logs the present set", async () => {
    const c = crowd([BRAM_USER]);
    const w = await floorWorld(c.reader);
    const { worker, enqueuer } = workerFor(w, {
      presence: c.reader,
      floorAbsenceWaitMs: 0,
    });
    expect((await w.projections()).tableMode).toMatchObject({
      activeActor: TAMSIN_USER,
    });

    await enqueuer.onPresenceChange(w.sessionId);
    const queued = await floorJobs(w);
    expect(queued).toHaveLength(1);
    expect(queued[0]?.input).toMatchObject({
      check: "absence",
      holder: TAMSIN_USER,
    });

    expect(await worker.processOne()).toBe(true);
    const [job] = await floorJobs(w);
    expect(job?.status).toBe("succeeded");
    expect(resultOf(job).outcome).toBe("passed");
    expect(resultOf(job).seqs.length).toBeGreaterThan(1);

    const after = await w.projections();
    expect(after.tableMode).toMatchObject({
      activeActor: BRAM_USER,
      activeCharacterId: "kestrel",
    });
    const rows = await readRows(w);
    const marker = rows.find(
      (r) =>
        r.type === "presence.recorded" &&
        (r.payload as { purpose?: string }).purpose === "floor",
    );
    expect(marker?.payload).toMatchObject({ present: [BRAM_USER] });
    const mode = rows.filter((r) => r.type === "table-mode.changed").at(-1);
    expect(mode?.actor).toBe("ai:dm");
    // The marker comes first in the batch that moves the floor.
    expect((marker?.seq ?? 0) < (mode?.seq ?? 0)).toBe(true);
  });

  it("does nothing when the human returns inside the wait", async () => {
    const c = crowd([BRAM_USER]);
    const w = await floorWorld(c.reader);
    const { worker, enqueuer } = workerFor(w, {
      presence: c.reader,
      floorAbsenceWaitMs: 0,
    });
    await enqueuer.onPresenceChange(w.sessionId);
    expect(await floorJobs(w)).toHaveLength(1);
    const before = (await readRows(w)).length;

    c.set([TAMSIN_USER, BRAM_USER]);
    expect(await worker.processOne()).toBe(true);
    const [job] = await floorJobs(w);
    expect(resultOf(job).outcome).toBe("noop");
    expect((await w.projections()).tableMode).toMatchObject({
      activeActor: TAMSIN_USER,
    });
    expect(await readRows(w)).toHaveLength(before);
  });

  it("never passes a present human", async () => {
    const c = crowd([TAMSIN_USER, BRAM_USER]);
    const w = await floorWorld(c.reader);
    const { worker, enqueuer } = workerFor(w, {
      presence: c.reader,
      floorAbsenceWaitMs: 0,
    });
    await enqueuer.onPresenceChange(w.sessionId);
    expect(await floorJobs(w)).toHaveLength(0);

    // Even an armed job stands down when the holder is present at the run.
    await enqueueFloorCheck(
      requireDb(),
      {
        sessionId: w.sessionId,
        check: "absence",
        actionId: null,
        holder: TAMSIN_USER,
        stanceSeq: null,
      },
      0,
    );
    const before = (await readRows(w)).length;
    expect(await worker.processOne()).toBe(true);
    expect(resultOf((await floorJobs(w))[0]).outcome).toBe("noop");
    expect(await readRows(w)).toHaveLength(before);
  });

  it("acts only if the absence it was armed for has not changed", async () => {
    const c = crowd([]);
    const w = await floorWorld(c.reader);
    // The job was armed for Bram, but Ana holds the floor now and she is absent.
    const result = await runFloorJob(directDeps(w, c.reader), {
      id: "00000000-0000-4000-8000-000000000f01",
      input: absenceInput(w, BRAM_USER),
    });
    expect(result.outcome).toBe("noop");
    expect((await w.projections()).tableMode).toMatchObject({
      activeActor: TAMSIN_USER,
    });
  });

  it("commits a stalled party action with a signoff marker", async () => {
    const c = crowd([TAMSIN_USER, BRAM_USER]);
    const w = await floorWorld(c.reader);
    const { worker } = workerFor(w, {
      presence: c.reader,
      floorStallWindowMs: 0,
    });
    await declareParty(w, "act-party");
    await tick();
    const queued = await floorJobs(w);
    expect(queued).toHaveLength(1);
    expect(queued[0]?.input).toMatchObject({
      check: "stall",
      actionId: "act-party",
    });

    expect(await worker.processOne()).toBe(true);
    const [job] = await floorJobs(w);
    expect(resultOf(job).outcome).toBe("committed");

    const rows = await readRows(w);
    const committed = rows.find((r) => r.type === "action.committed");
    expect(committed).toMatchObject({
      actor: "ai:dm",
      payload: { actionId: "act-party", authority: "dm" },
    });
    const marker = rows.find(
      (r) =>
        r.type === "presence.recorded" &&
        (r.payload as { purpose?: string }).purpose === "signoff",
    );
    expect(marker?.payload).toMatchObject({
      actionId: "act-party",
      present: [TAMSIN_USER, BRAM_USER].sort(),
    });
    expect((marker?.seq ?? 0) < (committed?.seq ?? 0)).toBe(true);
  });

  it("commits nothing while a present member objects", async () => {
    const c = crowd([TAMSIN_USER, BRAM_USER]);
    const w = await floorWorld(c.reader);
    const { worker } = workerFor(w, {
      presence: c.reader,
      floorStallWindowMs: 0,
    });
    await declareParty(w, "act-party");
    const objected = await w.as(bram, {
      kind: "action.comment",
      comment: { actionId: "act-party", stance: "object", text: "No." },
    });
    expect(objected.ok).toBe(true);
    await tick();
    // The comment re-armed the one queued stall check.
    expect(await floorJobs(w)).toHaveLength(1);

    expect(await worker.processOne()).toBe(true);
    expect(resultOf((await floorJobs(w))[0]).outcome).toBe("noop");
    expect((await readRows(w)).some((r) => r.type === "action.committed")).toBe(
      false,
    );
  });

  it("restarts the window on a stance change", async () => {
    const c = crowd([TAMSIN_USER, BRAM_USER]);
    const w = await floorWorld(c.reader);
    const { enqueuer } = workerFor(w, {
      presence: c.reader,
      floorStallWindowMs: 120_000,
    });
    void enqueuer;
    await declareParty(w, "act-party");
    await tick();
    const [armed] = await floorJobs(w);
    const armedAt = Date.parse(
      ((armed?.input ?? {}) as { notBefore: string }).notBefore,
    );

    const commented = await w.as(bram, {
      kind: "action.comment",
      comment: {
        actionId: "act-party",
        stance: "comment",
        text: "Let me think.",
      },
    });
    if (!commented.ok) throw new Error("comment refused");
    await tick();
    const rows = await floorJobs(w);
    expect(rows).toHaveLength(1);
    const input = rows[0]?.input as { notBefore: string; stanceSeq: number };
    expect(Date.parse(input.notBefore)).toBeGreaterThan(armedAt);
    expect(input.stanceSeq).toBe(commented.events.at(-1)?.seq);
  });

  it("acts only if no stance changed since the stall was armed", async () => {
    const c = crowd([TAMSIN_USER, BRAM_USER]);
    const w = await floorWorld(c.reader);
    await declareParty(w, "act-party");
    const commented = await w.as(bram, {
      kind: "action.comment",
      comment: { actionId: "act-party", stance: "comment", text: "Hold on." },
    });
    if (!commented.ok) throw new Error("comment refused");
    // A job armed before Bram's comment runs after it: the window restarted, so it stands down.
    const stale = await runFloorJob(directDeps(w, c.reader), {
      id: "00000000-0000-4000-8000-000000000f02",
      input: stallInput(w, "act-party", 0),
    });
    expect(stale.outcome).toBe("noop");
    expect((await readRows(w)).some((r) => r.type === "action.committed")).toBe(
      false,
    );
    // The same job armed for the latest stance commits.
    const fresh = await runFloorJob(directDeps(w, c.reader), {
      id: "00000000-0000-4000-8000-000000000f03",
      input: stallInput(w, "act-party", commented.events.at(-1)?.seq ?? 0),
    });
    expect(fresh.outcome).toBe("committed");
  });

  it("cancels the stall check when the action is committed or withdrawn", async () => {
    const c = crowd([TAMSIN_USER, BRAM_USER]);
    const w = await floorWorld(c.reader);
    workerFor(w, { presence: c.reader, floorStallWindowMs: 120_000 });
    await declareParty(w, "act-a");
    await declareParty(w, "act-b");
    await tick();
    expect(await floorJobs(w)).toHaveLength(2);
    const withdrawn = await w.as(player, {
      kind: "action.withdraw",
      actionId: "act-a",
    });
    expect(withdrawn.ok).toBe(true);
    await tick();
    const left = await floorJobs(w);
    expect(left).toHaveLength(1);
    expect(left[0]?.input).toMatchObject({ actionId: "act-b" });
  });

  it("finishes skipped under a human DM seat", async () => {
    const c = crowd([BRAM_USER]);
    const w = await floorWorld(c.reader);
    const seat = await w.as(operator, {
      kind: "dm.seat",
      reason: "A human takes the DM seat",
      after: { kind: "human", userId: HUMAN_DM },
    });
    expect(seat.ok).toBe(true);
    const before = (await readRows(w)).length;
    const result = await runFloorJob(directDeps(w, c.reader), {
      id: "00000000-0000-4000-8000-000000000f04",
      input: absenceInput(w, TAMSIN_USER),
    });
    expect(result.outcome).toBe("skipped");
    expect(await readRows(w)).toHaveLength(before);
  });

  it("arms no wait under a human DM seat", async () => {
    const c = crowd([BRAM_USER]);
    const w = await floorWorld(c.reader);
    const seat = await w.as(operator, {
      kind: "dm.seat",
      reason: "A human takes the DM seat",
      after: { kind: "human", userId: HUMAN_DM },
    });
    expect(seat.ok).toBe(true);
    const { enqueuer } = workerFor(w, {
      presence: c.reader,
      floorAbsenceWaitMs: 0,
    });
    await enqueuer.onPresenceChange(w.sessionId);
    expect(await floorJobs(w)).toHaveLength(0);
  });

  it("re-arms after a restart", async () => {
    const c = crowd([BRAM_USER]);
    const w = await floorWorld(c.reader);
    await declareParty(w, "act-party");
    // No enqueuer listens: the process "restarted" and lost its in-memory arms.
    expect(await floorJobs(w)).toHaveLength(0);
    const { worker } = workerFor(w, {
      presence: c.reader,
      floorAbsenceWaitMs: 60_000,
      floorStallWindowMs: 120_000,
    });
    await worker.reconcile();
    const rows = await floorJobs(w);
    expect(
      rows.map((r) => (r.input as { check: string }).check).sort(),
    ).toEqual(["absence", "stall"]);
    expect(
      rows.find((r) => (r.input as { check: string }).check === "absence")
        ?.input,
    ).toMatchObject({ holder: TAMSIN_USER });
    // A second reconcile adds nothing.
    await worker.reconcile();
    expect(await floorJobs(w)).toHaveLength(2);
  }, 30_000);

  it("queues the new holder's follow-up after an absence pass", async () => {
    // Ana absent, Bram absent too: after Ana is passed the floor sits on Bram, who is armed next.
    const c = crowd([]);
    const w = await floorWorld(c.reader);
    const { worker, enqueuer } = workerFor(w, {
      presence: c.reader,
      floorAbsenceWaitMs: 0,
    });
    await enqueuer.onPresenceChange(w.sessionId);
    expect(await worker.processOne()).toBe(true);
    await tick();
    expect((await w.projections()).tableMode).toMatchObject({
      activeActor: BRAM_USER,
    });
    const next = (await floorJobs(w)).filter((j) => j.status === "queued");
    expect(next).toHaveLength(1);
    expect(next[0]?.input).toMatchObject({
      check: "absence",
      holder: BRAM_USER,
    });
  });
});
