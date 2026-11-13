import {
  type AttackEntry,
  type EngineCommand,
  encounterOver,
  findAttack,
  firstMeleeAttack,
  RefusalCodeSchema,
} from "@the-stacks/dnd5e-engine";
import {
  activeActorFor,
  canAct,
  floorHeld,
  type GateRefusal,
  mechanicsProposal,
  type Proposal,
  type ProposalKind,
  type Proposer,
  REASON_TO_PRESENCE,
  type SessionProjections,
  type StoredEvent,
  type TableMode,
} from "@the-stacks/session-model";
import type { Gate } from "../../gate/index.js";
import { clarifyHolds } from "../first-stage.js";
import {
  arrivingMonsters,
  arrivingNpcs,
  checkPlan,
  eligibleMonsters,
  encounterPhase,
  encounterToStart,
  type PlanVerdict,
  stageActors,
  stepActors,
  TURN_HELD_CODE,
} from "../gates/plan-gate.js";
import {
  type ChainResult,
  effectCommand,
  runStages,
} from "../intent-runner.js";
import type { TurnCheckpoint } from "../jobs.js";
import type { Node, NodeError, TurnContext } from "../pipeline/context.js";
import { reactors } from "../reactions.js";
import { refreshSubmission } from "../resume.js";
import { combatantFromSrd, statsFromCharacter } from "../seed/combatants.js";
import type { SceneSeed } from "../seed/schema.js";
import { namedActorIds } from "../snapshot/aliases.js";
import {
  type ActorSnapshot,
  buildSnapshot,
  diffSnapshots,
  type SnapshotDiff,
} from "../snapshot/index.js";
import { bandTexts, clueFor, effectsForBand, isFreeRetry } from "../stakes.js";
import type { AssembleOutput, BeatItem } from "./assemble.js";
import type { CheckOutput } from "./check.js";
import type { DirectorNodeOutput } from "./director.js";
import {
  type AnyInterpretReading,
  type Beside,
  type Effect,
  hasStages,
  type InterpretStage,
  type Stakes,
  type Step,
} from "./schemas.js";
import { settleTurn } from "./settle.js";

/**
 * The resolve node (contracts/resolve.md): the one module that writes, and
 * only through `gate.submit` as `ai:dm`. It picks every next step from engine
 * events alone; no model is read here. Each submission is checkpointed, so a
 * reclaimed job replays recorded submissions and looks for the in-flight
 * one's marker (FR-006).
 *
 * Group order (decision-0025 §4, contracts/turn-jobs.md "Resolve order"):
 * Director opening moves, rulings, action groups, NPC group, Director closing
 * moves, turn advance. The batch gate (TASK-0147) slots between the closing
 * moves and the turn advance.
 */

export const AI_DM = { kind: "ai", actor: "ai:dm" } as const;
const CONFLICT_DELAYS_MS = [200, 800];

export interface Submission {
  /** `<jobId>#<n>`, n counts the job's submissions. */
  stepRef: string;
  /** Semantic key; a replay matches on it (extension of resolve.md). */
  key: string;
  kind: ProposalKind;
  result: "applied" | "pending" | "suggested" | "refused";
  refusal: GateRefusal | null;
  batchId: string | null;
  proposalId: string | null;
  /** The engine outcome (`hit`, `success`, ...) read from the appended events. */
  outcome: string | null;
  /** Spec 070: the outcome band (`success-at-cost`, ...) read from the same row; null on an old row. */
  band: string | null;
  /** Spec 070: the stakes the check step declared; checkpointed, never in a public row. */
  stakes: Stakes | null;
  /** Spec 080: the clue reference the check step named, else null. Absent on an older checkpoint. */
  reveals?: string | null;
  /** Spec 080: the seed text of `reveals`; null when none or unknown. Never in a public row. */
  revealedText?: string | null;
  /** The seqs the gate returned for this submission, ascending; `[]` on a refusal or an unrecoverable replay. */
  seqs: number[];
  /** Spec 104: the carrier row's outcome of an `intent` submission (`declared`, `settled`, `needs_ruling`). */
  intentOutcome?: string | null;
}

export type ActionOutcome =
  | "applied"
  | "refused"
  | "no-effect"
  | "awaiting-dm"
  | "held";

export interface ResolveOutput {
  submissions: Submission[];
  actionResults: {
    actionId: string;
    outcome: ActionOutcome;
    batchIds: string[];
    refusalCode: string | null;
    /**
     * Batches `pullIn` wrote for this action (a joiner's initiative roll). Kept apart
     * from `batchIds`, which decide the outcome: a pull never makes an action "applied".
     */
    pullBatchIds?: string[];
    /** TASK-0244: a `held` group waits for this companion's combatant id. */
    heldFor?: string;
    /** TASK-0244: the combatant ids the group's steps name (a group that ran). */
    stepActors?: string[];
  }[];
  appendedRows: StoredEvent[];
  nextJob:
    | { kind: "turn"; trigger: "npc-turn" | "held" }
    | {
        kind: "companion";
        companions: string[];
        reason: "turn" | "prompt";
      }
    | null;
  /** True once narration applies (set by the runner after it ships). */
  chronicle: boolean;
  /** The NPC turn's batches, if one ran. */
  npcTurn: {
    combatantId: string;
    batchIds: string[];
    awaitingDm: boolean;
  } | null;
  /** Highest seq the gate returned to this job. */
  lastSeq: number;
  /** S1: the actor snapshot after the last gate write. */
  snapshot: ActorSnapshot;
  /** The S0-to-S1 diff. */
  diff: SnapshotDiff;
  /** The plan gate's verdict per action group (TASK-0112). */
  planGate?: PlanVerdict[];
}

class Stop extends Error {
  constructor(readonly error: NodeError) {
    super(error.message);
  }
}

const stop = (
  kind: NodeError["kind"],
  message: string,
  detail?: object,
): Stop =>
  new Stop({
    kind,
    message,
    ...(detail ? { detail: detail as Record<string, unknown> } : {}),
  });

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function withMarker(text: string, stepRef: string): string {
  const marker = ` [${stepRef}]`;
  return text.slice(0, Math.max(1, 500 - marker.length)) + marker;
}

const note = (summary: string, rationale: string) => ({
  summary: summary.slice(0, 200),
  rationale: rationale.slice(0, 2000),
});

interface SubmitResult {
  result: Submission["result"];
  refusal: GateRefusal | null;
  batchId: string | null;
  outcome: string | null;
  band?: string | null;
  intentOutcome?: string | null;
}

/** The engine outcome carried by `check.resolved` / `attack.resolved` rows. */
function outcomeOf(events: readonly StoredEvent[]): string | null {
  for (const e of events) {
    const ev = (e.payload as { event?: { type?: string; outcome?: string } })
      .event;
    if (ev?.type === "check.resolved" || ev?.type === "attack.resolved") {
      return ev.outcome ?? null;
    }
  }
  return null;
}

/** The outcome band carried by a `check.resolved` row; null elsewhere and on old rows. */
function bandOf(events: readonly StoredEvent[]): string | null {
  for (const e of events) {
    const ev = (e.payload as { event?: { type?: string; band?: string } })
      .event;
    if (ev?.type === "check.resolved") return ev.band ?? null;
  }
  return null;
}

/** The outcome of the `intent.recorded` carrier row among `events`, else null. */
function carrierOutcome(events: readonly StoredEvent[]): string | null {
  const c = events.find((e) => e.type === "intent.recorded");
  return c ? ((c.payload as { outcome?: string }).outcome ?? null) : null;
}

/** The batch the `intent.recorded` carrier among `events` names, else null. */
function carrierBatch(events: readonly StoredEvent[]): string | null {
  const c = events.find((e) => e.type === "intent.recorded");
  return c
    ? ((c.payload as { batchId?: string | null }).batchId ?? null)
    : null;
}

