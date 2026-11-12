import { randomUUID } from "node:crypto";
import type {
  SessionProjections,
  StoredEvent,
} from "@the-stacks/session-model";
import { sql } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { createDmEnqueuer } from "../../src/dm/enqueue.js";
import { enqueueTurn, interruptRead, listDmJobs } from "../../src/dm/jobs.js";
import { greyhollowDuo, PLAYER_USER } from "./snapshot-fixtures.js";
import { clearDmJobsBeforeEach } from "./worker-world.js";
import { db, loudSkip, reachable, requireDb } from "./world.js";

/** Rule 6 (spec 066 FR-006, FR-007, FR-008): a readable post queues or moves a coalesced talk turn. */

loudSkip("enqueue-talk.integration.test.ts");
afterAll(async () => {
  await db?.$client.end();
});
clearDmJobsBeforeEach();

const POST_TS = "2026-11-11T00:00:00.000Z";
let n = 0;

interface PostOpts {
  kind?: "say" | "ooc" | "ask_dm" | "hide";
  actor?: string;
  ts?: string;
  text?: string;
}

/** Adds a post (a `talk` transcript row at seq-1 and its Intent at seq) to the projections; returns its rows. */
function post(p: SessionProjections, o: PostOpts = {}): StoredEvent[] {
  const kind = o.kind ?? "say";
  const actor = o.actor ?? PLAYER_USER;
  const text = o.text ?? "Wenna, hello there?";
  const seq = ++n * 2 + 10;
  const ts = o.ts ?? POST_TS;
  p.transcript.push({
    seq: seq - 1,
    ts,
    actor,
    visibility: "public",
    kind: "talk",
    text,
    channel: kind === "ooc" || kind === "ask_dm" ? "ooc" : "ic",
    characterId: "tamsin",
  } as never);
  p.intents.push({
    id: `i-${seq}`,
    seq,
    ts,
    actor,
    intent: {
      id: `i-${seq}`,
      kind,
      actor: { kind: "pc", id: "tamsin" },
      targets: [],
      params: {},
      text,
      source: "composer",
      commit: "declared",
    },
    status: kind === "hide" ? "declared" : "settled",
    request: null,
    batchIds: [],
    proposalId: null,
  } as never);
  const base = { sessionId: "", payloadVersion: 1, visibility: "public", ts };
  return [
    {
      ...base,
      seq: seq - 1,
      actor,
      type: "talk",
      payload: { text, channel: "ic", characterId: "tamsin" },
    },
    {
      ...base,
      seq,
      actor,
      type: "intent.recorded",
      payload: { outcome: "settled", batchId: null, stopped: null },
    },
  ] as unknown as StoredEvent[];
}

function setup(mutate: (p: SessionProjections) => void = () => {}) {
  const sessionId = randomUUID();
  const { projections, seed } = greyhollowDuo();
  projections.gate = {
    ...projections.gate,
    seat: { kind: "ai" },
  } as typeof projections.gate;
  mutate(projections);
  const enqueuer = createDmEnqueuer({
    db: requireDb(),
    nudge: () => {},
    loadProjections: async () => projections,
    loadSeed: () => seed,
  });
  const turnJobs = () => listDmJobs(requireDb(), sessionId, 20, "turn");
  const companionJobs = () =>
    listDmJobs(requireDb(), sessionId, 20, "companion");
  return { sessionId, enqueuer, turnJobs, companionJobs, p: projections };
}

const notBeforeMs = (input: unknown) =>
  Date.parse((input as { notBefore: string }).notBefore);

