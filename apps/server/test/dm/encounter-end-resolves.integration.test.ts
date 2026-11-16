import { afterAll, describe, expect, it } from "vitest";
import { listDmJobs } from "../../src/dm/jobs.js";
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

/**
 * TASK-0110 AC #1 (spec 045, decision-0025 section 4): the F54 turn, rows
 * 260-265 of
 * `specs/034-narration-quality/evidence/verify-20261026T183818Z-greyhollow-ford-provider/`.
 * Tamsin (the active human in `reed-camp`; Odo in the F54 evidence, before spec 118) commits a bargain on the same
 * turn the Director returns `tableMode: { to: "free" }`. Before TASK-0110 the
 * encounter ended first and the action resolved `refused` (UNKNOWN_COMBATANT,
 * "cannot do that here"). Now the action resolves `applied` before
 * `encounter.ended`.
 *
 * The run goes through the real worker, queue, gate and engine against the
 * fake gateway with scripted dice. The reading is RECONSTRUCTED: the evidence
 * keeps no interpret output, so the script gives Odo a Persuasion check, the
 * simplest reading that fits the declared text. The encounter start is run
 * directly (as `resolve.integration.test.ts` does) so the scripted calls cover
 * only the bargain turn.
 */

loudSkip("encounter-end-resolves.integration.test.ts");
afterAll(async () => {
  await db?.$client.end();
});
clearDmJobsBeforeEach();

describe.skipIf(!reachable)("an encounter-ending action (database)", () => {
  it("resolves Odo's bargain applied before the encounter ends (rows 260-265)", async () => {
    const s = script("encounter-end-bargain.json");
    // The script's first seven dice are initiative (Tamsin on top); the last is the Persuasion d20.
    const w = await createWorld({ dice: s.dice, calls: s.calls });
    await startScene(w);
    // Enter turn mode in reed-camp with Tamsin first to act.
    const entered = await w.runResolve({
      director: {
        tableMode: { to: "turn", encounterId: "reed-camp", reason: "Fight." },
      },
      job: {
        id: "00000000-0000-4000-8000-0000000001ff",
        trigger: "commit",
      },
    });
    expect(entered.result.ok).toBe(true);
    w.checkpoint.current = {
      ...w.checkpoint.current,
      submissions: [],
      lastSeq: 0,
    };
    const before = await w.projections();
    expect(before.tableMode.mode).toBe("turn");
    expect(before.encounter?.activeCombatantId).toBe("tamsin");

    const { worker } = workerFor(w, {});

    // Tamsin declares and commits the bargain as the active human. Since spec 118 a companion's own
    // turn runs no Director, so a Director-ended encounter on the same turn needs a human beat.
    await commitAction(
      w,
      "I lower my sword, step between the goblins and Pell, and offer Snag the bargain plainly: the clapper and Pell's freedom bought with safe passage for his remaining dogs, no more fighting needed.",
      "act-tamsin-5",
    );
    await tick();
    await drainAll(worker);

    const jobs = (await listDmJobs(requireDb(), w.sessionId, 20)).reverse();
    // An AI-seat `ruling` turn (spec 102) may follow the beat; it finds nothing open.
    const turns = jobs.filter(
      (j) =>
        j.kind === "turn" &&
        (j.input as { trigger?: string }).trigger !== "ruling",
    );
    expect(turns.map((j) => j.error ?? j.status)).toEqual(["succeeded"]);

    const rows = await readRows(w);
    const seqOfType = (type: string, nth: "first" | "last" = "first") => {
      const hits = rows.filter((r) => r.type === type);
      const hit = nth === "first" ? hits[0] : hits.at(-1);
      if (!hit) throw new Error(`no ${type} row`);
      return hit.seq;
    };
    const resolved = rows.find(
      (r) =>
        r.type === "action.resolved" &&
        (r.payload as { actionId: string }).actionId === "act-tamsin-5",
    );
    const resolvedPayload = resolved?.payload as {
      outcome: string;
      batchIds: string[];
    };
    expect(resolvedPayload.outcome).toBe("applied");
    expect(resolvedPayload.batchIds.length).toBeGreaterThanOrEqual(1);

    const committedSeq = seqOfType("action.committed", "last");
    const checkSeq = seqOfType("check.resolved", "last");
    const resolvedSeq = resolved?.seq ?? -1;
    const endedSeq = seqOfType("encounter.ended");
    const freedSeq = seqOfType("table-mode.changed", "last");
    const narrationSeq = seqOfType("narration", "last");
    expect(committedSeq).toBeLessThan(resolvedSeq);
    expect(committedSeq).toBeLessThan(checkSeq);
    expect(checkSeq).toBeLessThan(resolvedSeq);
    expect(resolvedSeq).toBeLessThan(endedSeq);
    expect(endedSeq).toBeLessThan(freedSeq);
    expect(freedSeq).toBeLessThan(narrationSeq);

    // No turn advance after the encounter ended.
    expect(
      rows.some((r) => r.type === "turn.advanced" && r.seq > endedSeq),
    ).toBe(false);

    // The shipped narration carries no refusal text.
    const narration = rows.filter((r) => r.type === "narration").at(-1);
    const text = String(
      (narration?.payload as { text?: string } | undefined)?.text,
    );
    expect(text).not.toContain("cannot do that here");

    // The table ends in free mode; the encounter is gone.
    const after = await w.projections();
    expect(after.tableMode.mode).toBe("free");
    expect(after.encounter).toBeNull();
  });
});
