import { SKILL_ABILITY } from "@the-stacks/dnd5e-engine";
import { type Intent, type IntentKind, toText } from "@the-stacks/intent";
import { stepOutcome } from "@the-stacks/planner";
import type {
  GateRefusal,
  LedgerRow,
  Proposer,
  SessionProjections,
} from "@the-stacks/session-model";
import type { BeatItem } from "./nodes/assemble.js";
import { actorOfItem, stampIntent } from "./nodes/interpret.js";
import type { Run, Submission } from "./nodes/resolve.js";
import type { Effect, InterpretStage } from "./nodes/schemas.js";
import { answerRulings } from "./rulings.js";
import { clueFor, effectsForBand, isFreeRetry } from "./stakes.js";

/**
 * Resolve's Intent runner (specs/104 plan D5): submits each interpret stage as an `intent`
 * request, in order, and branches on the gate's carrier rows. The planner and gate own legality;
 * this module owns order, the declare-then-confirm seat rule (OQ-1), band effects and the legacy
 * free-retry fallback (FR-014).
 */

const AI_DM: Proposer = { kind: "ai", actor: "ai:dm" };

export interface ChainResult {
  batchIds: string[];
  awaiting: boolean;
  /** The engine refused the first mechanics step and nothing applied. */
  firstRefusal: GateRefusal | null;
}

export function effectCommand(
  effect: Exclude<Effect, { effect: "presence" }>,
  critical: boolean,
  reason: string,
): { key: string; command: Record<string, unknown>; reason: string } {
  switch (effect.effect) {
    case "damage":
      return {
        key: "damage",
        reason: `${reason}: damage`,
        command: {
          type: "damage.apply",
          targetId: effect.targetId,
          components: effect.components,
          critical,
          defenses: effect.defenses,
        },
      };
    case "heal":
      return {
        key: "heal",
        reason: `${reason}: healing`,
        command: {
          type: "healing.apply",
          targetId: effect.targetId,
          amount: effect.amount,
        },
      };
    case "condition":
      return effect.op === "apply"
        ? {
            key: "condition",
            reason: `${reason}: ${effect.condition}`,
            command: {
              type: "condition.apply",
              targetId: effect.targetId,
              condition: effect.condition,
              source: effect.source,
              expiresAt: null,
            },
          }
        : {
            key: "condition",
            reason: `${reason}: ${effect.condition} ends`,
            command: {
              type: "condition.remove",
              targetId: effect.targetId,
              condition: effect.condition,
            },
          };
  }
}

/** Who a stage list acts for: a beat item (declared, then confirmed) or the monster turn. */
export type StageSource =
  | { kind: "item"; item: BeatItem }
  | { kind: "npc"; combatantId: string; jobShort: string };

/** The item's own proposer: the human's user id, or the AI companion's actor string. */
export function proposerOf(item: BeatItem): Proposer {
  return item.actor.startsWith("ai:companion:")
    ? { kind: "ai", actor: item.actor as `ai:companion:${string}` }
    : { kind: "human", userId: item.actor, role: "player" };
}

/** The combatant a stage's actor drives, else null. */
export function actorCombatant(
  p: SessionProjections,
  actor: Intent["actor"],
): string | null {
  if (actor.kind === "npc") return actor.id;
  if (actor.kind === "pc" || actor.kind === "companion") {
    return p.party.find((m) => m.characterId === actor.id)?.combatantId ?? null;
  }
  return null;
}

const RETRY_KINDS: readonly IntentKind[] = ["check", "save"];

/** The engine events of the outcome rows of `batchIds`, for `stepOutcome`. */
function batchEvents(
  ledger: readonly LedgerRow[],
  batchIds: readonly string[],
) {
  return ledger.flatMap((r) =>
    r.kind === "outcome" && batchIds.includes(r.batchId) ? [r.outcome] : [],
  );
}