describe.skipIf(!reachable)("talk enqueue (database)", () => {
  it("a say Intent queues a talk turn at its ts plus 10 s", async () => {
    const { sessionId, enqueuer, turnJobs, p } = setup();
    const rows = post(p);
    await enqueuer.onAppended(sessionId, rows);
    const jobs = await turnJobs();
    expect(jobs).toHaveLength(1);
    expect(jobs[0]?.input).toMatchObject({ trigger: "talk" });
    expect(notBeforeMs(jobs[0]?.input)).toBe(Date.parse(POST_TS) + 10_000);
  });

  it("a second post moves the one queued turn: seq and notBefore follow the later post", async () => {
    const { sessionId, enqueuer, turnJobs, p } = setup();
    await enqueuer.onAppended(sessionId, post(p, { ts: POST_TS }));
    const later = new Date(Date.parse(POST_TS) + 4000).toISOString();
    const second = post(p, { ts: later });
    await enqueuer.onAppended(sessionId, second);
    const jobs = await turnJobs();
    expect(jobs).toHaveLength(1);
    expect(jobs[0]?.input).toMatchObject({
      trigger: "talk",
      triggerSeq: second[0]?.seq,
    });
    expect(notBeforeMs(jobs[0]?.input)).toBe(Date.parse(later) + 10_000);
  });

  it("has no cap: after 12 posts notBefore still follows the last", async () => {
    const { sessionId, enqueuer, turnJobs, p } = setup();
    let last = POST_TS;
    for (let i = 0; i < 12; i++) {
      last = new Date(Date.parse(POST_TS) + i * 5000).toISOString();
      await enqueuer.onAppended(sessionId, post(p, { ts: last }));
    }
    const jobs = await turnJobs();
    expect(jobs).toHaveLength(1);
    expect(notBeforeMs(jobs[0]?.input)).toBe(Date.parse(last) + 10_000);
  });

  it("an ooc post leaves the queued notBefore unchanged", async () => {
    const { sessionId, enqueuer, turnJobs, p } = setup();
    await enqueuer.onAppended(sessionId, post(p));
    const before = notBeforeMs((await turnJobs())[0]?.input);
    await enqueuer.onAppended(
      sessionId,
      post(p, {
        kind: "ooc",
        ts: new Date(Date.parse(POST_TS) + 3000).toISOString(),
      }),
    );
    expect(notBeforeMs((await turnJobs())[0]?.input)).toBe(before);
  });

  it("an ask_dm is read, in turn mode at its own ts (window 0)", async () => {
    const { sessionId, enqueuer, turnJobs, p } = setup((x) => {
      x.tableMode = { mode: "turn" } as typeof x.tableMode;
    });
    await enqueuer.onAppended(sessionId, post(p, { kind: "ask_dm" }));
    const jobs = await turnJobs();
    expect(jobs).toHaveLength(1);
    expect(notBeforeMs(jobs[0]?.input)).toBe(Date.parse(POST_TS));
  });

  it("a declared mechanical Intent (rule 2) queues a read", async () => {
    const { sessionId, enqueuer, turnJobs, p } = setup();
    await enqueuer.onAppended(sessionId, post(p, { kind: "hide" }));
    expect(await turnJobs()).toHaveLength(1);
  });

  it("a runner declare (id <actionId>.<n>) is not a post", async () => {
    const { sessionId, enqueuer, turnJobs, p } = setup((x) => {
      x.actions.push({ actionId: "act-1" } as never);
    });
    const rows = post(p, { kind: "hide" });
    const view = p.intents.at(-1) as { id: string };
    view.id = "act-1.0";
    await enqueuer.onAppended(sessionId, rows);
    expect(await turnJobs()).toHaveLength(0);
  });

  it("queues nothing in turn mode or under a human seat", async () => {
    const cases: [string, (p: SessionProjections) => void, PostOpts][] = [
      [
        "turn mode",
        (x) => {
          x.tableMode = { mode: "turn" } as typeof x.tableMode;
        },
        {},
      ],
      [
        "human seat",
        (x) => {
          x.gate = { ...x.gate, seat: { kind: "human" } } as typeof x.gate;
        },
        {},
      ],
    ];
    for (const [, mutate, opts] of cases) {
      const { sessionId, enqueuer, turnJobs, companionJobs, p } = setup(mutate);
      await enqueuer.onAppended(sessionId, post(p, opts));
      expect(await turnJobs()).toHaveLength(0);
      expect(await companionJobs()).toHaveLength(0);
    }
  });

  it("queues nothing once two DM narrations follow the latest human post (the chain cap)", async () => {
    const { sessionId, enqueuer, turnJobs, p } = setup();
    const rows = post(p);
    for (const seq of [31, 32])
      p.transcript.push({
        seq,
        ts: "",
        actor: "ai:dm",
        visibility: "public",
        kind: "narration",
        text: "x",
        actionIds: [],
      } as never);
    await enqueuer.onAppended(sessionId, rows);
    expect(await turnJobs()).toHaveLength(0);
  });

  it("a companion-only post queues a prompt companion job and a read", async () => {
    const { sessionId, enqueuer, turnJobs, companionJobs, p } = setup();
    await enqueuer.onAppended(
      sessionId,
      post(p, { text: "Odo, what do you think?" }),
    );
    expect(await turnJobs()).toHaveLength(1);
    const rows = await companionJobs();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.input).toMatchObject({
      reason: "prompt",
      companions: ["odo"],
    });
  });

  it("a queued commit turn absorbs a post", async () => {
    const { sessionId, enqueuer, turnJobs, p } = setup();
    await enqueueTurn(requireDb(), sessionId, "commit", 4);
    await enqueuer.onAppended(sessionId, post(p));
    const rows = await turnJobs();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.input).toMatchObject({ trigger: "commit", triggerSeq: 4 });
  });

  it("a commit converts a queued talk turn and clears notBefore", async () => {
    const { sessionId, enqueuer, turnJobs, p } = setup();
    await enqueuer.onAppended(sessionId, post(p));
    await enqueueTurn(requireDb(), sessionId, "commit", 6);
    const rows = await turnJobs();
    expect(rows).toHaveLength(1);
    const input = rows[0]?.input as Record<string, unknown>;
    expect(input).toMatchObject({ trigger: "commit", triggerSeq: 6 });
    expect(input.notBefore).toBeUndefined();
    expect(input.firstPostAt).toBeUndefined();
  });

  it("a pre-066 queued row with firstPostAt still parses and moves", async () => {
    const { sessionId, enqueuer, turnJobs, p } = setup();
    await enqueuer.onAppended(sessionId, post(p));
    await requireDb().execute(sql`
      UPDATE jobs SET input = jsonb_set(input, '{firstPostAt}', to_jsonb(${POST_TS}::text))
      WHERE session_id = ${sessionId}::uuid AND kind = 'turn'`);
    await enqueuer.onAppended(
      sessionId,
      post(p, { ts: new Date(Date.parse(POST_TS) + 20_000).toISOString() }),
    );
    const jobs = await turnJobs();
    expect(jobs).toHaveLength(1);
    expect(notBeforeMs(jobs[0]?.input)).toBe(Date.parse(POST_TS) + 30_000);
  });

  it("interruptRead ends a running read that shipped nothing, and not one that shipped", async () => {
    const { sessionId, enqueuer, p } = setup();
    const running = async (result: unknown) => {
      await requireDb().execute(sql`
        INSERT INTO jobs (kind, session_id, status, stage, input, result, claim_token, heartbeat_at, attempts)
        VALUES ('turn', ${sessionId}::uuid, 'running', 'narrate',
          jsonb_build_object('v', 1, 'sessionId', ${sessionId}::text, 'trigger', 'talk', 'triggerSeq', 1, 'forceResolve', false, 'start', 'null'::jsonb),
          ${JSON.stringify(result)}::jsonb, gen_random_uuid(), now(), 1)`);
    };
    await running({ checkpoint: { submissions: [], narration: null } });
    expect(await interruptRead(requireDb(), sessionId)).not.toBeNull();
    const [done] = await listDmJobs(requireDb(), sessionId, 20, "turn");
    expect(done?.status).toBe("succeeded");
    expect(done?.result).toMatchObject({ talk: { outcome: "interrupted" } });
    await requireDb().execute(
      sql`DELETE FROM jobs WHERE session_id = ${sessionId}::uuid`,
    );
    await running({
      checkpoint: { submissions: [{ key: "answer:1" }], narration: null },
    });
    expect(await interruptRead(requireDb(), sessionId)).toBeNull();
    await requireDb().execute(
      sql`DELETE FROM jobs WHERE session_id = ${sessionId}::uuid`,
    );
    // A readable post through the listener interrupts the running read, then queues a new one.
    await running({ checkpoint: { submissions: [], narration: null } });
    await enqueuer.onAppended(sessionId, post(p));
    const jobs = await listDmJobs(requireDb(), sessionId, 20, "turn");
    expect(jobs.map((j) => j.status).sort()).toEqual(["queued", "succeeded"]);
  });
});
