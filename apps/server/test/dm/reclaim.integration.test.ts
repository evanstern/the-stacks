import { sql } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { listDmJobs } from "../../src/dm/jobs.js";
import type { Gate } from "../../src/gate/index.js";
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
  reachable,
  readRows,
  requireDb,
  startScene,
} from "./world.js";

loudSkip("reclaim.integration.test.ts");
afterAll(async () => {
  await db?.$client.end();
});
clearDmJobsBeforeEach();

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g;
const BATCH = /id-[0-9a-f]{8}-\d+/g;

/**
 * The log without ids that differ per session or job. Presence markers are left out: the
 * worker records one per claim, so a reclaimed turn legitimately holds one more than a
 * clean run (decision-0024; no deduplication).
 */
function normalized(rows: Awaited<ReturnType<typeof readRows>>): string[] {
  return rows
    .filter((r) => r.type !== "presence.recorded")
    .map((r) =>
      JSON.stringify([r.type, r.actor, r.visibility, r.payload])
        .replace(UUID, "<uuid>")
        // The marker's step number counts submissions. A reclaim skips an action
        // that already resolved, so a later marker's number can differ from the
        // clean run's under the decision-0025 §4 order (spec 045 OQ-2; TASK-0156).
        // Label only: the skipped step is action.resolve, which carries no marker,
        // so no two steps of one job share a marker. The double-crash test below
        // pins that each step lands once.
        .replace(/\[<uuid>#\d+\]/g, "[<uuid>#n]")
        .replace(BATCH, "<id>"),
    );
}

const chronicle = {
  purpose: "dm.chronicle",
  respond: { type: "json", value: { entries: [] } },
};

/**
 * A run of the search turn with an optional crash after the k-th submission.
 * An array crashes after each listed submission, counted across claims.
 */
async function runTurn(crashAfter: number | number[] | null) {
  const crashes =
    crashAfter === null
      ? []
      : Array.isArray(crashAfter)
        ? crashAfter
        : [crashAfter];
  const s = script("exploration-check.json");
  const state = { armed: false, count: 0, sessionId: "", firstClaim: 0 };
  const w = await createWorld({
    dice: s.dice,
    calls: [...s.calls, chronicle],
    gate: (g): Gate => ({
      ...g,
      submit: async (...args) => {
        const result = await g.submit(...args);
        if (state.armed) {
          state.count += 1;
          if (crashes.includes(state.count)) {
            // The process "dies" here: the lease token is lost, so the worker's
            // next fence check and checkpoint write fail.
            await requireDb().execute(
              sql`UPDATE jobs SET claim_token = gen_random_uuid()
                  WHERE session_id = ${state.sessionId} AND kind = 'turn' AND status = 'running'`,
            );
          }
        }
        return result;
      },
    }),
  });
  state.sessionId = w.sessionId;
  const { worker } = workerFor(w);
  await startScene(w);
  await commitAction(
    w,
    "I search the ferry-house for whoever cut the bell rope.",
    "act-search",
  );
  await tick();
  state.armed = true;

  const expire = () =>
    requireDb().execute(
      sql`UPDATE jobs SET heartbeat_at = now() - interval '5 minutes'
          WHERE session_id = ${w.sessionId} AND kind = 'turn' AND status = 'running'`,
    );
  if (crashes.length === 0) {
    await drainAll(worker);
  } else {
    await worker.processOne(); // crashes: fenced out, the job stays running
    state.firstClaim = state.count;
    const [job] = await listDmJobs(requireDb(), w.sessionId, 5, "turn");
    expect(job?.status).toBe("running");
    expect(job?.attempts).toBe(1);
    for (let i = 1; i < crashes.length; i += 1) {
      await expire();
      await worker.processOne(); // a reclaim that crashes again
      const [again] = await listDmJobs(requireDb(), w.sessionId, 5, "turn");
      expect(again?.status).toBe("running");
    }
    await expire();
    await drainAll(worker); // reclaim, finish, chronicle
  }
  return { w, state };
}

describe.skipIf(!reachable)("lease expiry and reclaim (database)", () => {
  it("a crash after any resolve submission reclaims to the uninterrupted log (SC-005)", async () => {
    const base = await runTurn(null);
    const baseRows = normalized(await readRows(base.w));
    // The last submission is the narration, shipped after resolve (see tasks.md Deviations).
    const submissions = base.state.count - 1;
    expect(submissions).toBeGreaterThanOrEqual(3);
    expect(base.w.scripted.remaining().dice).toBe(0);

    for (let k = 1; k <= submissions; k += 1) {
      const run = await runTurn(k);
      const rows = normalized(await readRows(run.w));
      expect(rows, `crash after submission ${k}`).toEqual(baseRows);

      // A stale worker's next submit is stopped by the fence: nothing past k
      // came from the first claim.
      expect(run.state.firstClaim, `stale submit after ${k}`).toBe(k);
      expect(run.state.count, `reclaim submits the rest once`).toBe(
        base.state.count,
      );

      const turns = await listDmJobs(requireDb(), run.w.sessionId, 5, "turn");
      expect(turns).toHaveLength(1);
      expect(turns[0]?.status).toBe("succeeded");
      expect(turns[0]?.attempts).toBe(2);

      // No scripted response was spent twice or left over.
      const left = run.w.scripted.remaining();
      expect(left.dice).toBe(0);
      expect(Object.values(left.calls).every((n) => n === 0)).toBe(true);
    }
  });

  it("a crash after the narration lands reclaims without a second narration", async () => {
    const base = await runTurn(null);
    const baseRows = normalized(await readRows(base.w));
    const narrationSubmission = base.state.count; // the last submission

    const run = await runTurn(narrationSubmission);
    const rows = await readRows(run.w);
    expect(normalized(rows)).toEqual(baseRows);
    expect(rows.filter((r) => r.type === "narration")).toHaveLength(1);

    // The first claim made every submission; the reclaim submitted nothing.
    expect(run.state.firstClaim).toBe(narrationSubmission);
    expect(run.state.count).toBe(base.state.count);

    const turns = await listDmJobs(requireDb(), run.w.sessionId, 5, "turn");
    expect(turns).toHaveLength(1);
    expect(turns[0]?.status).toBe("succeeded");
    expect(turns[0]?.attempts).toBe(2);

    // The reclaim spent no narrate or audit call: nothing is left over, and
    // nothing ran twice (an unscripted call would have failed the turn).
    const left = run.w.scripted.remaining();
    expect(left.dice).toBe(0);
    expect(Object.values(left.calls).every((n) => n === 0)).toBe(true);
  });

  it("a second crash after the tracker lands reclaims to the same log, each step once", async () => {
    const base = await runTurn(null);
    const baseRows = normalized(await readRows(base.w));
    // Submission 2 is action.resolve (no marker). Submission 3 counts the
    // reclaim's tracker advance, which lands and then crashes before its checkpoint.
    const run = await runTurn([2, 3]);
    const rows = await readRows(run.w);
    expect(normalized(rows)).toEqual(baseRows);
    const jobMarkers = rows.flatMap(
      (r) => JSON.stringify(r.payload).match(/\[[0-9a-f-]{36}#\d+\]/g) ?? [],
    );
    // No two steps of the job share a marker: dice and check rows share #1, the tracker has its own.
    const byType = rows
      .filter((r) => /#\d+\]/.test(JSON.stringify(r.payload)))
      .filter((r) => r.type === "tracker.changed" || r.type === "dice.rolled")
      .map(
        (r) => `${r.type}:${JSON.stringify(r.payload).match(/#(\d+)\]/)?.[1]}`,
      );
    expect(byType).toEqual(["dice.rolled:1", "tracker.changed:2"]);
    expect(jobMarkers.length).toBeGreaterThan(0);
    expect(rows.filter((r) => r.type === "action.resolved")).toHaveLength(1);
    const turns = await listDmJobs(requireDb(), run.w.sessionId, 5, "turn");
    expect(turns[0]?.status).toBe("succeeded");
    expect(turns[0]?.attempts).toBe(3);
    const left = run.w.scripted.remaining();
    expect(left.dice).toBe(0);
    expect(Object.values(left.calls).every((n) => n === 0)).toBe(true);
  });
});
