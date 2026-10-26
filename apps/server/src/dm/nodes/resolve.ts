import type { EngineCommand } from "@the-stacks/dnd5e-engine";
import {
  type GateRefusal,
  mechanicsProposal,
  type Proposal,
  type ProposalKind,
  type SessionProjections,
  type StoredEvent,
  type TableMode,
} from "@the-stacks/session-model";
import type { Gate } from "../../gate/index.js";
import type { TurnCheckpoint } from "../jobs.js";
import type { Node, NodeError, TurnContext } from "../pipeline/context.js";
import { combatantFromSrd } from "../seed/combatants.js";
import type { AssembleOutput, BeatItem } from "./assemble.js";
import type { AuditOutput } from "./audit.js";
import type { DirectorNodeOutput } from "./director.js";
import type { Effect, InterpretReading, Step } from "./schemas.js";

/**
 * The resolve node (contracts/resolve.md): the one module that writes, and
 * only through `gate.submit` as `ai:dm`. It picks every next step from engine
 * events alone; no model is read here. Each submission is checkpointed, so a
 * reclaimed job replays recorded submissions and looks for the in-flight
 * one's marker (FR-006).
 */

const AI_DM = { kind: "ai", actor: "ai:dm" } as const;
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
}

export type ActionOutcome = "applied" | "refused" | "no-effect" | "awaiting-dm";

export interface ResolveOutput {
  submissions: Submission[];
  actionResults: {
    actionId: string;
    outcome: ActionOutcome;
    batchIds: string[];
    refusalCode: string | null;
  }[];
  appendedRows: StoredEvent[];
  nextJob:
    | { kind: "turn"; trigger: "npc-turn" }
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

/** Looks for a submission that landed after the last checkpoint save. */
function findLanded(
  p: SessionProjections,
  proposal: Proposal,
  stepRef: string,
): SubmitResult | null {
  const done = (
    batchId: string | null,
    outcome: string | null = null,
  ): SubmitResult => ({
    result: "applied",
    refusal: null,
    batchId,
    outcome,
  });
  if (proposal.kind === "mechanics") {
    const suffix = ` [${stepRef}]`;
    const rows = p.ledger.filter((r) => r.reason.endsWith(suffix));
    if (rows.length === 0) return null;
    let outcome: string | null = null;
    for (const r of rows) {
      if (
        r.kind === "outcome" &&
        "outcome" in r.outcome &&
        (r.outcome.type === "check.resolved" ||
          r.outcome.type === "attack.resolved")
      ) {
        outcome = r.outcome.outcome;
      }
    }
    return done(rows[0]?.batchId ?? null, outcome);
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
      return proposal.after && t && t.filled === proposal.after.filled
        ? done(null)
        : null;
    }
    case "table-mode":
      return JSON.stringify(p.tableMode) === JSON.stringify(proposal.after)
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

class Run {
  readonly submissions: Submission[];
  readonly appended: StoredEvent[] = [];
  lastSeq: number;
  private checkLanded: boolean;
  private checkpoint: TurnCheckpoint;

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
          AI_DM,
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
          if (r.source === "engine") {
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
            batchId: res.batchId,
            outcome: outcomeOf(res.events),
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
  ): Promise<Submission> {
    return this.submit(key, "mechanics", (ref) =>
      mechanicsProposal(
        { ...command, reason: withMarker(reason, ref) } as EngineCommand,
        {
          actionId,
          summary: reason.slice(0, 200),
          rationale: `Resolve ${key}`,
        },
      ),
    );
  }
}

// ---------------------------------------------------------------- effects

function effectCommand(
  effect: Effect,
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

interface ChainResult {
  batchIds: string[];
  awaiting: boolean;
  /** The engine refused the first mechanics step and nothing applied. */
  firstRefusal: GateRefusal | null;
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
        const sub = await run.mech(
          key,
          {
            type: "check.roll",
            combatantId: step.combatantId,
            kind: step.kind,
            ability: step.ability,
            skill: step.skill,
            expression: step.expression,
            mode: step.mode,
            dc: step.dc,
            autoFail: step.autoFail,
          },
          step.reason,
          actionId,
        );
        if (take(sub)) {
          await runEffects(
            key,
            sub.outcome === "success" ? step.onSuccess : step.onFailure,
            step.reason,
            false,
          );
        }
        break;
      }
      case "attack": {
        const sub = await run.mech(
          key,
          {
            type: "attack.roll",
            attackerId: step.attackerId,
            targetId: step.targetId,
            expression: step.expression,
            mode: step.mode,
            targetAc: step.targetAc,
          },
          step.reason,
          actionId,
        );
        if (
          take(sub) &&
          (sub.outcome === "hit" || sub.outcome === "critical-hit")
        ) {
          await runEffects(
            key,
            step.onHit,
            step.reason,
            sub.outcome === "critical-hit",
          );
        }
        break;
      }
    }
  }
  return chain;
}

