import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createDb, probeReachable } from "../src/db.js";
import { append, readFrom } from "../src/events/log.js";

/**
 * Integration tests for the event log (spec 004, US1). These prove ordering
 * and cursor semantics against a REAL Postgres — research D2 requires this:
 * a fake sequence generator can't exhibit the gapless/ordering guarantees
 * this feature exists to provide, and this project has already shipped a
 * process-killing crash to `main` because every test used a fake and none
 * touched the real connection path (the T016 finding).
 *
 * Two scratch rows already exist in `events` (session_ids 1111... and
 * 2222...) from prior trigger verification and can never be deleted — this
 * is the append-only guard working as designed. Every test below therefore
 * generates its own fresh session_id and never assumes the table is empty.
 */

const databaseUrl = process.env.DATABASE_URL;
const db = databaseUrl ? createDb(databaseUrl) : undefined;
// T015: loud-skip harness. A silent skip and a fake pass are both green;
// this notice is what makes "proved nothing" look different from "proved
// something" (research D2).
const reachable = db ? await probeReachable(db.$client, 2000) : false;

if (!reachable) {
  console.warn(
    `\n⚠️  SKIPPING apps/server/test/events.integration.test.ts — no reachable database ` +
      `(DATABASE_URL=${databaseUrl ?? "<unset>"}). These are the event-log integration ` +
      `tests (spec 004 US1); a skip here proves NOTHING about append/cursor/ordering ` +
      `behavior. Start one with: docker compose -p task-0012 up -d db\n`,
  );
}

afterAll(async () => {
  await db?.$client.end();
});

/**
 * Non-`!` access to `db`: only called from inside `it()` bodies, which only
 * run when `reachable` is true (describe.skipIf above) and therefore `db`
 * is defined. Throwing here rather than asserting keeps the file free of
 * `noNonNullAssertion` while still failing loudly if that invariant ever
 * breaks.
 */
function requireDb() {
  if (!db) {
    throw new Error("event log integration tests require a reachable database");
  }
  return db;
}

