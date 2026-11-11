import type { EngineEvent } from "@the-stacks/dnd5e-engine";
import { evolve, execute, type Rng } from "@the-stacks/dnd5e-engine";
import {
  INTENT_SCHEMA_VERSION,
  type Intent,
  KIND_RULES,
  toText,
} from "@the-stacks/intent";
import {
  PLAN_KINDS,
  type PlanFact,
  plan,
  type RulingRequest,
  stepOutcome,
} from "@the-stacks/planner";
import type { IntentRecorded } from "../events/intents.js";
import { spatialFor } from "../projections/spatial.js";
import type { SessionProjections } from "../projections/types.js";
import type { Viewer } from "../visibility.js";
import { endTurnRows } from "./floor-end.js";
import { revealRows } from "./fog.js";
import type { PlanContext } from "./plan.js";
import { buildPlanState } from "./plan-state.js";
import { actorOf, type Proposer } from "./proposals.js";
import { controls, isAiDm, isSeatedDm } from "./roles.js";
import {
  mechanicsRows,
  type PlanIds,
  type PlannedRow,
  type PlanResult,
  refuse,
} from "./rows.js";
import { currentTurn, floorHeld } from "./turn.js";

type Seat = "player" | "companion" | "dm" | "ai-dm";
type Actor = Intent["actor"];

/** Owners of the not-planned kinds the gate does not handle (spec 102 FR-018, OQ-8). */
const UNSERVED_OWNER: Record<string, string> = {
  ask_dm: "TASK-0199",
  whisper: "spec 102 OQ-8 (whisper Intents)",
  pause: "spec 102 OQ-8 (session Intents)",
  bookmark: "spec 102 OQ-8 (session Intents)",
  recap: "spec 102 OQ-8 (session Intents)",
  retry_narration: "spec 102 OQ-8 (session Intents)",
  predeclare: "N-10",
};

const seatOf = (p: SessionProjections, proposer: Proposer): Seat =>
  isAiDm(proposer)
    ? "ai-dm"
    : isSeatedDm(p, proposer)
      ? "dm"
      : proposer.kind === "ai"
        ? "companion"
        : "player";

const viewerOf = (seat: Seat, proposer: Proposer): Viewer =>
  seat === "dm" || seat === "ai-dm"
    ? { role: "dm" }
    : { role: "player", userId: actorOf(proposer) };

function actorOk(
  p: SessionProjections,
  proposer: Proposer,
  seat: Seat,
  actor: Actor,
): boolean {
  switch (seat) {
    case "player":
      return actor.kind === "pc" && controls(p, proposer, actor.id);
    case "companion":
      return actor.kind === "companion" && controls(p, proposer, actor.id);
    case "dm":
      return (
        actor.kind === "dm" ||
        actor.kind === "npc" ||
        (actor.kind === "pc" && controls(p, proposer, actor.id))
      );
    case "ai-dm":
      return actor.kind === "ai:dm" || actor.kind === "npc";
  }
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== "object" || typeof b !== "object" || !a || !b) return false;
  const ka = Object.keys(a).filter((k) => (a as never)[k] !== undefined);
  const kb = Object.keys(b).filter((k) => (b as never)[k] !== undefined);
  return (
    ka.length === kb.length &&
    ka.every((k) =>
      deepEqual((a as Record<string, unknown>)[k], (b as never)[k]),
    )
  );
}

/** Equal bodies: every field but `commit` and `source` (FR-009). */
function sameBody(a: Intent, b: Intent): boolean {
  const strip = ({ commit: _c, source: _s, ...rest }: Intent) => rest;
  return deepEqual(strip(a), strip(b));
}

/** The Intent's text form without its body, cut to 500 characters (planner FR-004). */
function reasonOf(intent: Intent): string {
  const text = toText({ ...intent, text: undefined } as Intent);
  return (text === "" ? intent.kind : text).slice(0, 500);
}

function carrier(
  actor: string,
  intent: Intent,
  outcome: IntentRecorded["outcome"],
  extra: Partial<IntentRecorded> = {},
): PlannedRow {
  const payload: IntentRecorded = {
    intent,
    schemaVersion: INTENT_SCHEMA_VERSION,
    outcome,
    batchId: null,
    facts: [],
    request: null,
    answers: null,
    stopped: null,
    ...extra,
  };
  return { actor, type: "intent.recorded", payload, visibility: "public" };
}