/** Runs one action's (or the monster turn's) stages in order. */
export async function runStages(
  run: Run,
  prefix: string,
  stages: readonly InterpretStage[],
  actionId: string | null,
  source: StageSource,
): Promise<ChainResult> {
  const { ctx } = run;
  const chain: ChainResult = {
    batchIds: [],
    awaiting: false,
    firstRefusal: null,
  };
  let stopped = false;

  /** Returns true when the chain may continue after this submission. */
  const take = (sub: Submission, first: boolean): boolean => {
    if (sub.result === "applied") {
      if (sub.batchId) chain.batchIds.push(sub.batchId);
      return true;
    }
    if (sub.result === "refused") {
      if (first && chain.batchIds.length === 0)
        chain.firstRefusal = sub.refusal;
    } else chain.awaiting = true;
    stopped = true;
    return false;
  };

  const runEffects = async (
    key: string,
    effects: readonly Effect[],
    reason: string,
  ): Promise<void> => {
    for (const [j, effect] of effects.entries()) {
      if (stopped) return;
      if (effect.effect === "presence") {
        const sub = await run.submit(`${key}:e${j}`, "scene-presence", () => ({
          kind: "scene-presence",
          summary: `${reason}: ${effect.targetId} ${effect.reason}`.slice(
            0,
            200,
          ),
          rationale: `Resolve ${key}:e${j}`,
          actorId: effect.targetId,
          reason: effect.reason,
          actionId,
          visibility: "public",
        }));
        take(sub, false);
        continue;
      }
      const e = effectCommand(effect, false, reason);
      take(
        await run.mech(`${key}:e${j}`, e.command, e.reason, actionId),
        false,
      );
    }
  };

  for (const [n, stage] of stages.entries()) {
    if (stopped) break;
    const key = `${prefix}:i${n}`;
    const stamp = (commit: Intent["commit"]) => {
      const actor =
        source.kind === "npc"
          ? ({ kind: "npc", id: source.combatantId } as const)
          : actorOfItem(source.item);
      if (!actor) return null;
      const res = stampIntent(stage.intent, {
        id:
          source.kind === "npc"
            ? `npc.${source.jobShort}.${n}`
            : `${source.item.actionId}.${n}`,
        actor,
        source: "ai",
        commit,
      });
      return res.ok ? res.intent : null;
    };
    const declared = stamp("declared");
    const confirmed = stamp("confirmed");
    if (!declared || !confirmed) {
      // interpret validated every stage; a failure here is a stale or hand-built reading.
      if (n === 0) {
        chain.firstRefusal = {
          source: "gate",
          code: "INTENT_SCHEMA",
          message: "the stage is not a valid Intent",
        };
      }
      break;
    }
    const { beside } = stage;
    const reason = (toText(confirmed) || confirmed.kind).slice(0, 500);
    const fresh0 = await ctx.deps.loadProjections(ctx.job.sessionId);

    // FR-014: a free retry and an auto-fail keep today's `check.roll` proposal.
    const rollerId = actorCombatant(fresh0, confirmed.actor);
    const legacyRoll =
      beside !== null &&
      RETRY_KINDS.includes(confirmed.kind) &&
      rollerId !== null &&
      (beside.autoFail !== null ||
        (confirmed.kind === "check" &&
          isFreeRetry(
            {
              kind: "ability-check",
              combatantId: rollerId,
              ability: abilityOf(confirmed),
              skill: skillOf(confirmed),
              newRisk: beside.newRisk,
              autoFail: beside.autoFail,
            },
            fresh0.ledger,
          )));

    let sub: Submission;
    if (legacyRoll && beside && rollerId) {
      const { outcomeBands, naturals } = ctx.seed.tableRules;
      const params = confirmed.params as {
        difficulty?: string;
        mode?: string;
      };
      sub = await run.mech(
        key,
        {
          type: "check.roll",
          combatantId: rollerId,
          kind: confirmed.kind === "save" ? "saving-throw" : "ability-check",
          ability: abilityOf(confirmed),
          skill: skillOf(confirmed),
          difficulty: params.difficulty ?? "medium",
          mode: params.mode ?? "normal",
          autoFail: beside.autoFail,
          houseRules: { outcomeBands, naturals },
          autoSuccess:
            beside.autoFail === null && confirmed.kind === "check"
              ? { reason }
              : null,
        },
        reason,
        actionId,
        beside.stakes,
      );
      if (!take(sub, n === 0)) break;
    } else {
      // A reclaim whose earlier attempt landed this stage before its checkpoint save: skip the
      // submissions the log already holds (the same id would refuse INTENT_EXISTS).
      // ponytail: the landed stage's batch id is not recovered (IntentView holds none), so its
      // band effects and fact rows reach this beat through the narrate window only.
      const landed = fresh0.intents.find((v) => v.id === confirmed.id)?.status;
      const recorded = run.submissions.some((s) => s.key === key);
      if (!recorded && (landed === "settled" || landed === "answered"))
        continue;
      if (source.kind === "item" && landed !== "declared") {
        const d = await run.submit(
          `${key}:d`,
          "intent",
          () => intentProposal(declared, key, reason),
          null,
          proposerOf(source.item),
        );
        if (!take(d, n === 0)) break;
      }
      sub = await run.submit(
        key,
        "intent",
        () => intentProposal(confirmed, key, reason),
        beside?.stakes ?? null,
        AI_DM,
      );
      if (!take(sub, n === 0)) break;
      // The carrier row says whether the planner settled the Intent.
      let p = await ctx.deps.loadProjections(ctx.job.sessionId);
      let status = p.intents.find((v) => v.id === confirmed.id)?.status;
      if (status === "needs_ruling") {
        if (p.gate.seat.kind !== "ai") {
          chain.awaiting = true;
          break;
        }
        const before = p.throughSeq;
        await answerRulings(ctx.deps, ctx.job.sessionId, ctx.signal);
        p = await ctx.deps.loadProjections(ctx.job.sessionId);
        status = p.intents.find((v) => v.id === confirmed.id)?.status;
        if (status !== "answered") {
          ctx.deps.log({
            event: "dm.intent.ruling-open",
            jobId: ctx.job.id,
            intentId: confirmed.id,
          });
          break;
        }
        const ruled = [
          ...new Set(
            p.ledger.flatMap((r) =>
              r.seq > before && r.batchId ? [r.batchId] : [],
            ),
          ),
        ];
        sub.batchId = ruled[0] ?? sub.batchId;
        for (const b of ruled) if (b !== sub.batchId) chain.batchIds.push(b);
        if (sub.batchId) chain.batchIds.push(sub.batchId);
      } else if (status === "declared" || status === undefined) {
        break; // the confirm left no carrier: nothing settled
      } else if (sub.batchId) {
        chain.batchIds.push(sub.batchId);
      }
    }

    if (!beside) continue;
    // FR-013, FR-015: the band decides the effects; a reveal rides the settled stage.
    const p = await ctx.deps.loadProjections(ctx.job.sessionId);
    const events = sub.batchId ? batchEvents(p.ledger, [sub.batchId]) : [];
    const band =
      sub.band ??
      sub.outcome ??
      (events.length > 0 ? stepOutcome(events) : null);
    sub.reveals = beside.reveals ?? null;
    sub.revealedText = clueFor(ctx.seed, sub.reveals);
    if (sub.reveals && sub.revealedText === null) {
      ctx.deps.log({
        event: "dm.reveals.unknown",
        jobId: ctx.job.id,
        reveals: sub.reveals,
      });
    }
    await runEffects(key, effectsForBand(beside, band), reason);
  }
  chain.batchIds = [...new Set(chain.batchIds)];
  return chain;
}

function intentProposal(intent: Intent, key: string, reason: string) {
  return {
    kind: "intent" as const,
    summary: reason.slice(0, 200),
    rationale: `Resolve ${key}`,
    intent,
  };
}

function skillOf(i: Intent) {
  return (i.params as { skill?: never }).skill ?? null;
}

function abilityOf(i: Intent) {
  const { ability, skill } = i.params as { ability?: never; skill?: never };
  return ability ?? SKILL_ABILITY[skill as never];
}
