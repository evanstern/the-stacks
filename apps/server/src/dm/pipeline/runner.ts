import { createHash } from "node:crypto";
import { cutPlans, holdDirector } from "../first-stage.js";
import type { TurnCheckpoint } from "../jobs.js";
import { findLandedNarration, submitNarration } from "../nodes/resolve.js";
import { SnapshotOverflowError } from "../snapshot/index.js";
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
 * The final step ships the narration audit chose: `submitNarration`, which
 * lives in resolve's module so every gate call stays there (AC #5).
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
    if (error instanceof SnapshotOverflowError) {
      ctx.deps.log({
        event: "dm.node.state-overflow",
        node: name,
        jobId: ctx.job.id,
        ...error.detail,
      });
      const overflow: NodeError = {
        kind: "state-overflow",
        message: `the ${name} node's state does not fit its cap`,
        detail: { ...error.detail, node: name },
      };
      return { ok: false, node: name, error: overflow, calls: [] };
    }
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
  const resumed = new Set(
    (ctx.results.assemble?.resumed ?? []).map((p) => p.actionId),
  );
  return (
    ctx.results.interpret?.readings.some(
      (r) =>
        r.needsAdjudication &&
        !(r.actionId !== null && resumed.has(r.actionId)),
    ) ?? false
  );
}

export async function runTurn(
  ctx0: TurnContext,
  nodes: Nodes,
): Promise<TurnOutcome> {
  let ctx = ctx0;
  const calls: ModelCallRecord[] = [];
  /** Set when a reclaim finds the narration already on the log. */
  let landedNarration: { seq: number; text: string } | null = null;

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

    if (name === "narrate" && ctx.job.attempt > 1 && ctx.results.resolve) {
      landedNarration = await findLandedNarration(
        ctx,
        ctx.results.resolve.lastSeq,
      );
    }
    if (landedNarration && (name === "narrate" || name === "audit")) {
      // A reclaim after the narration landed: ship nothing, spend no calls.
      if (name === "audit") {
        const audit: NodeOutputs["audit"] = {
          record: {
            attempts: [],
            final: "passed",
            flagged: false,
            shippedProseSha256: createHash("sha256")
              .update(landedNarration.text)
              .digest("hex"),
          },
          shipped: null,
        };
        ctx = { ...ctx, results: { ...ctx.results, audit } };
      }
      continue;
    }

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
          resumed: assembled.resumed ?? [],
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

    if (name === "adjudicate" && !ctx.checkpoint.cut) {
      // Post-planning step (specs/064): cut plans to their first stage.
      const interpreted = ctx.results.interpret;
      const director = ctx.results.director;
      if (
        interpreted &&
        director &&
        director.beat.decision !== "hold" &&
        ctx.results.adjudicate
      ) {
        const adjudicated = ctx.results.adjudicate;
        const cut = cutPlans({
          mode:
            (ctx.results.assemble as NodeOutputs["assemble"]).projections
              .tableMode?.mode ?? "turn",
          readings: interpreted.readings,
          rulings: adjudicated.rulings,
        });
        const cutBeat =
          cut.readings.some((r) => r.followUps.length > 0) ||
          cut.rulings.some((r) => r.followUps.length > 0);
        const held = holdDirector(director, cutBeat);
        ctx = {
          ...ctx,
          results: {
            ...ctx.results,
            interpret: { ...interpreted, readings: cut.readings },
            adjudicate: { ...adjudicated, rulings: cut.rulings },
            director: held,
          },
        };
        const saved = await store({
          ...ctx.checkpoint,
          interpret: ctx.results.interpret ?? null,
          adjudicate: ctx.results.adjudicate ?? null,
          director: held,
          cut: true,
        });
        if (!saved) return fenced(name);
        ctx.deps.log({
          event: "dm.plan.cut",
          jobId: ctx.job.id,
          readings: cut.readings.filter((r) => r.followUps.length > 0).length,
          rulings: cut.rulings.filter((r) => r.followUps.length > 0).length,
        });
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
        return {
          status: "held",
          companions: director.beat.companions,
          calls,
        };
      }
    }
  }

  if (landedNarration && ctx.results.resolve) {
    ctx = {
      ...ctx,
      results: {
        ...ctx.results,
        resolve: { ...ctx.results.resolve, chronicle: true },
      },
    };
  }

  // Final step: ship what audit decided (stub nodes leave `shipped` unset).
  const audited = ctx.results.audit;
  if (audited?.shipped) {
    const resolved = ctx.results.resolve;
    const checkpoint: TurnCheckpoint = {
      ...ctx.checkpoint,
      submissions: resolved?.submissions ?? ctx.checkpoint.submissions,
      lastSeq: resolved?.lastSeq ?? ctx.checkpoint.lastSeq,
      ...(resolved ? { planGate: resolved.planGate } : {}),
    };
    if (!(await ctx.deps.fence())) return fenced("resolve");
    const shipped = await submitNarration(ctx, audited, checkpoint);
    if (!shipped.ok) return fail("resolve", shipped.error);
    if (shipped.shipped && resolved) {
      ctx = {
        ...ctx,
        results: { ...ctx.results, resolve: { ...resolved, chronicle: true } },
      };
    }
  }

  return {
    status: "completed",
    results: ctx.results as NodeOutputs,
    calls,
  };
}