/** Looks for a submission that landed after the last checkpoint save. */
function findLanded(
  p: SessionProjections,
  proposal: Proposal,
  stepRef: string,
): SubmitResult | null {
  const done = (
    batchId: string | null,
    outcome: string | null = null,
    band: string | null = null,
  ): SubmitResult => ({
    result: "applied",
    refusal: null,
    batchId,
    outcome,
    band,
  });
  if (proposal.kind === "mechanics") {
    const suffix = ` [${stepRef}]`;
    const rows = p.ledger.filter((r) => r.reason.endsWith(suffix));
    if (rows.length === 0) return null;
    let outcome: string | null = null;
    let band: string | null = null;
    for (const r of rows) {
      if (
        r.kind === "outcome" &&
        "outcome" in r.outcome &&
        (r.outcome.type === "check.resolved" ||
          r.outcome.type === "attack.resolved")
      ) {
        outcome = r.outcome.outcome;
        band = "band" in r.outcome ? (r.outcome.band ?? null) : null;
      }
    }
    return done(rows[0]?.batchId ?? null, outcome, band);
  }
  switch (proposal.kind) {
    case "action.resolve":
      return p.actions.find((a) => a.actionId === proposal.resolution.actionId)
        ?.status === "resolved"
        ? done(null)
        : null;
    case "scene":
      return p.scene?.sceneId === proposal.after?.sceneId && proposal.after
        ? done(null)
        : null;
    case "party":
      return proposal.after &&
        p.party.some((m) => m.characterId === proposal.characterId)
        ? done(null)
        : null;
    case "tracker": {
      const t = p.trackers.find((x) => x.trackerId === proposal.trackerId);
      if (
        p.ledger.some(
          (r) => r.kind === "change" && r.reason.endsWith(` [${stepRef}]`),
        )
      ) {
        return done(null);
      }
      return proposal.after && t && t.filled === proposal.after.filled
        ? done(null)
        : null;
    }
    case "table-mode":
      return JSON.stringify(p.tableMode) === JSON.stringify(proposal.after)
        ? done(null)
        : null;
    case "scene-presence":
      return p.scenePresence[proposal.actorId]?.presence ===
        REASON_TO_PRESENCE[proposal.reason]
        ? done(null)
        : null;
    case "journal":
      return p.journal.some((j) => j.entryId === proposal.entry.entryId)
        ? done(null)
        : null;
    default:
      return null;
  }
}

export class Run {
  readonly submissions: Submission[];
  readonly appended: StoredEvent[] = [];
  lastSeq: number;
  private checkLanded: boolean;
  private checkpoint: TurnCheckpoint;
  /** The plan gate's verdicts; saved with every checkpoint this run writes. */
  planGate: PlanVerdict[] = [];

  constructor(readonly ctx: TurnContext) {
    this.checkpoint = ctx.checkpoint;
    this.submissions = [...ctx.checkpoint.submissions] as Submission[];
    this.lastSeq = ctx.checkpoint.lastSeq;
    this.checkLanded = ctx.job.attempt > 1;
  }

  get gate(): Pick<Gate, "submit"> {
    return this.ctx.deps.gate;
  }

  /** Re-syncs the checkpoint a later phase of the same job writes. */
  withCheckpoint(c: TurnCheckpoint): void {
    this.checkpoint = c;
  }

  async submit(
    key: string,
    kind: ProposalKind,
    build: (stepRef: string) => Proposal,
    stakes: Stakes | null = null,
    who: Proposer = AI_DM,
  ): Promise<Submission> {
    const recorded = this.submissions.find((s) => s.key === key);
    if (recorded) return recorded;

    const { deps, signal } = this.ctx;
    if (signal.aborted) throw stop("aborted", "the turn was aborted");
    if (!(await deps.fence())) throw stop("fenced", "the lease was lost");

    const stepRef = `${this.ctx.job.id}#${this.submissions.length + 1}`;
    const proposal = build(stepRef);

    let outcome: SubmitResult | null = null;
    let events: StoredEvent[] = [];
    let proposalId: string | null = null;

    if (this.checkLanded) {
      const fresh = await deps.loadProjections(this.ctx.job.sessionId);
      outcome = findLanded(fresh, proposal, stepRef);
      if (!outcome) this.checkLanded = false;
    }

    if (!outcome) {
      let attempt = 0;
      for (;;) {
        const res = await this.gate.submit(
          this.ctx.job.sessionId,
          who,
          proposal,
        );
        if (!res.ok) {
          const r = res.refusal;
          if (
            r.source === "gate" &&
            r.code === "CONFLICT" &&
            attempt < CONFLICT_DELAYS_MS.length
          ) {
            await sleep(CONFLICT_DELAYS_MS[attempt] as number);
            attempt++;
            continue;
          }
          // Spec 104: the planner's refusals reach the gate as `gate` source; a stage is refused, not fatal.
          if (r.source === "engine" || kind === "intent") {
            outcome = {
              result: "refused",
              refusal: r,
              batchId: null,
              outcome: null,
            };
            break;
          }
          throw stop("gate", `the gate refused ${kind}: ${r.code}`, {
            code: r.code,
            source: r.source,
            kind,
          });
        }
        events = res.events;
        if (res.outcome === "applied") {
          outcome = {
            result: "applied",
            refusal: null,
            // Spec 104: an Intent that planned no engine row has no batch, whatever the gate minted.
            batchId: kind === "intent" ? carrierBatch(res.events) : res.batchId,
            outcome: outcomeOf(res.events),
            band: bandOf(res.events),
            intentOutcome: carrierOutcome(res.events),
          };
        } else if (res.outcome === "pending" || res.outcome === "suggested") {
          proposalId = res.proposalId;
          outcome = {
            result: res.outcome,
            refusal: null,
            batchId: null,
            outcome: null,
          };
        } else {
          outcome = {
            result: "applied",
            refusal: null,
            batchId: null,
            outcome: null,
          };
        }
        break;
      }
    }

    const sub: Submission = {
      stepRef,
      key,
      kind,
      result: outcome.result,
      refusal: outcome.refusal,
      batchId: outcome.batchId,
      proposalId,
      outcome: outcome.outcome,
      band: outcome.band ?? null,
      stakes,
      seqs: events.map((e) => e.seq).sort((a, b) => a - b),
      ...(outcome.intentOutcome !== undefined
        ? { intentOutcome: outcome.intentOutcome }
        : {}),
    };
    this.submissions.push(sub);
    for (const e of events) {
      this.appended.push(e);
      if (e.seq > this.lastSeq) this.lastSeq = e.seq;
    }
    const saved = await deps.saveCheckpoint({
      ...this.checkpoint,
      submissions: this.submissions,
      lastSeq: this.lastSeq,
      planGate: this.planGate,
    });
    if (!saved) throw stop("fenced", "the lease was lost");
    return sub;
  }

  /** One engine command as a `mechanics` proposal; the reason carries the marker. */
  mech(
    key: string,
    command: Record<string, unknown>,
    reason: string,
    actionId: string | null,
    stakes: Stakes | null = null,
  ): Promise<Submission> {
    return this.submit(
      key,
      "mechanics",
      (ref) =>
        mechanicsProposal(
          { ...command, reason: withMarker(reason, ref) } as EngineCommand,
          {
            actionId,
            summary: reason.slice(0, 200),
            rationale: `Resolve ${key}`,
          },
        ),
      stakes,
    );
  }
}

// ---------------------------------------------------------------- effects

/** Spec 082 D7: the damage.apply for an attack entry's hit (the stats are the only damage source). */
function hitDamage(
  entry: AttackEntry,
  targetId: string,
  critical: boolean,
): EngineCommand {
  return {
    type: "damage.apply",
    targetId,
    components: entry.damage,
    critical,
    defenses: null,
  } as EngineCommand;
}

