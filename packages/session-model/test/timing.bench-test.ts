import type { EngineCommand } from "@the-stacks/dnd5e-engine";
import { describe, expect, it } from "vitest";
import { spatialFog } from "../src/fixtures/index.js";
import {
  fogRows,
  mechanicsProposal,
  type PlannedRow,
  planProposal,
  project,
  type SessionProjections,
  type Viewer,
} from "../src/index.js";

// Wall-clock budget (TASK-0308 moved it out of gate-fog.test.ts). Runs only in
// `pnpm check:timing`, serially, so parallel turbo load cannot skew it.
const dm: Viewer = { role: "dm" };
const rng = { rollDie: () => 1 };

function plan(
  p: SessionProjections,
  command: unknown,
  visibility: "public" | "dm" = "public",
): PlannedRow[] {
  const r = planProposal(
    p,
    { kind: "ai", actor: "ai:dm" },
    mechanicsProposal(command as EngineCommand, { visibility }),
    rng,
    { batchId: "t" },
    null,
  );
  if (!r.ok) throw new Error(JSON.stringify(r.refusal));
  return r.rows;
}

describe("timing (fog)", () => {
  it("64 zones and 12 rows take under 1 ms", () => {
    const zones = Array.from({ length: 64 }, (_, i) => ({
      id: `z${i}`,
      name: `Z${i}`,
      kind: "room",
      tags: [],
      hidden: i > 0,
    }));
    const edges = zones.slice(1).map((z, i) => ({
      from: `z${i}`,
      to: z.id,
      kind: "open",
      feet: 10,
    }));
    const p = project(
      [
        ...plan(project([], dm), {
          type: "space.define",
          space: { zones, edges },
          reason: "r",
        }).map((r, i) => ({
          sessionId: spatialFog.sessionId,
          seq: i + 1,
          actor: r.actor,
          type: r.type,
          payload: r.payload,
          payloadVersion: 1,
          visibility: r.visibility,
          ts: "2026-10-26T18:00:00.000Z",
        })),
      ],
      dm,
    );
    const rows = Array.from({ length: 12 }, (_, i) => ({
      actor: "ai:dm",
      type: "combatant.placed",
      visibility: "public",
      payload: {
        batchId: "t",
        index: i,
        count: 12,
        actionId: null,
        proposalId: null,
        event: {
          type: "combatant.placed",
          v: 1,
          reason: "r",
          combatantId: "x",
          before: null,
          after: { zoneId: `z${i + 1}` },
        },
      },
    }));
    fogRows(p, rows);
    const t0 = performance.now();
    fogRows(p, rows);
    expect(performance.now() - t0).toBeLessThan(1);
  });
});