describe.skipIf(!reachable)(
  "event log — append and readFrom (US1, integration)",
  () => {
    let sessionId: string;

    beforeEach(() => {
      // Fresh session per test: the table is append-only and pre-seeded, so
      // reusing an id would leak state across tests and across runs.
      sessionId = randomUUID();
    });

    async function appendN(count: number) {
      const recorded = [];
      for (let i = 1; i <= count; i++) {
        recorded.push(
          await append(requireDb(), {
            sessionId,
            actor: "test-actor",
            type: "narration",
            payload: { i },
            payloadVersion: 1,
          }),
        );
      }
      return recorded;
    }

    it("T011: returns appended events in ascending seq order starting at 1", async () => {
      await appendN(3);

      const result = await readFrom(requireDb(), { sessionId, limit: 10 });

      expect(result.map((e) => e.seq)).toEqual([1, 2, 3]);
    });

    it("T012: a cursor of 3 in a 5-event session returns exactly events 4 and 5", async () => {
      await appendN(5);

      const result = await readFrom(requireDb(), {
        sessionId,
        afterSeq: 3,
        limit: 10,
      });

      expect(result.map((e) => e.seq)).toEqual([4, 5]);
    });

    it("T013: a cursor at or beyond the newest position returns an empty list, not an error", async () => {
      await appendN(2);

      const atNewest = await readFrom(requireDb(), {
        sessionId,
        afterSeq: 2,
        limit: 10,
      });
      const beyondNewest = await readFrom(requireDb(), {
        sessionId,
        afterSeq: 99,
        limit: 10,
      });

      expect(atNewest).toEqual([]);
      expect(beyondNewest).toEqual([]);
    });

    it("T014: limit caps the number of events returned", async () => {
      await appendN(5);

      const result = await readFrom(requireDb(), { sessionId, limit: 2 });

      expect(result).toHaveLength(2);
      expect(result.map((e) => e.seq)).toEqual([1, 2]);
    });

    it("T018: 50 concurrent appends to one session are gapless and duplicate-free (SC-003)", async () => {
      const WRITER_COUNT = 50;

      const recorded = await Promise.all(
        Array.from({ length: WRITER_COUNT }, (_, i) =>
          append(requireDb(), {
            sessionId,
            actor: "test-actor",
            type: "narration",
            payload: { i },
            payloadVersion: 1,
          }),
        ),
      );

      const seqs = recorded.map((e) => e.seq);
      const distinctSeqs = new Set(seqs);

      expect(recorded).toHaveLength(WRITER_COUNT);
      expect(distinctSeqs.size).toBe(WRITER_COUNT);
      expect(Math.max(...seqs)).toBe(WRITER_COUNT);

      const stored = await readFrom(requireDb(), { sessionId, limit: 100 });
      expect(stored.map((e) => e.seq)).toEqual(
        Array.from({ length: WRITER_COUNT }, (_, i) => i + 1),
      );
    });

    it("T019: concurrent appends to two sessions number each session independently (FR-003)", async () => {
      const sessionA = randomUUID();
      const sessionB = randomUUID();
      const PER_SESSION = 25;

      const [recordedA, recordedB] = await Promise.all([
        Promise.all(
          Array.from({ length: PER_SESSION }, (_, i) =>
            append(requireDb(), {
              sessionId: sessionA,
              actor: "test-actor",
              type: "narration",
              payload: { i },
              payloadVersion: 1,
            }),
          ),
        ),
        Promise.all(
          Array.from({ length: PER_SESSION }, (_, i) =>
            append(requireDb(), {
              sessionId: sessionB,
              actor: "test-actor",
              type: "narration",
              payload: { i },
              payloadVersion: 1,
            }),
          ),
        ),
      ]);

      const expectedSeqs = Array.from({ length: PER_SESSION }, (_, i) => i + 1);
      expect(recordedA.map((e) => e.seq).sort((a, b) => a - b)).toEqual(
        expectedSeqs,
      );
      expect(recordedB.map((e) => e.seq).sort((a, b) => a - b)).toEqual(
        expectedSeqs,
      );
    });

    it("T023: a direct UPDATE and DELETE against events are both rejected at the database (FR-004)", async () => {
      // Raw SQL through the Drizzle client, not append/readFrom: those expose
      // no update or delete, so calling them would prove nothing about the
      // trigger (data-model.md, Append-only enforcement).
      const [recorded] = await appendN(1);

      // Drizzle wraps the driver error in "Failed query: ..."; the trigger's
      // own message ("events is append-only: ... is not permitted") is on
      // `.cause`, so assert there rather than on the wrapper's message.
      async function expectAppendOnlyRejection(query: Promise<unknown>) {
        await expect(query).rejects.toSatisfy((err: unknown) => {
          const cause = err instanceof Error ? err.cause : undefined;
          const message =
            cause instanceof Error ? cause.message : String(cause);
          return /append-only/i.test(message);
        });
      }

      await expectAppendOnlyRejection(
        requireDb().execute(
          sql`UPDATE events SET actor = 'tampered' WHERE session_id = ${sessionId} AND seq = ${recorded.seq}`,
        ),
      );

      await expectAppendOnlyRejection(
        requireDb().execute(
          sql`DELETE FROM events WHERE session_id = ${sessionId} AND seq = ${recorded.seq}`,
        ),
      );

      // The row is still there, unchanged, proving the rejections weren't a
      // silent no-op.
      const stillThere = await readFrom(requireDb(), { sessionId, limit: 10 });
      expect(stillThere).toHaveLength(1);
      expect(stillThere[0].actor).toBe("test-actor");
    });

    it("T026: visibility and payloadVersion survive append and read unchanged (FR-005, FR-013)", async () => {
      const recorded = await append(requireDb(), {
        sessionId,
        actor: "test-actor",
        type: "narration",
        payload: { text: "hi" },
        payloadVersion: 3,
        visibility: "gm-only",
      });

      expect(recorded.visibility).toBe("gm-only");
      expect(recorded.payloadVersion).toBe(3);

      const [read] = await readFrom(requireDb(), { sessionId, limit: 10 });
      expect(read.visibility).toBe("gm-only");
      expect(read.payloadVersion).toBe(3);
    });

    it("T027: an append omitting visibility records the public marker, never null (FR-013)", async () => {
      const recorded = await append(requireDb(), {
        sessionId,
        actor: "test-actor",
        type: "narration",
        payload: {},
        payloadVersion: 1,
      });

      expect(recorded.visibility).toBe("public");

      const [read] = await readFrom(requireDb(), { sessionId, limit: 10 });
      expect(read.visibility).toBe("public");
    });

    it("T028: an event with an unrecognized type and payloadVersion is still returned by a read (FR-012, constitution IV)", async () => {
      await append(requireDb(), {
        sessionId,
        actor: "test-actor",
        type: "some-future-type-nobody-has-written-yet",
        payload: { anything: true },
        payloadVersion: 999,
      });

      const [read] = await readFrom(requireDb(), { sessionId, limit: 10 });
      expect(read.type).toBe("some-future-type-nobody-has-written-yet");
      expect(read.payloadVersion).toBe(999);
    });
  },
);
