import type { SessionNativeEvent } from "../catalog.js";
import type { ActionView, TranscriptEntry } from "./types.js";

type Base = Pick<TranscriptEntry, "seq" | "ts" | "actor" | "visibility">;

function base(event: {
  seq: number;
  ts: string;
  actor: string;
  visibility: string;
}): Base {
  return {
    seq: event.seq,
    ts: event.ts,
    actor: event.actor,
    visibility: event.visibility,
  };
}

type TalkLike = Extract<
  SessionNativeEvent,
  {
    type:
      | "talk"
      | "narration"
      | "action.declared"
      | "action.commented"
      | "action.committed"
      | "action.resolved"
      | "action.withdrawn";
  }
>;

/** The transcript entry for a talk, narration or lifecycle event. */
export function transcriptEntry(event: TalkLike): TranscriptEntry {
  const b = base(event);
  switch (event.type) {
    case "talk":
      return {
        ...b,
        kind: "talk",
        text: event.payload.text,
        channel: event.payload.channel,
        characterId: event.payload.characterId,
      };
    case "narration":
      return {
        ...b,
        kind: "narration",
        text: event.payload.text,
        actionIds: event.payload.actionIds,
      };
    case "action.declared":
      return {
        ...b,
        kind: "action.declared",
        actionId: event.payload.actionId,
        characterId: event.payload.characterId,
        scope: event.payload.scope,
        text: event.payload.text,
      };
    case "action.commented":
      return {
        ...b,
        kind: "action.commented",
        actionId: event.payload.actionId,
        stance: event.payload.stance,
        text: event.payload.text,
      };
    case "action.committed":
      return {
        ...b,
        kind: "action.committed",
        actionId: event.payload.actionId,
        authority: event.payload.authority,
      };
    case "action.withdrawn":
      return {
        ...b,
        kind: "action.withdrawn",
        actionId: event.payload.actionId,
      };
    case "action.resolved":
      return {
        ...b,
        kind: "action.resolved",
        actionId: event.payload.actionId,
        outcome: event.payload.outcome,
        refusalCode: event.payload.refusalCode,
      };
  }
}

type LifecycleEvent = Extract<
  SessionNativeEvent,
  {
    type:
      | "action.declared"
      | "action.commented"
      | "action.committed"
      | "action.resolved"
      | "action.withdrawn";
  }
>;

/** Applies the transition table. `ignored` is true when the event breaks the status rules. */
export function applyLifecycle(
  actions: ActionView[],
  event: LifecycleEvent,
): { actions: ActionView[]; ignored: boolean } {
  const id = event.payload.actionId;
  const existing = actions.find((a) => a.actionId === id);
  if (event.type === "action.declared") {
    if (existing) return { actions, ignored: true };
    const view: ActionView = {
      actionId: id,
      declaredSeq: event.seq,
      actor: event.actor,
      characterId: event.payload.characterId,
      scope: event.payload.scope,
      text: event.payload.text,
      status: "declared",
      comments: [],
      committed: null,
      resolved: null,
    };
    return { actions: [...actions, view], ignored: false };
  }
  if (!existing) return { actions, ignored: true };
  const replace = (next: ActionView) => ({
    actions: actions.map((a) => (a === existing ? next : a)),
    ignored: false,
  });
  const open =
    existing.status === "declared" || existing.status === "discussed";
  switch (event.type) {
    case "action.commented":
      if (!open) return { actions, ignored: true };
      return replace({
        ...existing,
        status: "discussed",
        comments: [
          ...existing.comments,
          {
            seq: event.seq,
            actor: event.actor,
            stance: event.payload.stance,
            text: event.payload.text,
          },
        ],
      });
    case "action.committed":
      if (!open) return { actions, ignored: true };
      return replace({
        ...existing,
        status: "committed",
        committed: {
          seq: event.seq,
          actor: event.actor,
          authority: event.payload.authority,
        },
      });
    case "action.withdrawn":
      if (!open) return { actions, ignored: true };
      return replace({ ...existing, status: "withdrawn" });
    case "action.resolved":
      if (existing.status !== "committed") return { actions, ignored: true };
      return replace({
        ...existing,
        status: "resolved",
        resolved: {
          seq: event.seq,
          outcome: event.payload.outcome,
          batchIds: event.payload.batchIds,
          refusalCode: event.payload.refusalCode,
        },
      });
  }
}
