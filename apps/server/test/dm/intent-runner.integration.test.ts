import { afterAll, describe, expect, it } from "vitest";
import type { ResolveOutput } from "../../src/dm/nodes/resolve.js";
import {
  checkBeside,
  commitAction,
  createWorld,
  db,
  loudSkip,
  reachable,
  readRows,
  stage,
  stages,
  startScene,
  type World,
} from "./world.js";

/**
 * Spec 104 Phase 3: resolve runs Intent stages through the real gate and planner (fake gateway,
 * scripted dice). One group per kind family: check, combat action, movement, deed.
 */

loudSkip("intent-runner.integration.test.ts");
afterAll(async () => {
  await db?.$client.end();
});

async function run(
  w: World,
  readings: unknown[],
  extra: Parameters<World["runResolve"]>[0] = {},
) {
  const { result } = await w.runResolve({
    readings: readings as never,
    ...extra,
  });
  if (!result.ok) throw new Error(`resolve failed: ${result.error.message}`);
  return result.output as ResolveOutput;
}

const ruling = (value: object) => ({
  purpose: "dm.adjudicate",
  respond: { type: "json", value },
});

const carriers = async (w: World) =>
  (await readRows(w)).filter((r) => r.type === "intent.recorded");

describe.skipIf(!reachable)("Intent runner (database)", () => {
  it("smoke: a check stage settles and the action applies", async () => {
    const w = await createWorld({
      dice: [15],
      calls: [ruling({ decision: "accept", difficulty: "medium" })],
    });
    await startScene(w);
    const id = await commitAction(w, "Tamsin forces the shutter.");
    const out = await run(w, [
      stages(id, [
        stage(
          {
            kind: "check",
            params: { skill: "athletics", difficulty: "medium" },
          },
          checkBeside(),
        ),
      ]),
    ]);
    expect(out.actionResults[0]).toMatchObject({
      actionId: id,
      outcome: "applied",
    });
    const rows = await carriers(w);
    expect(rows.map((r) => (r.payload as { outcome: string }).outcome)).toEqual(
      ["declared", "settled"],
    );
  });
});