/** Runs one action's (or the NPC turn's) steps, branching on engine events. */
async function runSteps(
  run: Run,
  prefix: string,
  steps: readonly Step[],
  actionId: string | null,
): Promise<ChainResult> {
  const chain: ChainResult = {
    batchIds: [],
    awaiting: false,
    firstRefusal: null,
  };
  let stopped = false;
  let mechanicsSeen = 0;

  /** Returns true when the chain may continue. */
  const take = (sub: Submission): boolean => {
    mechanicsSeen++;
    if (sub.result === "applied") {
      if (sub.batchId) chain.batchIds.push(sub.batchId);
      return true;
    }
    if (sub.result === "refused") {
      if (mechanicsSeen === 1 && chain.batchIds.length === 0) {
        chain.firstRefusal = sub.refusal;
      }
      stopped = true;
      return false;
    }
    chain.awaiting = true;
    stopped = true;
    return false;
  };

  const runEffects = async (
    key: string,
    effects: readonly Effect[],
    reason: string,
    critical: boolean,
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
        take(sub);
        continue;
      }
      const e = effectCommand(effect, critical, reason);
      take(await run.mech(`${key}:e${j}`, e.command, e.reason, actionId));
    }
  };

  for (const [i, step] of steps.entries()) {
    if (stopped) break;
    const key = `${prefix}:s${i}`;
    switch (step.step) {
      case "none":
        break;
      case "roll":
        take(
          await run.mech(
            key,
            { type: "roll", expression: step.expression, mode: step.mode },
            step.reason,
            actionId,
          ),
        );
        break;
      case "effect":
        await runEffects(key, step.effects, step.reason, false);
        break;
      case "check": {
        const fresh = await run.ctx.deps.loadProjections(run.ctx.job.sessionId);
        const { outcomeBands, naturals } = run.ctx.seed.tableRules;
        const sub = await run.mech(
          key,
          {
            type: "check.roll",
            combatantId: step.combatantId,
            kind: step.kind,
            ability: step.ability,
            skill: step.skill,
            // Spec 084 D11: a tier string is a difficulty; an object is an opposition.
            ...(typeof step.difficulty === "string"
              ? { difficulty: step.difficulty }
              : {
                  opposition: {
                    opponentId: step.difficulty.opposedBy,
                    rule: step.difficulty.rule,
                  },
                }),
            mode: step.circumstance?.mode ?? "normal",
            autoFail: step.autoFail,
            houseRules: { outcomeBands, naturals },
            autoSuccess: isFreeRetry(step, fresh.ledger)
              ? { reason: step.reason }
              : null,
          },
          step.reason,
          actionId,
          step.stakes,
        );
        // Spec 080 D3: the next checkpoint save carries both fields; a replay re-sets them.
        sub.reveals = step.reveals ?? null;
        sub.revealedText = clueFor(run.ctx.seed, sub.reveals);
        if (sub.reveals && sub.revealedText === null) {
          run.ctx.deps.log({
            event: "dm.reveals.unknown",
            jobId: run.ctx.job.id,
            reveals: sub.reveals,
          });
        }
        if (take(sub)) {
          await runEffects(
            key,
            effectsForBand(step, sub.band ?? sub.outcome),
            step.reason,
            false,
          );
        }
        break;
      }
      case "move": {
        // Spec 079 D4: the engine, not interpret, decides the reactions.
        const fresh = await run.ctx.deps.loadProjections(run.ctx.job.sessionId);
        const seedMonsters = new Map(
          run.ctx.seed.encounters.flatMap((e) =>
            e.monsters.map((m) => [m.combatantId, m.srdMonsterId] as const),
          ),
        );
        const ids = reactors({
          moverId: step.combatantId,
          leavesReachOf: step.leavesReachOf,
          engine: fresh.engine,
          partyCombatantIds: new Set(
            fresh.party.flatMap((m) => (m.combatantId ? [m.combatantId] : [])),
          ),
          encounterMonsters: seedMonsters,
        });
        const moverName =
          fresh.engine.combatants[step.combatantId]?.name ?? step.combatantId;
        for (const [n, id] of ids.entries()) {
          if (stopped) break;
          const reactorStats = fresh.engine.combatants[id]?.stats;
          const atk = reactorStats ? firstMeleeAttack(reactorStats) : null;
          if (!atk) {
            run.ctx.deps.log({
              event: "dm.reaction.skipped",
              jobId: run.ctx.job.id,
              reactorId: id,
              reason: "no-melee-attack",
            });
            continue;
          }
          const reactorName = fresh.engine.combatants[id]?.name ?? id;
          const rkey = `${key}:r${n}`;
          const sub = await run.mech(
            rkey,
            {
              type: "attack.roll",
              attackerId: id,
              targetId: step.combatantId,
              attack: atk.name,
              mode: "normal",
              targetAc: null,
              reaction: true,
            },
            `${reactorName} strikes as ${moverName} pulls away`,
            actionId,
          );
          // A reaction is not the mover's step: only a pause stops the chain.
          if (sub.result === "pending" || sub.result === "suggested") {
            chain.awaiting = true;
            stopped = true;
            break;
          }
          if (sub.result !== "applied") continue;
          if (sub.batchId) chain.batchIds.push(sub.batchId);
          if (sub.outcome === "hit" || sub.outcome === "critical-hit") {
            const dmg = await run.mech(
              `${rkey}:e0`,
              hitDamage(atk, step.combatantId, sub.outcome === "critical-hit"),
              `${reactorName} strikes as ${moverName} pulls away: damage`,
              actionId,
            );
            if (dmg.result === "applied") {
              if (dmg.batchId) chain.batchIds.push(dmg.batchId);
            } else if (dmg.result !== "refused") {
              chain.awaiting = true;
              stopped = true;
              break;
            }
          }
        }
        break;
      }
      case "spell": {
        // Spec 083 D5: the engine rolls and applies every spell number.
        const { outcomeBands, naturals } = run.ctx.seed.tableRules;
        const caster = run.ctx.seed.characters.find(
          (c) => c.identity.combatant.id === step.casterId,
        );
        const sub = await run.mech(
          key,
          {
            type: "spell.cast",
            casterId: step.casterId,
            spellId: step.spellId,
            targetId: step.targetId,
            slotLevel: step.slotLevel,
            casterLevel: caster?.identity.level ?? 1,
            houseRules: { outcomeBands, naturals },
          },
          step.reason,
          actionId,
        );
        take(sub);
        break;
      }
      case "help": {
        // Spec 084 D11: the engine records the assist; no effects follow.
        const sub = await run.mech(
          key,
          {
            type: "help.grant",
            helperId: step.helperId,
            assist: step.assist,
          },
          step.reason,
          actionId,
        );
        take(sub);
        break;
      }
      case "attack": {
        const sub = await run.mech(
          key,
          {
            type: "attack.roll",
            attackerId: step.attackerId,
            targetId: step.targetId,
            attack: step.attack,
            mode: step.circumstance?.mode ?? "normal",
            targetAc: null,
          },
          step.reason,
          actionId,
        );
        if (
          take(sub) &&
          (sub.outcome === "hit" || sub.outcome === "critical-hit")
        ) {
          // Spec 082 D7: the attack entry's damage is the only damage source.
          const critical = sub.outcome === "critical-hit";
          const fresh = await run.ctx.deps.loadProjections(
            run.ctx.job.sessionId,
          );
          const attacker = fresh.engine.combatants[step.attackerId];
          const found = attacker ? findAttack(attacker, step.attack) : null;
          if (found?.ok) {
            const dmg = await run.mech(
              `${key}:dmg`,
              hitDamage(found.value, step.targetId, critical),
              `${step.reason}: damage`,
              actionId,
            );
            if (dmg.result === "applied") {
              if (dmg.batchId) chain.batchIds.push(dmg.batchId);
            } else if (dmg.result !== "refused") {
              chain.awaiting = true;
              stopped = true;
              break;
            }
          }
          await runEffects(key, step.onHit, step.reason, critical);
        }
        break;
      }
    }
  }
  return chain;
}

// ---------------------------------------------------------- Director group

/** Every target of a presence effect in the turn's planned steps. */
function presenceTargets(
  readings: readonly AnyInterpretReading[],
  rulings: readonly { steps: readonly Step[] }[],
): string[] {
  const out: string[] = [];
  const beside = (b: Beside | null): void => {
    if (!b) return;
    for (const list of [b.onSuccess, b.onFailure, b.onCost, b.onSevere]) {
      for (const e of list) if (e.effect === "presence") out.push(e.targetId);
    }
  };
  for (const r of readings)
    if (hasStages(r)) for (const st of r.stages) beside(st.beside);
  const effects = (list: readonly Effect[]): void => {
    for (const e of list) if (e.effect === "presence") out.push(e.targetId);
  };
  for (const { steps } of [
    ...readings.filter((r) => !hasStages(r)),
    ...rulings,
  ] as {
    steps: readonly Step[];
  }[]) {
    for (const step of steps) {
      if (step.step === "effect") effects(step.effects);
      else if (step.step === "check") {
        effects(step.onSuccess);
        effects(step.onFailure);
        effects(step.onCost);
        effects(step.onSevere);
      } else if (step.step === "attack") effects(step.onHit);
      // A move step carries no presence effect (spec 079).
    }
  }
  return out;
}

/**
 * Reclaim (spec 048): the combatant that was active when a landed presence
 * leave began. An `initiative.leave` of the active combatant already handed
 * the turn on, so the projection read on a reclaim no longer names it. The
 * leave's `encounter.changed` ledger row (the first one after the presence
 * row, subject the leaver) keeps the encounter as it was before the leave.
 */
