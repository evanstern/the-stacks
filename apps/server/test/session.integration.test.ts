import { randomUUID } from "node:crypto";
import type { EngineEvent } from "@the-stacks/dnd5e-engine";
import {
  applyEvent,
  emptyProjections,
  MECHANICS_EVENT_TYPES,
  project,
  type StoredEvent,
  type Viewer,
} from "@the-stacks/session-model";
import {
  fixtures,
  type SessionFixture,
} from "@the-stacks/session-model/fixtures";
import { afterAll, describe, expect, it } from "vitest";
import { createDb, probeReachable } from "../src/db.js";
import {
  type AppendInput,
  append,
  appendBatch,
  readFrom,
} from "../src/events/log.js";
import {
  appendMechanicsBatch,
  appendSessionEvent,
  SessionEventRefused,
  toStoredEvent,
} from "../src/session/events.js";
import { loadProjections } from "../src/session/projections.js";

/**
 * Integration tests for the session seam (spec 028, Phase 5) against a REAL
 * Postgres: identical rebuild from the log (AC #7), refusals and mid-batch
 * failures that write nothing (AC #5, AC #6), tolerance of a damaged log
 * (AC #8). Every test uses a fresh session id; the events table is
 * append-only and shared.
 */

const databaseUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
const db = databaseUrl ? createDb(databaseUrl) : undefined;
const reachable = db ? await probeReachable(db.$client, 2000) : false;

if (!reachable) {
  const notice =
    `\n⚠️  SKIPPING apps/server/test/session.integration.test.ts — no reachable database ` +
    `(tried TEST_DATABASE_URL then DATABASE_URL; got ${databaseUrl ?? "<unset>"}). ` +
    `A skip here proves NOTHING about atomic batches or replay on a real log.\n`;
  console.warn(notice);
  if (process.env.REQUIRE_DATABASE === "1") throw new Error(notice);
}

afterAll(async () => {
  await db?.$client.end();
});

function requireDb() {
  if (!db)
    throw new Error("session integration tests require a reachable database");
  return db;
}

const isMechanics = (type: string) => MECHANICS_EVENT_TYPES.includes(type);
const batchIdOf = (e: StoredEvent) =>
  (e.payload as { batchId: string }).batchId;

function viewersOf(f: SessionFixture): Viewer[] {
  return [f.viewers.dm, ...f.viewers.players];
}

/**
 * Appends a fixture's rows through the seam into a fresh session: session events one by one,
 * consecutive mechanics rows of one batch through appendMechanicsBatch. Returns every
 * returned row (stored form) and the row groups per mechanics batch.
 */
async function appendFixture(f: SessionFixture, sessionId: string) {
  const returned: StoredEvent[] = [];
  const batches: StoredEvent[][] = [];
  let i = 0;
  while (i < f.events.length) {
    const e = f.events[i];
    if (isMechanics(e.type)) {
      const id = batchIdOf(e);
      const group: StoredEvent[] = [];
      while (
        i < f.events.length &&
        isMechanics(f.events[i].type) &&
        batchIdOf(f.events[i]) === id
      ) {
        group.push(f.events[i]);
        i++;
      }
      const first = group[0].payload as {
        actionId: string | null;
        proposalId: string | null;
      };
      const result = await appendMechanicsBatch(requireDb(), {
        sessionId,
        actor: group[0].actor,
        events: group.map((g) => (g.payload as { event: EngineEvent }).event),
        actionId: first.actionId,
        proposalId: first.proposalId,
        visibility: group[0].visibility,
      });
      batches.push(result.events);
      returned.push(...result.events);
    } else {
      const stored = await appendSessionEvent(requireDb(), {
        sessionId,
        actor: e.actor,
        type: e.type,
        payload: e.payload,
        visibility: e.visibility,
      });
      returned.push(stored);
      i++;
    }
  }
  return { returned, batches };
}

describe.skipIf(!reachable)(
  "session seam — replay on a real log (AC #7)",
  () => {
    for (const f of fixtures.filter((x) => x.name !== "unknown-and-invalid")) {
      it(`${f.name}: incremental fold, project and loadProjections agree`, async () => {
        const sessionId = randomUUID();
        const { returned, batches } = await appendFixture(f, sessionId);

        expect(returned.map((e) => e.seq)).toEqual(
          returned.map((_, idx) => idx + 1),
        );
        for (const batch of batches) {
          expect(batch.map((e) => e.seq)).toEqual(
            batch.map((_, idx) => batch[0].seq + idx),
          );
        }

        for (const viewer of viewersOf(f)) {
          const incremental = returned.reduce(
            applyEvent,
            emptyProjections(viewer),
          );
          const folded = project(returned, viewer);
          const loadedA = await loadProjections(requireDb(), sessionId, viewer);
          const loadedB = await loadProjections(requireDb(), sessionId, viewer);
          expect(loadedA).toEqual(loadedB);
          expect(loadedA).toEqual(folded);
          expect(loadedA).toEqual(incremental);
          expect(loadedA.diagnostics.incompleteBatches).toEqual([]);
        }
      });
    }
  },
);

