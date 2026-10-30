import { randomUUID } from "node:crypto";
import type {
  SessionProjections,
  StoredEvent,
} from "@the-stacks/session-model";
import { sql } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { createDmEnqueuer } from "../../src/dm/enqueue.js";
import { enqueueTurn, listDmJobs } from "../../src/dm/jobs.js";
import { greyhollowDuo, PLAYER_USER } from "./snapshot-fixtures.js";
import { clearDmJobsBeforeEach } from "./worker-world.js";
import { db, loudSkip, reachable, requireDb } from "./world.js";

/** Rule 7 (specs/065-talk-triggers D2): an IC post queues a coalesced talk turn. */

loudSkip("enqueue-talk.integration.test.ts");
afterAll(async () => {
  await db?.$client.end();
});
clearDmJobsBeforeEach();

const row = (
  seq: number,
  text: string,
  over: Partial<StoredEvent> = {},
  channel = "ic",
) =>
  ({
    sessionId: "",
    seq,
    actor: PLAYER_USER,
    type: "talk",
    payload: { text, channel, characterId: "tamsin" },
    payloadVersion: 1,
    visibility: "public",
    ts: "2026-10-30T00:00:00.000Z",
    ...over,
  }) as StoredEvent;

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
    talkQuietMs: 3000,
    talkMaxWaitMs: 10_000,
  });
  const turnJobs = () => listDmJobs(requireDb(), sessionId, 20, "turn");
  const companionJobs = () =>
    listDmJobs(requireDb(), sessionId, 20, "companion");
  return { sessionId, enqueuer, turnJobs, companionJobs };
}

const notBeforeMs = (input: unknown) =>
  Date.parse((input as { notBefore: string }).notBefore);

describe.skipIf(!reachable)("talk enqueue (database)", () => {
  it("an IC post queues a talk turn with notBefore", async () => {
    const { sessionId, enqueuer, turnJobs } = setup();
    await enqueuer.onAppended(sessionId, [row(5, "Wenna, hello there?")]);
    const rows = await turnJobs();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.input).toMatchObject({ trigger: "talk", triggerSeq: 5 });
    expect(notBeforeMs(rows[0]?.input)).toBeGreaterThan(Date.now());
  });

  it("two posts coalesce: seq moves, notBefore moves later", async () => {
    const { sessionId, enqueuer, turnJobs } = setup();
    await enqueuer.onAppended(sessionId, [row(5, "Wenna, hello?")]);
    const first = notBeforeMs((await turnJobs())[0]?.input);
    await new Promise((r) => setTimeout(r, 30));
    await enqueuer.onAppended(sessionId, [row(6, "Wenna, again?")]);
    const rows = await turnJobs();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.input).toMatchObject({ trigger: "talk", triggerSeq: 6 });
    expect(notBeforeMs(rows[0]?.input)).toBeGreaterThan(first);
  });

  it("the max wait caps notBefore from the first post", async () => {
    const { sessionId, enqueuer, turnJobs } = setup();
    await enqueuer.onAppended(sessionId, [row(5, "Wenna, hello?")]);
    // Age the first post so the cap binds (first post 9 s ago).
    await requireDb().execute(sql`
      UPDATE jobs SET input = jsonb_set(input, '{firstPostAt}',
        to_jsonb(to_char((now() - interval '9 seconds') AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')))
      WHERE session_id = ${sessionId}::uuid AND kind = 'turn'`);
    await enqueuer.onAppended(sessionId, [row(6, "Wenna?")]);
    const input = (await turnJobs())[0]?.input as {
      firstPostAt: string;
      notBefore: string;
    };
    expect(Date.parse(input.notBefore)).toBeLessThanOrEqual(
      Date.parse(input.firstPostAt) + 10_000 + 5,
    );
  });

  it("queues nothing for OOC, whisper, turn mode, a human seat or the cap", async () => {
    const cases: [string, (p: SessionProjections) => void, StoredEvent][] = [
      ["ooc", () => {}, row(5, "Wenna?", {}, "ooc")],
      ["whisper", () => {}, row(5, "Wenna?", { visibility: "whisper" })],
      [
        "turn mode",
        (p) => {
          p.tableMode = { mode: "turn" } as typeof p.tableMode;
        },
        row(5, "Wenna?"),
      ],
      [
        "human seat",
        (p) => {
          p.gate = { ...p.gate, seat: { kind: "human" } } as typeof p.gate;
        },
        row(5, "Wenna?"),
      ],
      [
        "cap",
        (p) => {
          for (const seq of [3, 4])
            p.transcript.push({
              seq,
              ts: "",
              actor: "ai:dm",
              visibility: "public",
              kind: "narration",
              text: "x",
              actionIds: [],
            } as never);
        },
        row(5, "Wenna?"),
      ],
    ];
    for (const [, mutate, event] of cases) {
      const { sessionId, enqueuer, turnJobs, companionJobs } = setup(mutate);
      await enqueuer.onAppended(sessionId, [event]);
      expect(await turnJobs()).toHaveLength(0);
      expect(await companionJobs()).toHaveLength(0);
    }
  });

  it("a companion-only post queues a prompt companion job", async () => {
    const { sessionId, enqueuer, turnJobs, companionJobs } = setup();
    await enqueuer.onAppended(sessionId, [row(5, "Odo, what do you think?")]);
    expect(await turnJobs()).toHaveLength(0);
    const rows = await companionJobs();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.input).toMatchObject({
      reason: "prompt",
      companions: ["odo"],
    });
  });

  it("a queued commit turn absorbs a post", async () => {
    const { sessionId, enqueuer, turnJobs } = setup();
    await enqueueTurn(requireDb(), sessionId, "commit", 4);
    await enqueuer.onAppended(sessionId, [row(5, "Wenna?")]);
    const rows = await turnJobs();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.input).toMatchObject({ trigger: "commit", triggerSeq: 4 });
  });

  it("a commit converts a queued talk turn and clears notBefore", async () => {
    const { sessionId, enqueuer, turnJobs } = setup();
    await enqueuer.onAppended(sessionId, [row(5, "Wenna?")]);
    await enqueueTurn(requireDb(), sessionId, "commit", 6);
    const rows = await turnJobs();
    expect(rows).toHaveLength(1);
    const input = rows[0]?.input as Record<string, unknown>;
    expect(input).toMatchObject({ trigger: "commit", triggerSeq: 6 });
    expect(input.notBefore).toBeUndefined();
    expect(input.firstPostAt).toBeUndefined();
  });
});