function activeLeaverFromLog(
  p: SessionProjections,
  targets: readonly string[],
): string | null {
  for (const id of targets) {
    const presence = p.scenePresence[id];
    if (!presence || presence.presence === "present") continue;
    const row = p.ledger.find(
      (r) =>
        r.kind === "change" &&
        r.type === "encounter.changed" &&
        r.subject === id &&
        r.seq > presence.seq,
    );
    if (row?.kind !== "change") continue;
    const before = row.before as {
      turnIndex: number;
      order: { combatantId: string }[];
    } | null;
    if (before?.order[before.turnIndex]?.combatantId === id) return id;
  }
  return null;
}

interface Local {
  mode: "free" | "turn";
  encounterActive: boolean;
  /** The table mode this turn set (applied), if any. */
  newTableMode: TableMode | null;
  modeJustStarted: boolean;
}

/** The encounter-end and table-mode helpers the opening and closing moves share. */
function directorHelpers(run: Run, local: Local) {
  const endEncounter = async (reason: string): Promise<void> => {
    if (!local.encounterActive) return;
    const sub = await run.mech(
      "director:encounter-end",
      { type: "encounter.end" },
      reason,
      null,
    );
    if (sub.result === "applied") local.encounterActive = false;
  };
  const setMode = async (after: TableMode, reason: string): Promise<void> => {
    const sub = await run.submit("director:table-mode", "table-mode", () => ({
      kind: "table-mode",
      ...note(`Table mode: ${after.mode}`, reason),
      reason: reason.slice(0, 500),
      after,
    }));
    if (sub.result === "applied") {
      local.newTableMode = after;
      local.mode = after.mode;
    }
  };
  return { endEncounter, setMode };
}

/**
 * The `table-mode` row for the encounter's active actor, after the turn
 * advanced or the encounter started and settling passed any downed
 * combatants. Returns true when the row applied.
 */
async function setActiveMode(
  run: Run,
  ctx: TurnContext,
  local: Local,
  key: string,
  reason: string,
): Promise<boolean> {
  const fresh = await ctx.deps.loadProjections(ctx.job.sessionId);
  const active = fresh.encounter?.activeCombatantId;
  if (!active) return false;
  const after: TableMode = { mode: "turn", ...activeActorFor(fresh, active) };
  const sub = await run.submit(key, "table-mode", () => ({
    kind: "table-mode",
    ...note("Next active actor", reason),
    reason: reason.slice(0, 500),
    after,
  }));
  if (sub.result !== "applied") return false;
  local.newTableMode = after;
  local.mode = "turn";
  return true;
}

/**
 * The seed-presence group (spec 050): code-owned `scene-presence` rows that
 * turn the seed's per-beat declaration into logged facts. It reads the seed
 * and the projections only, never a Director field. Scene start logs the
 * opening beat's non-`present` NPCs as `dm` rows; encounter start logs
 * `arrived` for the NPCs the encounter's beat declares `present`. A NPC whose
 * logged value already equals the target gets no row (a reclaim replays by
 * key, and `findLanded` covers a row that landed before its checkpoint).
 */
async function seedPresence(
  run: Run,
  ctx: TurnContext,
  p: SessionProjections,
  moment: "scene-start" | "encounter-start",
  beat: SceneSeed["beats"][number] | undefined,
): Promise<void> {
  if (!beat) return;
  for (const npc of ctx.seed.npcs) {
    const declared = beat.presence[npc.id];
    if (!declared) continue;
    const logged = p.scenePresence[npc.id]?.presence ?? "present";
    let reason: "removed" | "conceded" | "arrived";
    let visibility: "dm" | "public";
    if (moment === "scene-start") {
      if (declared === "present") continue;
      reason = declared === "absent" ? "removed" : "conceded";
      visibility = "dm";
    } else {
      if (declared !== "present") continue;
      reason = "arrived";
      visibility = "public";
    }
    if (logged === REASON_TO_PRESENCE[reason]) continue;
    await run.submit(
      `seed:presence:${moment}:${npc.id}`,
      "scene-presence",
      () => ({
        kind: "scene-presence",
        ...note(
          `Seed presence: ${npc.name} ${reason}`,
          `The seed declares ${npc.name} ${declared} at ${beat.id}.`,
        ),
        actorId: npc.id,
        reason,
        actionId: null,
        visibility,
      }),
    );
  }
}

/** One Director arrival (spec 078, 088). True when it wrote a row. */
async function arriveOne(
  run: Run,
  ctx: TurnContext,
  p: SessionProjections,
  id: string,
): Promise<boolean> {
  const { seed, deps } = ctx;
  const npc = seed.npcs.find((n) => n.id === id);
  if (!npc) {
    // Spec 088: an unseen encounter monster arrives as a combatant.
    const m = seed.encounters
      .flatMap((e) => e.monsters)
      .find((x) => x.combatantId === id);
    if (!m || p.engine.combatants[id]) return false;
    const rec = deps.srd.getById("monster", m.srdMonsterId);
    if (!rec) throw stop("internal", `no SRD monster ${m.srdMonsterId}`);
    const zoneId = seed.encounters.find((e) =>
      e.monsters.some((x) => x.combatantId === id),
    )?.zone;
    await run.mech(
      `director:arrival:${id}`,
      {
        type: "combatant.add",
        combatant: {
          ...combatantFromSrd(rec, id, m.name, "hostile"),
          ...(zoneId ? { placement: { zoneId } } : {}),
        },
      },
      `${m.name ?? rec.name} comes into view`,
      null,
    );
    // Spec 099 FR-021: a newcomer to a running fight joins the order and rolls alone.
    if (p.encounter !== null && p.tableMode.mode === "turn") {
      await run.mech(
        `director:arrival:${id}:join`,
        { type: "initiative.join", combatantId: id, mode: "normal" },
        `${m.name ?? rec.name} joins the fight`,
        null,
      );
    }
    return true;
  }
  await run.submit(`director:arrival:${id}`, "scene-presence", () => ({
    kind: "scene-presence",
    ...note(`${npc.name} arrives`, "The Director reports the NPC on screen."),
    actorId: id,
    reason: "arrived",
    actionId: null,
    visibility: "public",
  }));
  return true;
}