// ---------------------------------------------------------- Director group

/** Active actor rule (director.md). */
export function activeActorFor(
  p: SessionProjections,
  combatantId: string,
): { activeActor: string; activeCharacterId: string | null } {
  const member = p.party.find((m) => m.combatantId === combatantId);
  if (!member) return { activeActor: "ai:dm", activeCharacterId: null };
  return {
    activeActor:
      member.controller.kind === "player"
        ? member.controller.userId
        : member.controller.actor,
    activeCharacterId: member.characterId,
  };
}

interface Local {
  mode: "free" | "turn";
  encounterActive: boolean;
  /** The table mode this turn set (applied), if any. */
  newTableMode: TableMode | null;
  modeJustStarted: boolean;
}

async function directorGroup(
  run: Run,
  ctx: TurnContext,
  assembled: AssembleOutput,
  director: DirectorNodeOutput,
  local: Local,
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
    const seats = ctx.job.start?.seats ?? {};
    for (const c of seed.characters) {
      const init = c.identity.combatant;
      await run.mech(
        `director:combatant:${init.id}`,
        { type: "combatant.add", combatant: init },
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
    return;
  }

  // trackers
  for (const adv of director.trackers) {
    const before = p.trackers.find((t) => t.trackerId === adv.trackerId);
    if (!before) continue;
    const filled = Math.max(
      0,
      Math.min(before.segments, before.filled + adv.advance),
    );
    if (filled === before.filled) continue;
    await run.submit(`director:tracker:${adv.trackerId}`, "tracker", () => ({
      kind: "tracker",
      ...note(`Advance ${before.name}`, adv.reason),
      reason: adv.reason,
      trackerId: adv.trackerId,
      visibility: "dm",
      after: { ...before, filled },
    }));
  }

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

  // table mode
  const tm = director.tableMode;
  if (tm.to === "turn") {
    const enc = seed.encounters.find((e) => e.id === tm.encounterId);
    if (enc) {
      for (const m of enc.monsters) {
        if (p.engine.combatants[m.combatantId]) continue;
        const rec = deps.srd.getById("monster", m.srdMonsterId);
        if (!rec) throw stop("internal", `no SRD monster ${m.srdMonsterId}`);
        await run.mech(
          `director:combatant:${m.combatantId}`,
          {
            type: "combatant.add",
            combatant: combatantFromSrd(rec, m.combatantId, m.name),
          },
          `${m.name ?? rec.name} joins the fight`,
          null,
        );
      }
      const ids = [
        ...p.party
          .filter(
            (m) =>
              m.combatantId && m.combatant && m.combatant.lifeState !== "dead",
          )
          .map((m) => m.combatantId as string),
        ...enc.monsters.map((m) => m.combatantId),
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
        const fresh = await deps.loadProjections(ctx.job.sessionId);
        const active = fresh.encounter?.activeCombatantId;
        if (active) {
          await setMode(
            { mode: "turn", ...activeActorFor(fresh, active) },
            tm.reason,
          );
          local.modeJustStarted = true;
        }
      }
    }
  } else if (tm.to === "free") {
    await endEncounter(tm.reason);
    await setMode({ mode: "free" }, tm.reason);
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

function actionGroupSteps(
  reading: InterpretReading | undefined,
  ruling: { steps: Step[] } | undefined,
): { steps: readonly Step[]; clarify: boolean } {
  if (ruling) return { steps: ruling.steps, clarify: false };
  if (!reading) return { steps: [], clarify: false };
  return { steps: reading.steps, clarify: reading.clarify !== null };
}

async function resolveAction(
  run: Run,
  item: BeatItem,
  reading: InterpretReading | undefined,
  ruling: { steps: Step[] } | undefined,
): Promise<ResolveOutput["actionResults"][number]> {
  const { steps, clarify } = actionGroupSteps(reading, ruling);
  const chain: ChainResult = clarify
    ? { batchIds: [], awaiting: false, firstRefusal: null }
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
  if (batchIds.length > 0) outcome = "applied";
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
        reading?.intent
          ? `Intent: ${reading.intent}`
          : "Resolved by the DM runtime",
      ),
      resolution: {
        actionId: item.actionId,
        outcome,
        batchIds: outcome === "applied" ? batchIds : [],
        refusalCode: (outcome === "refused" ? refusalCode : null) as never,
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
  return { actionId: item.actionId, outcome, batchIds, refusalCode };
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
  const hold = director.beat.decision === "hold";
  const local: Local = {
    mode: assembled.projections.tableMode.mode,
    encounterActive: assembled.projections.encounter !== null,
    newTableMode: null,
    modeJustStarted: false,
  };
  const actionResults: ResolveOutput["actionResults"] = [];
  let npcTurn: ResolveOutput["npcTurn"] = null;

  try {
    await directorGroup(run, ctx, assembled, director, local);

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
        actionResults.push(await resolveAction(run, item, reading, ruling));
      }

      // NPC group.
      if (assembled.npcTurn) {
        const reading = readings.find((r) => r.actionId === null);
        const ruling = rulings.find((r) => r.actionId === null);
        const { steps } = actionGroupSteps(reading, ruling);
        const chain = await runSteps(run, "npc", steps, null);
        npcTurn = {
          combatantId: assembled.npcTurn.combatantId,
          batchIds: [...new Set(chain.batchIds)],
          awaitingDm: chain.awaiting,
        };
      }

      // Turn advance group.
      if (
        local.mode === "turn" &&
        local.encounterActive &&
        !local.modeJustStarted
      ) {
        const mode = local.newTableMode ?? assembled.projections.tableMode;
        if (mode.mode === "turn") {
          const done =
            (mode.activeActor === "ai:dm" &&
              npcTurn !== null &&
              !npcTurn.awaitingDm) ||
            assembled.beat.some(
              (b) =>
                b.characterId !== null &&
                b.characterId === mode.activeCharacterId &&
                actionResults.some(
                  (r) =>
                    r.actionId === b.actionId && r.outcome !== "awaiting-dm",
                ),
            );
          if (done) {
            const adv = await run.mech(
              "advance",
              { type: "turn.advance" },
              "Advance the turn",
              null,
            );
            if (adv.result === "applied") {
              const fresh = await ctx.deps.loadProjections(ctx.job.sessionId);
              const active = fresh.encounter?.activeCombatantId;
              if (active) {
                const after: TableMode = {
                  mode: "turn",
                  ...activeActorFor(fresh, active),
                };
                const sub = await run.submit(
                  "advance:table-mode",
                  "table-mode",
                  () => ({
                    kind: "table-mode",
                    ...note("Next active actor", "The turn advanced."),
                    reason: "The turn advanced.",
                    after,
                  }),
                );
                if (sub.result === "applied") local.newTableMode = after;
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

  return {
    ok: true,
    node: "resolve",
    calls: [],
    output: {
      submissions: run.submissions,
      actionResults,
      appendedRows: run.appended,
      nextJob,
      chronicle: false,
      npcTurn,
      lastSeq: run.lastSeq,
    },
  };
};

// ------------------------------------------------- narration and notices

/** Result of `submitNarration`. */
export type ShipResult =
  | { ok: true; shipped: boolean }
  | { ok: false; error: NodeError };

/**
 * Submits the narration audit chose to ship, then the audit flag when it was
 * the fallback (audit.md "What ships"). Runs after resolve's submissions, in
 * the same module so every gate call stays here (AC #5).
 */
export async function submitNarration(
  ctx: TurnContext,
  audit: AuditOutput,
  checkpoint: TurnCheckpoint,
): Promise<ShipResult> {
  const shipped = audit.shipped;
  if (!shipped) return { ok: true, shipped: false };
  if (checkpoint.narration?.shipped) return { ok: true, shipped: false };
  const run = new Run({ ...ctx, checkpoint });
  try {
    await run.submit("narration", "narration", () => ({
      kind: "narration",
      ...note("Narrate the beat", "Audit passed."),
      narration: {
        text: shipped.text.slice(0, 8000),
        actionIds: shipped.actionIds,
      },
      visibility: "public",
    }));
    if (shipped.flagBody) {
      const body = shipped.flagBody;
      await run.submit("audit-flag", "journal", () => ({
        kind: "journal",
        ...note("Audit flag: narration replaced", body.slice(0, 1000)),
        entry: {
          entryId: `audit-${ctx.job.id}`,
          title: "Audit flag: narration replaced",
          body: body.slice(0, 8000),
          sourceActionIds: shipped.actionIds,
        },
        visibility: "dm",
      }));
    }
    const saved = await ctx.deps.saveCheckpoint({
      ...checkpoint,
      submissions: run.submissions,
      lastSeq: run.lastSeq,
      narration: { attempts: audit.record.attempts, shipped: true },
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