describe.skipIf(!reachable)(
  "session seam — refusals write nothing (AC #5)",
  () => {
    async function expectRefused(
      sessionId: string,
      input: { type: string; payload: unknown; visibility?: string },
      code: string,
    ) {
      const error = await appendSessionEvent(requireDb(), {
        sessionId,
        actor: "ai:dm",
        ...input,
      }).then(
        () => null,
        (e: unknown) => e,
      );
      expect(error).toBeInstanceOf(SessionEventRefused);
      expect((error as SessionEventRefused).code).toBe(code);
      expect(await readFrom(requireDb(), { sessionId, limit: 10 })).toEqual([]);
    }

    const tracker = {
      reason: "The vault clock starts",
      trackerId: "t-clock",
      before: null,
      after: {
        trackerId: "t-clock",
        name: "Alarm",
        segments: 6,
        filled: 0,
        note: "secret",
      },
    };

    it("refuses a public tracker.changed (VISIBILITY_NOT_ALLOWED)", async () => {
      await expectRefused(
        randomUUID(),
        { type: "tracker.changed", payload: tracker, visibility: "public" },
        "VISIBILITY_NOT_ALLOWED",
      );
    });

    it("refuses an invalid payload (INVALID_PAYLOAD)", async () => {
      await expectRefused(
        randomUUID(),
        {
          type: "talk",
          payload: { text: "", channel: "ic", characterId: null },
        },
        "INVALID_PAYLOAD",
      );
    });

    it("refuses an unknown type (UNKNOWN_EVENT_TYPE)", async () => {
      await expectRefused(
        randomUUID(),
        { type: "weather.changed", payload: { weather: "rain" } },
        "UNKNOWN_EVENT_TYPE",
      );
    });
  },
);

describe.skipIf(!reachable)(
  "appendBatch — atomic failure (AC #6, AC #7)",
  () => {
    const row = (
      sessionId: string,
      i: number,
      payloadVersion = 1,
    ): AppendInput => ({
      sessionId,
      actor: "test-actor",
      type: "narration",
      payload: { i },
      payloadVersion,
    });

    it("a failure mid-batch leaves zero rows and no seq gap", async () => {
      const sessionId = randomUUID();
      const inputs = [1, 2, 3, 4, 5].map((i) =>
        row(sessionId, i, i === 3 ? 0 : 1),
      );
      await expect(appendBatch(requireDb(), inputs)).rejects.toThrow();
      expect(await readFrom(requireDb(), { sessionId, limit: 10 })).toEqual([]);

      const next = await append(requireDb(), row(sessionId, 6));
      expect(next.seq).toBe(1);
    });

    it("a failure after existing rows keeps them and the next seq is gapless", async () => {
      const sessionId = randomUUID();
      await append(requireDb(), row(sessionId, 0));
      const inputs = [1, 2, 3, 4, 5].map((i) =>
        row(sessionId, i, i === 3 ? 0 : 1),
      );
      await expect(appendBatch(requireDb(), inputs)).rejects.toThrow();
      const rows = await readFrom(requireDb(), { sessionId, limit: 10 });
      expect(rows.map((r) => r.seq)).toEqual([1]);
      const next = await append(requireDb(), row(sessionId, 6));
      expect(next.seq).toBe(2);
    });

    it("a successful batch lands with consecutive seq after prior rows", async () => {
      const sessionId = randomUUID();
      await append(requireDb(), row(sessionId, 0));
      const rows = await appendBatch(
        requireDb(),
        [1, 2, 3].map((i) => row(sessionId, i)),
      );
      expect(rows.map((r) => r.seq)).toEqual([2, 3, 4]);
    });

    it("guards throw before any write: empty, mixed sessions, seq or ts supplied", async () => {
      const a = randomUUID();
      const b = randomUUID();
      await expect(appendBatch(requireDb(), [])).rejects.toThrow(/empty/);
      await expect(
        appendBatch(requireDb(), [row(a, 1), row(b, 2)]),
      ).rejects.toThrow(/same sessionId/);
      await expect(
        appendBatch(requireDb(), [
          row(a, 1),
          { ...row(a, 2), seq: 9 } as AppendInput,
        ]),
      ).rejects.toThrow(/seq and ts/);
      await expect(
        appendBatch(requireDb(), [
          { ...row(a, 1), ts: new Date() } as AppendInput,
        ]),
      ).rejects.toThrow(/seq and ts/);
      expect(await readFrom(requireDb(), { sessionId: a, limit: 10 })).toEqual(
        [],
      );
      expect(await readFrom(requireDb(), { sessionId: b, limit: 10 })).toEqual(
        [],
      );
    });
  },
);