/** Does text name the arrival id: a snapshot alias, or a not-yet-seen monster's seed name. */
function textsName(
  snapshot: ActorSnapshot,
  seed: SceneSeed,
  texts: readonly string[],
  id: string,
): boolean {
  const text = texts.join(". ");
  if (namedActorIds(snapshot, text).includes(id)) return true;
  if (snapshot.actors.some((a) => a.id === id)) return false;
  const m = seed.encounters
    .flatMap((e) => e.monsters)
    .find((x) => x.combatantId === id);
  const name = m?.name?.trim();
  if (!name) return false;
  const esc = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?<![\\p{L}\\p{N}_])${esc}(?![\\p{L}\\p{N}_])`, "iu").test(
    text,
  );
}

type CheckStepOf = Extract<Step, { step: "check" }>;

/**
 * Spec 089 D3: an arrival is dependent when a check this beat declares stake
 * text that names it. The rest are unconditional (spec 078).
 */
export function splitArrivals(
  arrivals: readonly string[],
  steps: readonly Step[],
  snapshot: ActorSnapshot,
  seed: SceneSeed,
  extraStakes: readonly Stakes[] = [],
): { unconditional: string[]; dependent: string[] } {
  const stakeTexts = [
    ...steps
      .filter((s): s is CheckStepOf => s.step === "check")
      .flatMap((s) => (s.stakes ? [s.stakes] : [])),
    ...extraStakes,
  ]
    .flatMap((k) => [k.success, k.cost, k.failure, k.severe])
    .filter((t): t is string => !!t);
  const unconditional: string[] = [];
  const dependent: string[] = [];
  for (const id of arrivals) {
    (textsName(snapshot, seed, stakeTexts, id)
      ? dependent
      : unconditional
    ).push(id);
  }
  return { unconditional, dependent };
}

/** Spec 089 D3: land each held arrival whose check's applied band names it; log the rest. */
async function landHeldArrivals(
  run: Run,
  ctx: TurnContext,
  snapshot: ActorSnapshot,
  dependent: readonly string[],
): Promise<void> {
  if (dependent.length === 0) return;
  const checks = run.submissions.filter((s) => s.stakes && s.band);
  let p: SessionProjections | null = null;
  for (const id of dependent) {
    const lands = checks.some((s) =>
      textsName(snapshot, ctx.seed, bandTexts(s.stakes, s.band), id),
    );
    if (!lands) {
      ctx.deps.log({ event: "dm.arrival.held", jobId: ctx.job.id, npcId: id });
      continue;
    }
    p ??= await ctx.deps.loadProjections(ctx.job.sessionId);
    await arriveOne(run, ctx, p, id);
  }
}

/**
 * Director opening moves (decision-0025 §4): the scene-start setup and the
 * `turn` table-mode decision. They run before any action group, because an
 * action may name a combatant that an opening move adds.
 */
async function directorOpening(
  run: Run,
  ctx: TurnContext,
  assembled: AssembleOutput,
  director: DirectorNodeOutput,
  local: Local,
  unconditional: readonly string[],
): Promise<void> {
  const { seed, deps } = ctx;
  const p = assembled.projections;
  const why = (s: string) => note(s, s);
  if (ctx.job.trigger === "scene-start") {
    await run.submit("director:scene", "scene", () => ({
      kind: "scene",
      ...why(`Start the scene: ${seed.title}`),
      reason: `Scene start: ${seed.title}`.slice(0, 500),
      after: {
        sceneId: seed.seedId,
        title: seed.title,
        summary: seed.goal.statement,
        location: seed.location.name,
      },
    }));
    // Spec 100 FR-022: the space is defined before the first party combatant joins.
    if (seed.space) {
      await run.mech(
        "director:space",
        {
          type: "space.define",
          space: { zones: seed.space.zones, edges: seed.space.edges },
        },
        `The scene is laid out: ${seed.location.name}`,
        null,
      );
    }
    const seats = ctx.job.start?.seats ?? {};
    for (const c of seed.characters) {
      const init = c.identity.combatant;
      await run.mech(
        `director:combatant:${init.id}`,
        {
          type: "combatant.add",
          combatant: {
            ...init,
            side: "party",
            stats: statsFromCharacter(c, deps.srd),
            ...(seed.space ? { placement: { zoneId: seed.space.start } } : {}),
          },
        },
        `${c.name} joins the scene`,
        null,
      );
      let controller:
        | { kind: "player"; userId: string }
        | { kind: "ai-companion"; actor: string };
      if (c.seat === "companion") {
        controller = {
          kind: "ai-companion",
          actor: `ai:companion:${c.characterId}`,
        };
      } else {
        const userId = seats[c.characterId];
        if (!userId) {
          throw stop(
            "internal",
            `scene start has no seat for ${c.characterId}`,
          );
        }
        controller = { kind: "player", userId };
      }
      await run.submit(`director:party:${c.characterId}`, "party", () => ({
        kind: "party",
        ...why(`${c.name} joins the party`),
        reason: `${c.name} joins the party`,
        characterId: c.characterId,
        after: {
          characterId: c.characterId,
          name: c.name,
          controller,
          combatantId: init.id,
          class: c.identity.class,
          level: c.identity.level,
        },
      }));
    }
    for (const t of seed.trackers) {
      await run.submit(
        `director:tracker:${t.trackerId}:new`,
        "tracker",
        () => ({
          kind: "tracker",
          ...why(`Start the ${t.name} tracker`),
          reason: `Start the ${t.name} tracker`,
          trackerId: t.trackerId,
          visibility: "dm",
          after: {
            trackerId: t.trackerId,
            name: t.name,
            segments: t.segments,
            filled: 0,
            note: t.note,
          },
        }),
      );
    }
    await seedPresence(run, ctx, p, "scene-start", seed.beats[0]);
    return;
  }

  // arrivals (spec 078): the Director's legal reveals, before any action group.
  // Spec 089: only the unconditional ones; the rest wait for their check's band.
  let arrived = 0;
  for (const id of unconditional) {
    if (await arriveOne(run, ctx, p, id)) arrived += 1;
  }
  // One fresh load after the arrivals group (spec 078, 088).
  const fresh = arrived > 0 ? await deps.loadProjections(ctx.job.sessionId) : p;

  // table mode
  const tm = director.tableMode;
  if (tm.to === "turn") {
    const enc = encounterToStart(seed, director, ctx.job.trigger);
    if (enc) {
      // Spec 099 FR-017, FR-018: a pending start adds the monsters and runs the
      // seed's presence group; a resume (ended) does neither.
      const resume = encounterPhase(fresh, enc) === "ended";
      if (!resume) {
        for (const m of enc.monsters) {
          if (fresh.engine.combatants[m.combatantId]) continue;
          const rec = deps.srd.getById("monster", m.srdMonsterId);
          if (!rec) throw stop("internal", `no SRD monster ${m.srdMonsterId}`);
          await run.mech(
            `director:combatant:${m.combatantId}`,
            {
              type: "combatant.add",
              combatant: {
                ...combatantFromSrd(rec, m.combatantId, m.name, "hostile"),
                ...(enc.zone ? { placement: { zoneId: enc.zone } } : {}),
              },
            },
            `${m.name ?? rec.name} joins the fight`,
            null,
          );
        }
        await seedPresence(
          run,
          ctx,
          fresh,
          "encounter-start",
          seed.beats.find((b) => b.encounterId === enc.id),
        );
      }
      // Eligibility reads the log after the adds and the presence group.
      const ready = await deps.loadProjections(ctx.job.sessionId);
      const monsters = eligibleMonsters(ready, enc);
      if (monsters.length === 0) return;
      const ids = [
        ...p.party
          .filter(
            (m) =>
              m.combatantId && m.combatant && m.combatant.lifeState !== "dead",
          )
          .map((m) => m.combatantId as string),
        ...monsters,
      ];
      const init = await run.mech(
        "director:initiative",
        {
          type: "initiative.roll",
          participants: ids.map((combatantId) => ({
            combatantId,
            mode: "normal",
          })),
        },
        `Roll initiative: ${enc.name}`,
        null,
      );
      if (init.result === "applied") {
        local.encounterActive = true;
        await settleTurn(run, ctx);
        if (
          await setActiveMode(run, ctx, local, "director:table-mode", tm.reason)
        ) {
          local.modeJustStarted = true;
        }
      }
    }
  }
}

/**
 * Director closing moves (decision-0025 §4): tracker advances, the `free`
 * table-mode decision (encounter end, then free mode) and the scene end. They
 * run after the action and NPC groups, so an encounter-ending action resolves
 * while the encounter is still active.
 */
async function directorClosing(
  run: Run,
  ctx: TurnContext,
  assembled: AssembleOutput,
  director: DirectorNodeOutput,
  local: Local,
): Promise<void> {
  const p = assembled.projections;
  const { endEncounter, setMode } = directorHelpers(run, local);

  // trackers
  for (const adv of director.trackers) {
    const before = p.trackers.find((t) => t.trackerId === adv.trackerId);
    if (!before) continue;
    const filled = Math.max(
      0,
      Math.min(before.segments, before.filled + adv.advance),
    );
    if (filled === before.filled) continue;
    await run.submit(`director:tracker:${adv.trackerId}`, "tracker", (ref) => ({
      kind: "tracker",
      ...note(`Advance ${before.name}`, adv.reason),
      // The marker lets a reclaim find an advance that landed before its checkpoint save.
      reason: withMarker(adv.reason, ref),
      trackerId: adv.trackerId,
      visibility: "dm",
      after: { ...before, filled },
    }));
  }

  // table mode
  const tm = director.tableMode;
  if (tm.to === "free") {
    await endEncounter(tm.reason);
    await setMode({ mode: "free" }, tm.reason);
  }

  // Spec 099 FR-020: code ends a fight no foe stands in. A party wipe does not
  // end it (OQ-6). A depart that emptied the order already ended the engine's.
  if (local.encounterActive) {
    const fresh = await ctx.deps.loadProjections(ctx.job.sessionId);
    if (fresh.encounter === null) {
      local.encounterActive = false;
      await setMode({ mode: "free" }, "The fight is over.");
    } else if (encounterOver(fresh.engine)) {
      await endEncounter("No foe still stands.");
      await setMode({ mode: "free" }, "No foe still stands.");
    }
  }

  // scene end
  if (director.scene.status === "end" && p.scene) {
    const sc = director.scene;
    await endEncounter(sc.reason);
    if (local.mode === "turn") await setMode({ mode: "free" }, sc.reason);
    await run.submit("director:scene-end", "scene", () => ({
      kind: "scene",
      ...note(`End the scene: ${sc.outcome}`, sc.reason),
      reason: sc.reason,
      after: null,
    }));
  }
}

// ----------------------------------------------------------------- the node

/**
 * `action.resolved` carries an engine refusal code (the session-events contract); the planner and
 * gate raise others (`KIND_UNSERVED`, `NOT_YOUR_TURN`, ...). The event keeps `INVALID_COMMAND` for
 * those, and `actionResults` keeps the real code for the fact sheet.
 * ponytail: widen `RefusalCodeSchema` (a contract amendment) so the event keeps the real code.
 */
function engineCode(code: string | null): string | null {
  if (code === null) return null;
  return RefusalCodeSchema.safeParse(code).success ? code : "INVALID_COMMAND";
}

/** A group's work: legacy steps (a ruling or an old reading), or Intent stages (spec 104). */
function actionGroup(
  reading: AnyInterpretReading | undefined,
  ruling: { steps: Step[] } | undefined,
): {
  steps: readonly Step[];
  stages: readonly InterpretStage[] | null;
  clarify: boolean;
} {
  if (ruling) return { steps: ruling.steps, stages: null, clarify: false };
  if (!reading) return { steps: [], stages: null, clarify: false };
  if (hasStages(reading)) {
    return {
      steps: [],
      stages: reading.stages,
      clarify: reading.clarify !== null,
    };
  }
  return {
    steps: reading.steps,
    stages: null,
    clarify: reading.clarify !== null,
  };
}

/**
 * Spec 068: pull each plan-gate pull id into the scene before its group's
 * steps run. `combatant.add` from the NPC's SRD block (default `commoner`),
 * then `initiative.join` when an encounter is active and the actor can act.
 * Pull rows carry `actionId: null`, so they never change a group's outcome.
 */
async function pullIn(
  run: Run,
  ctx: TurnContext,
  prefix: string,
  ids: readonly string[],
): Promise<string[]> {
  const batchIds: string[] = [];
  for (const id of ids) {
    let fresh = await ctx.deps.loadProjections(ctx.job.sessionId);
    const npc = ctx.seed.npcs.find((n) => n.id === id);
    if (!fresh.engine.combatants[id]) {
      if (!npc) continue;
      const srdId = npc.identity.srdMonsterId ?? "commoner";
      const rec = ctx.deps.srd.getById("monster", srdId);
      if (!rec) throw stop("internal", `no SRD monster ${srdId}`);
      // Spec 100 FR-023: the active seed encounter's zone, else the NPC's own.
      const fought = ctx.seed.encounters.find((e) =>
        e.monsters.some((x) => fresh.engine.combatants[x.combatantId]),
      );
      const zoneId = (fresh.encounter && fought?.zone) || npc.zone;
      const added = await run.mech(
        `${prefix}:pull:${id}`,
        {
          type: "combatant.add",
          combatant: {
            ...combatantFromSrd(
              rec,
              id,
              npc.name,
              ctx.seed.encounters.some((e) =>
                e.monsters.some((m) => m.combatantId === id),
              )
                ? "hostile"
                : "neutral",
            ),
            ...(zoneId ? { placement: { zoneId } } : {}),
          },
        },
        `${npc.name} joins the scene`,
        null,
      );
      if (added.batchId) batchIds.push(added.batchId);
      fresh = await ctx.deps.loadProjections(ctx.job.sessionId);
    }
    const enc = fresh.encounter;
    if (
      enc &&
      !enc.order.some((o) => o.combatantId === id) &&
      canAct(fresh.engine, id) &&
      (fresh.scenePresence[id]?.presence ?? "present") === "present"
    ) {
      const joined = await run.mech(
        `${prefix}:pull:${id}:join`,
        { type: "initiative.join", combatantId: id, mode: "normal" },
        `${npc?.name ?? id} joins the fight`,
        null,
      );
      if (joined.batchId) batchIds.push(joined.batchId);
    }
  }
  return batchIds;
}

/** Action id -> the acting character's combatant id; `null` for a party-scope action. */
function actionActors(assembled: AssembleOutput): Map<string, string | null> {
  const out = new Map<string, string | null>();
  for (const item of assembled.beat) {
    if (item.scope === "party") {
      out.set(item.actionId, null);
      continue;
    }
    const member = assembled.projections.party.find(
      (m) => m.characterId === item.characterId,
    );
    if (member?.combatantId) out.set(item.actionId, member.combatantId);
  }
  return out;
}

async function resolveAction(
  run: Run,
  ctx: TurnContext,
  item: BeatItem,
  reading: AnyInterpretReading | undefined,
  ruling: { steps: Step[] } | undefined,
  verdict: PlanVerdict | undefined,
): Promise<ResolveOutput["actionResults"][number]> {
  const { steps, stages, clarify } = actionGroup(reading, ruling);
  // TASK-0244: a held group runs no step and writes no row; it stays committed.
  if (verdict && !verdict.ok && verdict.code === TURN_HELD_CODE) {
    return {
      actionId: item.actionId,
      outcome: "held",
      batchIds: [],
      refusalCode: null,
      heldFor: verdict.heldFor,
    };
  }
  const planRefused = verdict !== undefined && !verdict.ok;
  const groupActors = stages
    ? stageActors(
        stages,
        (await ctx.deps.loadProjections(ctx.job.sessionId)).party,
        item,
      )
    : stepActors(steps);
  const pullBatchIds =
    verdict?.ok && !clarify
      ? await pullIn(run, ctx, `act:${item.actionId}`, verdict.pull ?? [])
      : [];
  const chain: ChainResult =
    planRefused || clarify
      ? { batchIds: [], awaiting: false, firstRefusal: null }
      : stages
        ? await runStages(run, `act:${item.actionId}`, stages, item.actionId, {
            kind: "item",
            item,
          })
        : await runSteps(run, `act:${item.actionId}`, steps, item.actionId);
  if (chain.awaiting) {
    return {
      actionId: item.actionId,
      outcome: "awaiting-dm",
      batchIds: chain.batchIds,
      refusalCode: null,
    };
  }
  const batchIds = [...new Set(chain.batchIds)].slice(0, 20);
  let outcome: "applied" | "refused" | "no-effect";
  let refusalCode: string | null = null;
  if (planRefused) {
    // The plan gate refused the whole group before any step ran.
    outcome = "refused";
    refusalCode = verdict && !verdict.ok ? verdict.code : null;
  } else if (batchIds.length > 0) outcome = "applied";
  else if (chain.firstRefusal) {
    outcome = "refused";
    refusalCode = chain.firstRefusal.code;
  } else outcome = "no-effect";

  const sub = await run.submit(
    `act:${item.actionId}:resolve`,
    "action.resolve",
    () => ({
      kind: "action.resolve",
      ...note(
        `Resolve ${item.actionId}: ${outcome}`,
        reading && !hasStages(reading)
          ? `Intent: ${reading.intent}`
          : "Resolved by the DM runtime",
      ),
      resolution: {
        actionId: item.actionId,
        outcome,
        batchIds: outcome === "applied" ? batchIds : [],
        refusalCode: (outcome === "refused"
          ? engineCode(refusalCode)
          : null) as never,
      },
    }),
  );
  if (sub.result !== "applied") {
    return {
      actionId: item.actionId,
      outcome: "awaiting-dm",
      batchIds,
      refusalCode: null,
    };
  }
  return {
    actionId: item.actionId,
    outcome,
    batchIds,
    refusalCode,
    ...(pullBatchIds.length > 0 ? { pullBatchIds } : {}),
    ...(!planRefused && groupActors.length > 0
      ? { stepActors: groupActors }
      : {}),
  };
}

export const resolve: Node<"resolve"> = async (ctx) => {
  const { assemble: assembled, director } = ctx.results;
  if (!assembled || !director) {
    return {
      ok: false,
      node: "resolve",
      calls: [],
      error: {
        kind: "internal",
        message: "resolve ran before the planning nodes",
      },
    };
  }
  const run = new Run(ctx);
  // Seed the paused plan's submissions, refreshed from the approved proposal,
  // so the replay continues the chain instead of rolling again (specs/057).
  for (const plan of assembled.resumed ?? []) {
    for (const s of plan.submissions) {
      if (!run.submissions.some((x) => x.key === s.key)) {
        run.submissions.push(refreshSubmission(assembled.projections, s));
      }
    }
  }
  const hold = director.beat.decision === "hold";
  const local: Local = {
    mode: assembled.projections.tableMode.mode,
    encounterActive: assembled.projections.encounter !== null,
    newTableMode: null,
    modeJustStarted: false,
  };
  const actionResults: ResolveOutput["actionResults"] = [];
  /** A human's clarify holds the turn (specs/073). */
  const clarifyHeld = hold
    ? new Set<string>()
    : clarifyHolds(
        assembled.beat,
        ctx.results.interpret?.readings ?? [],
        ctx.results.adjudicate?.rulings ?? [],
      );
  /** The active combatant when the turn began (spec 048, the skipped advance). */
  const activeAtStart =
    ctx.job.attempt > 1
      ? (activeLeaverFromLog(
          assembled.projections,
          presenceTargets(
            hold ? [] : (ctx.results.interpret?.readings ?? []),
            hold ? [] : (ctx.results.adjudicate?.rulings ?? []),
          ),
        ) ??
        assembled.projections.encounter?.activeCombatantId ??
        null)
      : (assembled.projections.encounter?.activeCombatantId ?? null);
  /** The turn at assemble: the "turn moved" guard compares against it (spec 049 R7). */
  const turnAtStart =
    assembled.projections.encounter && activeAtStart !== null
      ? {
          round: assembled.projections.encounter.round,
          activeCombatantId: activeAtStart,
        }
      : null;
  let npcTurn: ResolveOutput["npcTurn"] = null;

  try {
    // The plan gate is pure: it runs first and changes no write order. It
    // accepts the ids this turn's encounter start adds (spec 045 SC-003).
    const planReadings = hold ? [] : (ctx.results.interpret?.readings ?? []);
    const planRulings = hold ? [] : (ctx.results.adjudicate?.rulings ?? []);
    const { unconditional, dependent } = splitArrivals(
      director.arrivals ?? [],
      [
        ...planReadings.flatMap((r) => (hasStages(r) ? [] : r.steps)),
        ...planRulings.flatMap((r) => r.steps),
      ],
      assembled.snapshot,
      ctx.seed,
      planReadings.flatMap((r) =>
        hasStages(r)
          ? r.stages.flatMap((st) => (st.beside ? [st.beside.stakes] : []))
          : [],
      ),
    );
    const startingEncounter = encounterToStart(
      ctx.seed,
      director,
      ctx.job.trigger,
    );
    run.planGate = checkPlan({
      snapshot: assembled.snapshot,
      readings: planReadings,
      rulings: planRulings,
      joining: arrivingMonsters(
        ctx.seed,
        assembled.projections,
        { ...director, arrivals: unconditional },
        ctx.job.trigger,
      ).map((m) => m.id),
      arriving: [
        ...new Set([
          ...arrivingNpcs(
            ctx.seed,
            startingEncounter,
            assembled.projections.scenePresence,
          ),
          ...unconditional,
        ]),
      ],
      resumed: (assembled.resumed ?? []).map((plan) => plan.actionId),
      actors: actionActors(assembled),
      declarers: new Map(
        assembled.beat.flatMap((b) => {
          const id = assembled.projections.party.find(
            (m) => m.characterId === b.characterId,
          )?.combatantId;
          return id ? [[b.actionId, id] as const] : [];
        }),
      ),
      combatants: assembled.projections.engine.combatants,
      spellLists: new Map(
        ctx.seed.characters.map((c) => [
          c.identity.combatant.id,
          c.identity.spells,
        ]),
      ),
      srdSpell: (id) => {
        const rec = ctx.deps.srd.getById("spell", id);
        return rec ? { level: rec.level } : undefined;
      },
    });
    const verdictFor = (actionId: string | null) =>
      run.planGate.find((v) => v.actionId === actionId);

    // Decision-0025 §4: opening moves, rulings, actions, NPC, closing moves,
    // turn advance. Hold runs the opening and closing moves only.
    await directorOpening(run, ctx, assembled, director, local, unconditional);

    if (!hold) {
      const readings = ctx.results.interpret?.readings ?? [];
      const rulings = ctx.results.adjudicate?.rulings ?? [];

      // Ruling group.
      for (const [n, r] of rulings.entries()) {
        const cites = r.citations
          .map((c) =>
            c.source === "library"
              ? `${c.book} (${c.path.join(" > ")}): "${c.quote}"`
              : `SRD ${c.kind} ${c.name}, page ${c.page}`,
          )
          .join("\n");
        const body = [
          r.ruling,
          r.improvised ? "Improvised: no citation verified." : cites,
        ]
          .filter(Boolean)
          .join("\n\n")
          .slice(0, 8000);
        await run.submit(`ruling:${n}`, "journal", () => ({
          kind: "journal",
          ...note(`Ruling ${n + 1}`, r.ruling),
          entry: {
            entryId: `ruling-${ctx.job.id}-${n + 1}`,
            title: "Ruling",
            body,
            sourceActionIds: r.actionId ? [r.actionId] : [],
          },
          visibility: "dm",
        }));
      }

      // Action groups, in commit order.
      for (const item of assembled.beat) {
        if (item.status === "resolved") continue;
        const reading = readings.find((r) => r.actionId === item.actionId);
        const ruling = rulings.find((r) => r.actionId === item.actionId);
        actionResults.push(
          await resolveAction(
            run,
            ctx,
            item,
            reading,
            ruling,
            verdictFor(item.actionId),
          ),
        );
      }

      // NPC group.
      if (assembled.npcTurn) {
        const reading = readings.find((r) => r.actionId === null);
        const ruling = rulings.find((r) => r.actionId === null);
        const { steps, stages } = actionGroup(reading, ruling);
        const npcVerdict = verdictFor(null);
        // The pull's batches (the joiner's initiative roll) belong to the NPC
        // turn's facts, or the shipped dice lines miss the roll (TASK-0213).
        const pulled = npcVerdict?.ok
          ? await pullIn(run, ctx, "npc", npcVerdict.pull ?? [])
          : [];
        const chain =
          npcVerdict && !npcVerdict.ok
            ? { batchIds: [] as string[], awaiting: false }
            : stages
              ? await runStages(run, "npc", stages, null, {
                  kind: "npc",
                  combatantId: assembled.npcTurn.combatantId,
                  jobShort: ctx.job.id
                    .replace(/[^a-z0-9]/gi, "")
                    .toLowerCase()
                    .slice(0, 8),
                })
              : await runSteps(run, "npc", steps, null);
        npcTurn = {
          combatantId: assembled.npcTurn.combatantId,
          batchIds: [...new Set([...pulled, ...chain.batchIds])],
          awaitingDm: chain.awaiting,
        };
      }
    }

    await landHeldArrivals(run, ctx, assembled.snapshot, dependent);

    // Closing moves. A scene-start job has none (its opening moves returned).
    if (ctx.job.trigger !== "scene-start") {
      await directorClosing(run, ctx, assembled, director, local);
    }

    if (!hold) {
      // Turn advance group.
      if (
        local.mode === "turn" &&
        local.encounterActive &&
        !local.modeJustStarted
      ) {
        const mode = local.newTableMode ?? assembled.projections.tableMode;
        if (mode.mode === "turn") {
          // A reclaim whose checkpoint holds the `advance` submission has
          // already ended the turn; the beat no longer shows the action, so
          // the group must still run to finish settling and set the mode.
          const done =
            run.submissions.some((x) => x.key === "advance") ||
            (mode.activeActor === "ai:dm" &&
              npcTurn !== null &&
              !npcTurn.awaitingDm) ||
            assembled.beat.some(
              (b) =>
                b.characterId !== null &&
                b.characterId === mode.activeCharacterId &&
                !clarifyHeld.has(b.actionId) &&
                actionResults.some(
                  (r) =>
                    r.actionId === b.actionId &&
                    r.outcome !== "awaiting-dm" &&
                    r.outcome !== "held",
                ),
            ) ||
            // TASK-0244: a released held group ends the companion's turn.
            (mode.activeActor.startsWith("ai:companion:") &&
              activeAtStart !== null &&
              actionResults.some(
                (r) =>
                  (r.outcome === "applied" ||
                    r.outcome === "refused" ||
                    r.outcome === "no-effect") &&
                  r.stepActors?.includes(activeAtStart),
              ));
          if (done) {
            // One "turn moved" guard (specs/049-turn-floor R7, with spec 048).
            const fresh = await ctx.deps.loadProjections(ctx.job.sessionId);
            const leftOrder =
              activeAtStart !== null &&
              fresh.encounter !== null &&
              !fresh.encounter.order.some(
                (o) => o.combatantId === activeAtStart,
              );
            // Spec 048: an active combatant that left the order already
            // handed the turn on (`initiative.leave`); a second advance
            // would skip the next combatant. Settling and the mode row
            // are still owed.
            // Spec 049: a floor batch moved the turn and wrote its own mode
            // row; an advance here would skip a combatant. A reclaim whose
            // checkpoint holds `advance` replays the group as before.
            const moved =
              !leftOrder &&
              fresh.encounter !== null &&
              turnAtStart !== null &&
              !run.submissions.some((x) => x.key === "advance") &&
              (fresh.encounter.round !== turnAtStart.round ||
                fresh.encounter.activeCombatantId !==
                  turnAtStart.activeCombatantId);
            if (moved || floorHeld(fresh)) {
              // Nothing is owed: the floor batch settled and set the mode,
              // or the seated DM holds the floor.
            } else {
              const advanced = leftOrder
                ? true
                : (
                    await run.mech(
                      "advance",
                      { type: "turn.advance" },
                      "Advance the turn",
                      null,
                    )
                  ).result === "applied";
              if (advanced) {
                await settleTurn(run, ctx);
                await setActiveMode(
                  run,
                  ctx,
                  local,
                  "advance:table-mode",
                  "The turn advanced.",
                );
              }
            }
          }
        }
      }
    }
  } catch (error) {
    if (error instanceof Stop) {
      return { ok: false, node: "resolve", calls: [], error: error.error };
    }
    throw error;
  }

  // nextJob
  let nextJob: ResolveOutput["nextJob"] = null;
  const tm = local.newTableMode;
  if (!hold && tm && tm.mode === "turn") {
    if (tm.activeActor === "ai:dm")
      nextJob = { kind: "turn", trigger: "npc-turn" };
    else if (
      tm.activeActor.startsWith("ai:companion:") &&
      tm.activeCharacterId
    ) {
      // TASK-0244: a held group waits for this companion. Its turn job releases it.
      // ponytail: a floor pass or a human mode row (floor.ts, enqueue.ts) still
      // queues the companion job; R1 then holds the group again because the
      // companion has its own action, so it waits a round. Read the newest
      // checkpoint's held verdicts in the companion job when a playtest shows it.
      // ponytail: a held group is interpreted again each beat (R3). Cache its
      // reading in the checkpoint when the token cost shows in a playtest.
      const activeNow = (await ctx.deps.loadProjections(ctx.job.sessionId))
        .encounter?.activeCombatantId;
      if (
        activeNow !== undefined &&
        actionResults.some(
          (r) => r.outcome === "held" && r.heldFor === activeNow,
        )
      ) {
        nextJob = { kind: "turn", trigger: "held" };
      } else
        nextJob = {
          kind: "companion",
          companions: [tm.activeCharacterId],
          reason: "turn",
        };
    }
  } else if (
    !hold &&
    local.mode === "free" &&
    director.companionPrompts.length > 0
  ) {
    nextJob = {
      kind: "companion",
      companions: director.companionPrompts,
      reason: "prompt",
    };
  }

  const finalProjections = await ctx.deps.loadProjections(ctx.job.sessionId);
  const snapshot = buildSnapshot(finalProjections, ctx.seed);

  return {
    ok: true,
    node: "resolve",
    calls: [],
    output: {
      snapshot,
      diff: diffSnapshots(assembled.snapshot, snapshot),
      submissions: run.submissions,
      actionResults,
      appendedRows: run.appended,
      nextJob,
      chronicle: false,
      npcTurn,
      lastSeq: run.lastSeq,
      planGate: run.planGate,
    },
  };
};

// ------------------------------------------------- narration and notices

/**
 * A narration this job already landed. The narration row carries no marker
 * (the event schema has no field for one), so the marker is position: an
 * `ai:dm` narration row after everything this job appended before it
 * (resolve's `lastSeq`, the checkpoint's `lastSeq`, the trigger seq). Only
 * the job that holds the lease appends, so any such row is this job's.
 */
export async function findLandedNarration(
  ctx: TurnContext,
  resolveLastSeq: number,
): Promise<{ seq: number; text: string } | null> {
  const floor = Math.max(
    resolveLastSeq,
    ctx.checkpoint.lastSeq,
    ctx.job.triggerSeq ?? 0,
  );
  const p = await ctx.deps.loadProjections(ctx.job.sessionId);
  for (const e of p.transcript) {
    if (e.kind === "narration" && e.actor === AI_DM.actor && e.seq > floor) {
      return { seq: e.seq, text: e.text };
    }
  }
  return null;
}

/** Result of `submitNarration`. */
export type ShipResult =
  | { ok: true; shipped: boolean }
  | { ok: false; error: NodeError };

/**
 * Submits the narration check chose to ship, then each correction as an AI-DM `talk` proposal
 * (spec 103 plan D2). Runs after resolve's submissions, in the same module so every gate call
 * stays here (AC #5).
 */
export async function submitNarration(
  ctx: TurnContext,
  check: CheckOutput,
  checkpoint: TurnCheckpoint,
): Promise<ShipResult> {
  const shipped = check.shipped;
  if (!shipped) return { ok: true, shipped: false };
  if (checkpoint.narration?.shipped) return { ok: true, shipped: false };
  const run = new Run({ ...ctx, checkpoint });
  try {
    await run.submit("narration", "narration", () => ({
      kind: "narration",
      ...note("Narrate the beat", "Narration checked."),
      narration: {
        text: shipped.text.slice(0, 8000),
        actionIds: shipped.actionIds,
      },
      visibility: "public",
    }));
    for (const [n, c] of shipped.corrections.entries()) {
      await run.submit(`correction-${n}`, "talk", () => ({
        kind: "talk",
        ...note("Narration correction", c.text),
        talk: { text: c.text.slice(0, 4000), channel: "ic", characterId: null },
        visibility: c.visibility,
      }));
    }
    const saved = await ctx.deps.saveCheckpoint({
      ...checkpoint,
      submissions: run.submissions,
      lastSeq: run.lastSeq,
      narration: {
        check: check.record,
        shipped: true,
        seqs: run.submissions.find((s) => s.key === "narration")?.seqs ?? [],
      },
    });
    if (!saved)
      return {
        ok: false,
        error: { kind: "fenced", message: "the lease was lost" },
      };
    return { ok: true, shipped: true };
  } catch (error) {
    if (error instanceof Stop) return { ok: false, error: error.error };
    throw error;
  }
}

/** One proposal a read ships, keyed for reclaim (spec 066 FR-013, T034). */
export interface ReadShip {
  key: string;
  kind: ProposalKind;
  build: (stepRef: string) => Proposal;
}

/**
 * Submits a read's answer and confirm rows in order, each fenced and keyed for reclaim (`answer:`,
 * `confirm:`). Lives here so every gate call stays in this module (AC #5). A gate refusal comes
 * back as `{ ok: false }` with `error.detail.code`; the caller reads `SUGGESTION_STALE` from it.
 */
export async function shipReadRows(
  ctx: TurnContext,
  checkpoint: TurnCheckpoint,
  rows: readonly ReadShip[],
): Promise<
  { ok: true; checkpoint: TurnCheckpoint } | { ok: false; error: NodeError }
> {
  const run = new Run({ ...ctx, checkpoint });
  try {
    for (const r of rows) await run.submit(r.key, r.kind, r.build);
  } catch (error) {
    if (error instanceof Stop) return { ok: false, error: error.error };
    throw error;
  }
  return {
    ok: true,
    checkpoint: {
      ...checkpoint,
      submissions: run.submissions,
      lastSeq: run.lastSeq,
    },
  };
}

/** The failure notice (FR-012): a `dm`-visibility talk row naming the node and error kind. */
export async function submitFailureNotice(
  deps: Pick<TurnContext["deps"], "gate">,
  sessionId: string,
  node: string,
  errorKind: string,
): Promise<boolean> {
  const text = `The DM runtime stopped at ${node}: ${errorKind}. The actions stay committed.`;
  const res = await deps.gate.submit(sessionId, AI_DM, {
    kind: "talk",
    ...note("DM runtime failure notice", text),
    talk: { text, channel: "ooc", characterId: null },
    visibility: "dm",
  } satisfies Proposal);
  return res.ok;
}