const settled = (rows: PlannedRow[], batchId: string | null): PlanResult => ({
  ok: true,
  rows,
  batchId,
});

/** Spec 102 FR-010: whose turn a mutating Intent from a player or companion may take. */
function notYourTurn(
  p: SessionProjections,
  intent: Intent,
  seat: Seat,
): boolean {
  if (seat !== "player" && seat !== "companion") return false;
  if (p.tableMode.mode !== "turn" || p.encounter === null) return false;
  const rule = KIND_RULES[intent.kind];
  if (rule.group === "reaction" || rule.group === "roll") return false;
  if (rule.mutates !== "yes" && rule.mutates !== "via-ruling") return false;
  const id = "id" in intent.actor ? intent.actor.id : null;
  const cid = p.party.find((m) => m.characterId === id)?.combatantId ?? null;
  return cid === null || cid !== p.encounter.activeCombatantId || floorHeld(p);
}

/** FR-012: an `ai:dm` amend body with a literal `dc` or a fixed amount. */
function amendHasNumber(intent: Intent): boolean {
  if (intent.kind !== "ruling" || !intent.params.amend) return false;
  const params = intent.params.amend.params as Record<string, unknown>;
  const amount = params.amount as { kind?: string } | undefined;
  return params.dc !== undefined || amount?.kind === "fixed";
}

/** FR-018: the not-planned kinds the gate handles itself. */
function planGateKind(
  p: SessionProjections,
  intent: Intent,
  actor: string,
): PlanResult {
  const text = intent.text;
  const done = (rows: PlannedRow[]) =>
    settled([...rows, carrier(actor, intent, "settled")], null);
  const row = (type: string, payload: unknown): PlannedRow => ({
    actor,
    type,
    payload,
    visibility: "public",
  });
  switch (intent.kind) {
    case "say":
    case "say_to":
    case "emote":
      return done([
        row("talk", {
          text,
          channel: "ic",
          characterId: "id" in intent.actor ? intent.actor.id : null,
        }),
      ]);
    case "npc_say":
      return done([row("talk", { text, channel: "ic", characterId: null })]);
    case "ooc":
    case "party":
      return done([row("talk", { text, channel: "ooc", characterId: null })]);
    case "narrate":
      return done([row("narration", { text, actionIds: [] })]);
    case "reveal": {
      const [target] = intent.targets;
      const toParty = intent.params.to === "party";
      if (!toParty || target?.kind !== "zone") {
        return refuse(
          "KIND_UNSERVED",
          "reveal serves a zone to the party only",
          {
            kind: "reveal",
            owner: "TASK-0288",
          },
        );
      }
      const zones = p.engine.space?.zones ?? [];
      if (!zones.some((z) => z.id === target.id)) {
        return refuse("TARGET_NOT_PRESENT", `no zone "${target.id}"`, {
          targetId: target.id,
        });
      }
      const revealed = revealRows(p, actor, [target.id], reasonOf(intent));
      if (!revealed.ok) return { ok: false, refusal: revealed.refusal };
      return done(revealed.rows);
    }
    default:
      return refuse(
        "KIND_UNSERVED",
        `the gate does not serve "${intent.kind}"`,
        { kind: intent.kind, owner: UNSERVED_OWNER[intent.kind] ?? "unowned" },
      );
  }
}

/**
 * Plans one `intent` request (spec 102 FR-005 to FR-027). Checks run in order before any die
 * is drawn; a refusal plans no rows. Every accepted Intent ends its batch with one
 * `intent.recorded` carrier row.
 */
