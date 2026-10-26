import { afterAll, describe, expect, it } from "vitest";
import { assemble } from "../../src/dm/nodes/assemble.js";
import type { ResolveOutput } from "../../src/dm/nodes/resolve.js";
import {
  checkStep,
  commitAction,
  createWorld,
  db,
  HUMAN_DM,
  loudSkip,
  operator,
  reachable,
  reading,
  readRows,
  startScene,
} from "./world.js";

loudSkip("resolve.human-seat.integration.test.ts");
afterAll(async () => {
  await db?.$client.end();
});

describe.skipIf(!reachable)("resolve with a human DM seat (database)", () => {
  it("comes back pending, leaves the action committed, and the approval shows in priorSteps", async () => {
    const w = await createWorld({ dice: [15] });
    await startScene(w);
    // A human takes the DM seat; default policies now ask for mechanics.
    const seat = await w.as(operator, {
      kind: "dm.seat",
      reason: "A human takes the DM seat",
      after: { kind: "human", userId: HUMAN_DM },
    });
    expect(seat.ok ? "ok" : seat.refusal).toBe("ok");
    const id = await commitAction(w, "Tamsin forces the shutter.");

    const { result } = await w.runResolve({
      readings: [reading(id, [checkStep()])] as never,
    });
    if (!result.ok) throw new Error(result.error.message);
    const out = result.output as ResolveOutput;
    expect(out.actionResults[0]?.outcome).toBe("awaiting-dm");
    expect(out.submissions.at(-1)).toMatchObject({ result: "pending" });
    const p = await w.projections();
    expect(p.actions.find((a) => a.actionId === id)?.status).toBe("committed");
    expect(w.scripted.remaining().dice).toBe(1);

    // The human DM approves the pending proposal.
    const pending = p.proposals.find((x) => x.status === "pending");
    expect(pending).toBeDefined();
    const approved = await w.as(operator, {
      kind: "proposal.approve",
      proposalId: pending?.proposalId,
    });
    expect(approved.ok).toBe(true);

    // The next turn's assemble sees the applied batch for the action.
    const base = w.ctx();
    const next = await assemble(base);
    if (!next.ok) throw new Error("assemble failed");
    const prior = next.output.priorSteps[id] ?? [];
    expect(prior.length).toBeGreaterThan(0);
    expect(prior.some((r) => r.kind === "outcome")).toBe(true);
    expect(w.scripted.remaining().dice).toBe(0);
    expect(
      (await readRows(w)).some((r) => r.type === "proposal.approved"),
    ).toBe(true);
  });
});
