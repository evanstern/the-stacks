import { mechanicsProposal } from "@the-stacks/session-model";
import type { ResolveOutput } from "../../src/dm/nodes/resolve.js";
import { createWorld, readRows, startScene, type World } from "./world.js";

/** Shared setup for the spec 099 encounter lifecycle integration tests. */
export const DM = { kind: "ai", actor: "ai:dm" } as const;
let jobN = 0;
export const nextJob = () => ({
  id: `00000000-0000-4000-8000-${String(990 + ++jobN).padStart(12, "0")}`,
});
/** Initiative dice for party (tamsin, odo, kestrel) then monsters: `first` rolls 20. */
export const initDice = (first: number, n = 7) =>
  Array.from({ length: n }, (_, i) => (i === first ? 20 : 1));

export async function run(
  w: World,
  extra: Parameters<World["runResolve"]>[0] = {},
) {
  const { result } = await w.runResolve({ ...extra });
  if (!result.ok) throw new Error(`resolve failed: ${result.error.message}`);
  return result.output as ResolveOutput;
}

export const fresh = (w: World) => {
  w.checkpoint.current = {
    ...w.checkpoint.current,
    submissions: [],
    lastSeq: 0,
  };
};

/** One scripted AI-seat ruling: a deed with no roll is accepted (spec 104). */
export const acceptDeed = {
  purpose: "dm.adjudicate",
  respond: {
    type: "json",
    value: { decision: "accept", reason: "It happens." },
  },
};
export const turnInto = (id = "reed-camp") => ({
  tableMode: { to: "turn" as const, encounterId: id, reason: "Fight." },
});

/** Scene started, then turn mode in reed-camp. */
export async function inTurnMode(dice: number[], calls: unknown[] = []) {
  const w = await createWorld({ dice, calls });
  await startScene(w);
  await run(w, { director: turnInto(), job: nextJob() });
  fresh(w);
  return w;
}

/** An engine command through the gate as the DM; throws on refusal. */
export async function cmd(w: World, command: Record<string, unknown>) {
  const res = await w.gate.submit(
    w.sessionId,
    DM,
    mechanicsProposal({ reason: "setup", ...command } as never, {
      actionId: null,
      summary: "setup",
      rationale: "setup",
    }),
  );
  if (!res.ok) throw new Error(`setup refused: ${res.refusal.code}`);
}

export async function rowsAfter(w: World, start: number) {
  return (await readRows(w)).slice(start);
}
export const types = (rows: { type: string }[]) => rows.map((r) => r.type);
export const count = (rows: { type: string }[], type: string) =>
  rows.filter((r) => r.type === type).length;
export const eventOf = (r: { payload: unknown }) =>
  (r.payload as { event: Record<string, any> }).event;