export function planIntent(
  p: SessionProjections,
  proposer: Proposer,
  intent: Intent,
  rng: Rng,
  ids: PlanIds,
  proposalId: string | null,
  context: PlanContext | undefined,
): PlanResult {
  const actor = actorOf(proposer);
  const seat = seatOf(p, proposer);
  const rule = KIND_RULES[intent.kind];

  if (intent.commit === "draft") {
    return refuse("DRAFT_NOT_ACCEPTED", "a draft Intent is not accepted");
  }
  if (!(rule.seats as readonly string[]).includes(seat)) {
    const dmOnly = rule.seats.every((s) => s === "dm" || s === "ai-dm");
    return dmOnly
      ? refuse("DM_SEAT_REQUIRED", `${intent.kind} needs a DM seat`)
      : refuse("NOT_AUTHORIZED", `${intent.kind} is not open to this seat`);
  }

  const prior = p.intents.find((v) => v.id === intent.id);
  const confirmsDeclared =
    prior?.status === "declared" &&
    intent.commit === "confirmed" &&
    sameBody(prior.intent, intent);
  const dmSeat = seat === "dm" || seat === "ai-dm";
  if (
    !(dmSeat && prior?.status === "declared") &&
    !actorOk(p, proposer, seat, intent.actor)
  ) {
    return refuse("NOT_YOUR_ACTOR", "the actor is not yours");
  }
  if (prior && !confirmsDeclared) {
    return refuse("INTENT_EXISTS", `intent ${intent.id} exists`);
  }

  const mechanical = !["speech", "meta", "session", "dm"].includes(rule.group);
  if (intent.commit === "declared" && mechanical) {
    return settled([carrier(actor, intent, "declared")], null);
  }

  if (notYourTurn(p, intent, seat)) {
    return refuse("NOT_YOUR_TURN", "it is not your turn", {
      active: p.encounter?.activeCombatantId,
    });
  }
  if (seat === "ai-dm" && amendHasNumber(intent)) {
    return refuse("MODEL_NUMBER", "the AI DM may not choose a number");
  }

  const kind = PLAN_KINDS[intent.kind];
  if (kind.class === "not-planned") return planGateKind(p, intent, actor);

  if (intent.kind === "end_turn") {
    const now = currentTurn(p);
    if (p.tableMode.mode !== "turn" || now === null) {
      return refuse("NOT_TURN_MODE", "the table is not in turn mode");
    }
    const ended = endTurnRows(
      p,
      proposer,
      reasonOf(intent),
      rng,
      ids,
      proposalId,
      undefined,
    );
    if (!ended.ok) return ended;
    return settled(
      [
        ...ended.rows,
        carrier(actor, intent, "settled", { batchId: ended.batchId }),
      ],
      ended.batchId,
    );
  }

  const viewer = viewerOf(seat, proposer);
  const state = buildPlanState(p, viewer, context?.planner);
  const planned = plan(state, spatialFor(p, viewer), intent);

  if (planned.kind === "refusal") {
    const { source, code, message, details } = planned.refusal;
    return {
      ok: false,
      refusal: {
        source: source === "planner" ? "gate" : "engine",
        code,
        message,
        ...(details ? { details } : {}),
      },
    };
  }
  if (planned.kind === "needs_ruling") {
    return settled(
      [
        carrier(actor, intent, "needs_ruling", {
          facts: planned.facts,
          request: planned.request as RulingRequest,
        }),
      ],
      null,
    );
  }

  // Planner contract section 3: run in order, skip by `when`, refuse the first, stop at a later.
  let engine = p.engine;
  const events: EngineEvent[] = [];
  const outcomes: (ReturnType<typeof stepOutcome> | undefined)[] = [];
  let stopped: IntentRecorded["stopped"] = null;
  let ran = 0;
  for (const [i, step] of planned.commands.entries()) {
    if (step.when) {
      const seen = outcomes[step.when.step];
      if (seen === undefined || !step.when.outcomes.includes(seen as never)) {
        continue;
      }
    }
    const result = execute(engine, step.command, rng);
    if (!result.ok) {
      const { code, message, details } = result.refusal;
      if (ran === 0) {
        return {
          ok: false,
          refusal: {
            source: "engine",
            code,
            message,
            ...(details ? { details } : {}),
          },
        };
      }
      stopped = { code, message };
      break;
    }
    for (const event of result.events) engine = evolve(engine, event);
    events.push(...result.events);
    outcomes[i] = stepOutcome(result.events);
    ran++;
  }

  const answers =
    intent.kind === "ruling"
      ? intent.params.requestId
      : intent.kind === "set_dc"
        ? intent.params.for
        : null;
  const batchId = events.length > 0 ? ids.batchId : null;
  return settled(
    [
      ...mechanicsRows({
        actor,
        batchId: ids.batchId,
        events,
        actionId: null,
        proposalId,
        visibility: "public",
      }),
      carrier(actor, intent, "settled", {
        batchId,
        facts: planned.facts as PlanFact[],
        answers,
        stopped,
      }),
    ],
    batchId,
  );
}
