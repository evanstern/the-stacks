import {
  ActionCommentedV1,
  ActionCommittedV1,
  ActionDeclaredV1,
  currentVersion,
  TalkV1,
} from "@the-stacks/session-model";
import type {
  CommentInput,
  CommitInput,
  DeclareInput,
  TalkInput,
} from "./source.ts";

/** What `useSession.sendEvent` takes; the server adds actor, seq and ts. */
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
  eventType: string,
  schema: Parser,
  payload: unknown,
): EventFrame | null {
  const version = currentVersion(eventType);
  const parsed = schema.safeParse(payload);
  if (version === undefined || !parsed.success) return null;
  return { eventType, payload: parsed.data, payloadVersion: version };
}

export function talkFrame(input: TalkInput): EventFrame | null {
  return build("talk", TalkV1, {
    text: input.text.trim(),
    channel: input.channel,
    characterId: input.characterId,
  });
}

/** `actionId` is injectable for tests; the default is `act-` plus a UUID. */
export function declareFrame(
  input: DeclareInput,
  actionId: string = `act-${crypto.randomUUID()}`,
): EventFrame | null {
  return build("action.declared", ActionDeclaredV1, {
    actionId,
    characterId: input.characterId,
    scope: input.scope,
    text: input.text.trim(),
  });
}

export function commentFrame(input: CommentInput): EventFrame | null {
  return build("action.commented", ActionCommentedV1, {
    actionId: input.actionId,
    stance: input.stance,
    text: input.text.trim(),
  });
}

export function commitFrame(input: CommitInput): EventFrame | null {
  return build("action.committed", ActionCommittedV1, {
    actionId: input.actionId,
    authority: input.authority,
  });
}
