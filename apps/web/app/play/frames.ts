import {
  ActionCommentedV1,
  ActionDeclaredV1,
  CombatantIdSchema,
  currentVersion,
  GATE_REQUEST_VERSION,
  RefIdSchema,
  TalkV1,
} from "@the-stacks/session-model";
import type {
  CommentInput,
  CommitInput,
  DeclareInput,
  FloorInput,
  TalkInput,
  WithdrawInput,
} from "./source.ts";

/**
 * What `useSession.sendEvent` takes; the server adds actor, seq and ts. `eventType` names a
 * gate request kind (specs/029-proposal-gate/contracts/ws-delivery.md); `payload` is the
 * request without its `kind`.
 */
export interface EventFrame {
  eventType: string;
  payload: unknown;
  payloadVersion: number;
  visibility?: string;
}

/** The slice of a zod schema used here; apps/web does not depend on zod directly. */
interface Parser {
  safeParse(
    data: unknown,
  ): { success: true; data: unknown } | { success: false };
}

function build(
  kind: string,
  schema: Parser,
  payload: unknown,
  wrap: (parsed: unknown) => unknown,
): EventFrame | null {
  const parsed = schema.safeParse(payload);
  if (!parsed.success) return null;
  return {
    eventType: kind,
    payload: wrap(parsed.data),
    payloadVersion: GATE_REQUEST_VERSION,
  };
}

export function talkFrame(input: TalkInput): EventFrame | null {
  return build(
    "talk",
    TalkV1,
    {
      text: input.text.trim(),
      channel: input.channel,
      characterId: input.characterId,
    },
    (talk) => ({ talk }),
  );
}

/** `actionId` is injectable for tests; the default is `act-` plus a UUID. */
export function declareFrame(
  input: DeclareInput,
  actionId: string = `act-${crypto.randomUUID()}`,
): EventFrame | null {
  return build(
    "action.declare",
    ActionDeclaredV1,
    {
      actionId,
      characterId: input.characterId,
      scope: input.scope,
      text: input.text.trim(),
    },
    (action) => ({ action }),
  );
}

export function commentFrame(input: CommentInput): EventFrame | null {
  return build(
    "action.comment",
    ActionCommentedV1,
    {
      actionId: input.actionId,
      stance: input.stance,
      text: input.text.trim(),
    },
    (comment) => ({ comment }),
  );
}

/** The gate derives the authority; the frame carries only the action id. */
export function commitFrame(input: CommitInput): EventFrame | null {
  const parsed = RefIdSchema.safeParse(input.actionId);
  if (!parsed.success) return null;
  return {
    eventType: "action.commit",
    payload: { actionId: input.actionId },
    payloadVersion: GATE_REQUEST_VERSION,
  };
}

/** Withdraw an open action; the gate allows its declarer and the seated DM. */
export function withdrawFrame(input: WithdrawInput): EventFrame | null {
  if (!RefIdSchema.safeParse(input.actionId).success) return null;
  return {
    eventType: "action.withdraw",
    payload: { actionId: input.actionId },
    payloadVersion: GATE_REQUEST_VERSION,
  };
}

const FLOOR_REASON: Record<FloorInput["op"], string> = {
  end: "Ends the turn.",
  take: "The DM takes the floor.",
  return: "The DM returns the floor.",
};

/** The reason a floor request carries when the caller names none. */
export function floorReason(op: FloorInput["op"]): string {
  return FLOOR_REASON[op];
}

/**
 * A `floor` gate request (specs/049-turn-floor/contracts/floor-request.md). It carries the
 * turn the viewer saw, so the gate refuses it with TURN_MOVED when the turn has moved on.
 */
export function floorFrame(input: FloorInput): EventFrame | null {
  if (!(input.op in FLOOR_REASON)) return null;
  const { turn } = input;
  if (
    !turn ||
    !Number.isInteger(turn.round) ||
    turn.round < 1 ||
    !CombatantIdSchema.safeParse(turn.combatantId).success
  ) {
    return null;
  }
  const reason = (input.reason ?? "").trim() || FLOOR_REASON[input.op];
  if (reason.length > 500) return null;
  return {
    eventType: "floor",
    payload: {
      op: input.op,
      turn: { round: turn.round, combatantId: turn.combatantId },
      reason,
    },
    payloadVersion: GATE_REQUEST_VERSION,
  };
}

export function approveFrame(proposalId: string): EventFrame | null {
  if (!RefIdSchema.safeParse(proposalId).success) return null;
  return {
    eventType: "proposal.approve",
    payload: { proposalId },
    payloadVersion: GATE_REQUEST_VERSION,
  };
}

/** A blank reason is sent as `null` (the gate takes 1 to 500 characters or null). */
export function rejectFrame(
  proposalId: string,
  reason: string | null,
): EventFrame | null {
  if (!RefIdSchema.safeParse(proposalId).success) return null;
  const trimmed = reason?.trim().slice(0, 500) ?? "";
  return {
    eventType: "proposal.reject",
    payload: { proposalId, reason: trimmed === "" ? null : trimmed },
    payloadVersion: GATE_REQUEST_VERSION,
  };
}

const LOCAL_TYPE: Record<string, { type: string; key: string | null }> = {
  talk: { type: "talk", key: "talk" },
  "action.declare": { type: "action.declared", key: "action" },
  "action.comment": { type: "action.commented", key: "comment" },
};

/**
 * Fixture mode: the catalog event a gate-request frame stands for, to append to the
 * page-local log. `authority` is the committer's authority (the live gate derives it). A
 * `floor` request maps to null: its rows depend on the projection, so fixture mode builds
 * them with `localFloorEvents` (local-log.ts).
 */
export function localEventOf(
  frame: EventFrame,
  authority?: string,
): { eventType: string; payload: unknown; payloadVersion: number } | null {
  const payload = frame.payload as Record<string, unknown>;
  let type: string;
  let body: unknown;
  if (frame.eventType === "action.commit") {
    type = "action.committed";
    body = { actionId: payload.actionId, authority };
  } else if (frame.eventType === "action.withdraw") {
    type = "action.withdrawn";
    body = { actionId: payload.actionId };
  } else {
    const map = LOCAL_TYPE[frame.eventType];
    if (!map?.key) return null;
    type = map.type;
    body = payload[map.key];
  }
  const version = currentVersion(type);
  if (version === undefined) return null;
  return { eventType: type, payload: body, payloadVersion: version };
}