describe.skipIf(!reachable)(
  "appendMechanicsBatch — atomic failure (AC #6, AC #7)",
  () => {
    // Five valid engine events: the recorded batch of the free-mode fixture is too short, so
    // reuse the turn-mode combat fixture's longest mechanics batch.
    const combat = fixtures.find(
      (f) => f.name === "turn-mode-combat",
    ) as SessionFixture;
    const longest = (() => {
      const groups = new Map<string, EngineEvent[]>();
      for (const e of combat.events) {
        if (!isMechanics(e.type)) continue;
        const p = e.payload as { batchId: string; event: EngineEvent };
        groups.set(p.batchId, [...(groups.get(p.batchId) ?? []), p.event]);
      }
      return [...groups.values()].sort((x, y) => y.length - x.length)[0];
    })();

    it("an injected database failure on the third row lands nothing and leaves the projection unchanged", async () => {
      expect(longest.length).toBeGreaterThanOrEqual(3);
      const sessionId = randomUUID();
      await appendSessionEvent(requireDb(), {
        sessionId,
        actor: "ai:dm",
        type: "talk",
        payload: { text: "Before.", channel: "ic", characterId: null },
      });
      const dm: Viewer = { role: "dm" };
      const before = await loadProjections(requireDb(), sessionId, dm);

      await expect(
        appendMechanicsBatch(
          requireDb(),
          {
            sessionId,
            actor: "ai:dm",
            events: longest,
            actionId: null,
            proposalId: null,
          },
          {
            appendBatch: (d, inputs) =>
              appendBatch(
                d,
                inputs.map((input, i) =>
                  i === 2 ? { ...input, payloadVersion: 0 } : input,
                ),
              ),
          },
        ),
      ).rejects.toThrow();

      expect(
        await readFrom(requireDb(), { sessionId, limit: 50 }),
      ).toHaveLength(1);
      expect(await loadProjections(requireDb(), sessionId, dm)).toEqual(before);
    });

    it("an invalid third engine event is refused before any write", async () => {
      const sessionId = randomUUID();
      const bad = longest.map((e, i) =>
        i === 2 ? ({ ...e, v: 999 } as unknown as EngineEvent) : e,
      );
      const error = await appendMechanicsBatch(requireDb(), {
        sessionId,
        actor: "ai:dm",
        events: bad,
        actionId: null,
        proposalId: null,
      }).then(
        () => null,
        (e: unknown) => e,
      );
      expect(error).toBeInstanceOf(SessionEventRefused);
      expect((error as SessionEventRefused).code).toBe("INVALID_PAYLOAD");
      expect(await readFrom(requireDb(), { sessionId, limit: 50 })).toEqual([]);
    });
  },
);

describe.skipIf(!reachable)("a damaged log still folds (AC #8)", () => {
  it("unknown-and-invalid rows appended directly produce the fixture's counters", async () => {
    const f = fixtures.find(
      (x) => x.name === "unknown-and-invalid",
    ) as SessionFixture;
    const sessionId = randomUUID();
    // The database cannot produce a duplicate seq, so the fixture's duplicate row is dropped.
    const seen = new Set<number>();
    const rows = f.events.filter((e) => {
      if (seen.has(e.seq)) return false;
      seen.add(e.seq);
      return true;
    });
    for (const e of rows) {
      await append(requireDb(), {
        sessionId,
        actor: e.actor,
        type: e.type,
        payload: e.payload,
        payloadVersion: e.payloadVersion,
        visibility: e.visibility,
      });
    }
    const stored = (await readFrom(requireDb(), { sessionId, limit: 100 })).map(
      toStoredEvent,
    );
    expect(stored).toHaveLength(rows.length);

    for (const viewer of viewersOf(f)) {
      const p = await loadProjections(requireDb(), sessionId, viewer);
      expect(p.diagnostics).toMatchObject({
        skippedUnknownType: 2,
        skippedUnknownVersion: 1,
        skippedInvalid: 2,
        outOfOrder: 0,
      });
      expect(p.transcript).toHaveLength(1);
    }
  });
});
