import type { TurnCheckpoint } from "../jobs.js";
import {
  depsFor,
  type ModelCallRecord,
  NODE_NAMES,
  type Node,
  type NodeError,
  type NodeName,
  type NodeOutputs,
  type NodeResult,
  type TurnContext,
  type TurnOutcome,
} from "./context.js";

/**
 * The turn runner (contracts/node-seam.md "The runner"): fixed node order,
 * one conditional branch (adjudicate or not), checkpoint reuse for the
 * planning nodes, fence checks between nodes. No dynamic routing, no cycle.
 *
 * Phase 4 extends the final step: narration submission runs through
 * resolve's submitter after audit decides what ships.
 */

export type Nodes = { [N in NodeName]: Node<N> };

const CHECKPOINTED = ["director", "interpret", "adjudicate"] as const;
type Checkpointed = (typeof CHECKPOINTED)[number];

function isCheckpointed(name: NodeName): name is Checkpointed {
  return (CHECKPOINTED as readonly string[]).includes(name);
}

const fenced = (node: NodeName): TurnOutcome => ({
  status: "failed",
  node,
  error: { kind: "fenced", message: "the lease was lost" },
  calls: [],
});

async function safeRun<N extends NodeName>(
  node: Node<N>,
  name: N,
  ctx: TurnContext,
): Promise<NodeResult<N>> {
  try {
    return await node({ ...ctx, deps: depsFor(ctx.deps, name) });
  } catch (error) {
    ctx.deps.log({
      event: "dm.node.threw",
      node: name,
      jobId: ctx.job.id,
      message: error instanceof Error ? error.message : String(error),
    });
    const err: NodeError = {
      kind: "internal",
      message: `the ${name} node threw`,
    };
    return { ok: false, node: name, error: err, calls: [] };
  }
}

/** True when at least one interpret reading asks for a rules ruling. */
function needsAdjudication(ctx: TurnContext): boolean {
  return (
    ctx.results.interpret?.readings.some((r) => r.needsAdjudication) ?? false
  );
}

export async function runTurn(
  ctx0: TurnContext,
  nodes: Nodes,
): Promise<TurnOutcome> {
  let ctx = ctx0;
  const calls: ModelCallRecord[] = [];

  const fail = (node: NodeName, error: NodeError): TurnOutcome => ({
    status: "failed",
    node,
    error,
    calls,
  });

  const store = async (c: TurnCheckpoint): Promise<boolean> => {
    const ok = await ctx.deps.saveCheckpoint(c);
    if (ok) ctx = { ...ctx, checkpoint: c };
    return ok;
  };

  for (const name of NODE_NAMES) {
    if (ctx.signal.aborted) {
      return fail(name, { kind: "aborted", message: "the turn was aborted" });
    }
    if (!(await ctx.deps.fence())) return fenced(name);
    if (!(await ctx.deps.setStage(name))) return fenced(name);

    // Checkpoint reuse: a reclaimed job skips the calls it already paid for.
    if (isCheckpointed(name) && ctx.checkpoint[name] !== null) {
      ctx = {
        ...ctx,
        results: { ...ctx.results, [name]: ctx.checkpoint[name] },
      };
    } else if (name === "adjudicate" && !needsAdjudication(ctx)) {
      ctx = {
        ...ctx,
        results: { ...ctx.results, adjudicate: { rulings: [] } },
      };
    } else {
      const result = await safeRun(nodes[name] as Node<NodeName>, name, ctx);
      calls.push(...result.calls);
      if (!result.ok) return fail(name, result.error);
      ctx = {
        ...ctx,
        results: { ...ctx.results, [name]: result.output },
      };
      if (isCheckpointed(name)) {
        const saved = await store({
          ...ctx.checkpoint,
          [name]: result.output,
        } as TurnCheckpoint);
        if (!saved) return fenced(name);
      }
    }

    if (name === "assemble") {
      const assembled = ctx.results.assemble as NodeOutputs["assemble"];
      if (ctx.checkpoint.beat === null) {
        const saved = await store({
          ...ctx.checkpoint,
          beat: assembled.beat.map((b) => b.actionId),
          npcTurn: assembled.npcTurn
            ? { combatantId: assembled.npcTurn.combatantId }
            : null,
        });
        if (!saved) return fenced(name);
      }
      if (
        assembled.beat.length === 0 &&
        assembled.npcTurn === null &&
        ctx.job.trigger !== "scene-start"
      ) {
        return { status: "empty-beat" };
      }
    }

    if (name === "director") {
      const director = ctx.results.director as NodeOutputs["director"];
      if (director.beat.decision === "hold") {
        // Hold mode: resolve applies the Director's proposals only.
        if (!(await ctx.deps.fence())) return fenced("resolve");
        if (!(await ctx.deps.setStage("resolve"))) return fenced("resolve");
        const held = await safeRun(nodes.resolve, "resolve", ctx);
        calls.push(...held.calls);
        if (!held.ok) return fail("resolve", held.error);
        return { status: "held", companions: director.beat.companions };
      }
    }
  }

  return {
    status: "completed",
    results: ctx.results as NodeOutputs,
    calls,
  };
}
