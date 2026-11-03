import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve as resolvePath } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { listDmJobs } from "../../src/dm/jobs.js";
import { listModelCalls } from "../../src/dm/model-calls.js";
import { PURPOSE_OF } from "../../src/dm/purposes.js";
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
 * The merge condition (runbook, AC #1, #2, #4, #8, #9, #15): one full turn on
 * this worktree's own stack, through the real worker, queue, gate and
 * engine, against the fake gateway with scripted dice.
 */

loudSkip("full-turn.integration.test.ts");
afterAll(async () => {
  await db?.$client.end();
});
clearDmJobsBeforeEach();

describe.skipIf(!reachable)("one full turn (database)", () => {
  it("runs the search turn end to end and passes its audit", async () => {
    const s = script("exploration-check.json");
    const w = await createWorld({
      dice: s.dice,
      calls: [
        ...s.calls,
        {
          purpose: "dm.chronicle",
          respond: { type: "json", value: { entries: [] } },
        },
      ],
    });
    const { worker } = workerFor(w);
    await startScene(w);
    await commitAction(
      w,
      "I search the ferry-house for whoever cut the bell rope.",
      "act-search",
    );
    await tick();
    await drainAll(worker);

    // The job record: one turn job, succeeded, completed.
    const all = (await listDmJobs(requireDb(), w.sessionId, 20)).reverse();
    const turns = all.filter((j) => j.kind === "turn");
    expect(turns.map((j) => j.error ?? j.status)).toEqual(["succeeded"]);
    const turn = turns[0];
    const result = turn?.result as {
      outcome: { status: string };
      audit: {
        final: string;
        flagged: boolean;
        attempts: { deterministic: { pass: boolean } }[];
      };
      calls: { purpose: string; outcome: string; attempt: number }[];
    };
    expect(result.outcome.status).toBe("completed");

    // AC #2 and #4: the node order, and one purpose per node.
    expect(result.calls.map((c) => c.purpose)).toEqual([
      PURPOSE_OF.director,
      PURPOSE_OF.interpret,
      PURPOSE_OF.narrate,
      PURPOSE_OF.audit,
    ]);
    expect(
      result.calls.every((c) => c.outcome === "ok" && c.attempt === 1),
    ).toBe(true);

    // Merge condition (TASK-0116): one ledger row per model call of the turn,
    // each matching its stored call entry, with usage recorded.
    const ledger = (
      await listModelCalls(requireDb(), w.sessionId, { after: 0, limit: 100 })
    ).rows.filter((r) => r.jobId === turn?.id);
    expect(ledger).toHaveLength(result.calls.length);
    const stored = result.calls as unknown as {
      purpose: string;
      promptVersion: string;
      attempt: number;
      provider: string | null;
      model: string | null;
      inputTokens: number | null;
      outputTokens: number | null;
      costUsd: number | null;
      durationMs: number | null;
    }[];
    for (const [i, row] of ledger.entries()) {
      const c = stored[i];
      expect(row.jobKind).toBe("turn");
      expect(row.purpose).toBe(c?.purpose);
      expect(row.promptVersion).toBe(c?.promptVersion);
      expect(row.callAttempt).toBe(c?.attempt);
      expect(row.provider).toBe(c?.provider);
      expect(row.model).toBe(c?.model);
      expect(row.inputTokens).toBe(c?.inputTokens);
      expect(row.outputTokens).toBe(c?.outputTokens);
      expect(row.costUsd).toBe(c?.costUsd);
      expect(row.durationMs).toBe(c?.durationMs);
      expect(row.provider).not.toBeNull();
      expect(row.model).not.toBeNull();
      expect(row.inputTokens).not.toBeNull();
      expect(row.outputTokens).not.toBeNull();
    }

    // AC #8: the audit passed on the first attempt.
    expect(result.audit.final).toBe("passed");
    expect(result.audit.flagged).toBe(false);
    expect(result.audit.attempts[0]?.deterministic.pass).toBe(true);

    // The ledger rows the turn wrote carry the job's marker; the roll is the scripted one.
    const p = await w.projections();
    const mine = p.ledger.filter((r) => r.reason.includes(`[${turn?.id}#`));
    expect(mine.length).toBeGreaterThan(0);
    const rolls = p.ledger.filter(
      (r) => r.kind === "roll" && r.reason.includes(`[${turn?.id}#`),
    );
    expect(rolls).toHaveLength(1);

    // The narration's dice line is the renderer's output, appended by code.
    const rows = await readRows(w);
    const narrations = rows.filter((r) => r.type === "narration");
    expect(narrations).toHaveLength(1);
    const text = String((narrations[0]?.payload as { text?: string })?.text);
    const [prose, ...lines] = text.split("\n\n");
    expect(prose).not.toMatch(/[0-9]/);
    expect(lines.join("\n")).toMatch(/1d20 → 14 = 14/);
    expect(lines.join("\n")).toMatch(/DC 10: success/);

    // The shipped narration's seqs are stored on the checkpoint.
    const stored2 = turn?.result as unknown as {
      checkpoint: { narration: { seqs: number[] } };
    };
    expect(stored2.checkpoint.narration.seqs).toEqual([narrations[0]?.seq]);

    // The tracker step is a dm-only row; the player view has none of it.
    const tracker = rows.filter((r) => r.type === "tracker.changed").at(-1);
    expect(tracker?.visibility).toBe("dm");

    // A chronicle job followed and the script is spent: no unused response.
    expect(
      all.filter((j) => j.kind === "chronicle").map((j) => j.status),
    ).toEqual(["succeeded"]);
    expect(w.scripted.remaining()).toEqual({
      calls: expect.objectContaining({
        "dm.director": 0,
        "dm.interpret": 0,
        "dm.adjudicate": 0,
        "dm.narrate": 0,
        "dm.audit": 0,
        "dm.companion": 0,
        "dm.chronicle": 0,
      }),
      dice: 0,
    });

    const out = process.env.DM_EVIDENCE_OUT;
    if (out) {
      const file = resolvePath(out);
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(
        file,
        `${JSON.stringify(
          {
            task: "TASK-0046",
            script: "exploration-check.json",
            jobId: turn?.id,
            nodes: result.calls.map((c) => c.purpose),
            rollCount: rolls.length,
            ledger: mine,
            narration: text,
            audit: result.audit,
          },
          null,
          2,
        )}\n`,
      );
    }
  });
});
