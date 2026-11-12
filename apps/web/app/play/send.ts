import {
  type ActorRef,
  type Intent,
  type ParseContext,
  parse,
} from "@the-stacks/intent";

export interface SendContext {
  /** The out-of-character chip is chosen: the line is `ooc` unless it names a slash verb. */
  ooc: boolean;
  /** The Intent actor: the speaking character, or the DM. */
  actor: ActorRef;
  /** The character a declared action is for; null when none. */
  characterId: string | null;
  mode: "free" | "turn";
  /** Turn mode and this player holds the turn (FR-022). */
  active: boolean;
  resolve?: ParseContext["resolve"];
  /** Injectable for tests; the default is `int-` plus a UUID. */
  id?: string;
}

export type SendRoute =
  | { kind: "intent"; intent: Intent }
  /** Turn mode, active player, plain prose: `action.declare` then `action.commit` (FR-022). */
  | {
      kind: "declare-commit";
      declare: { text: string; characterId: string | null; scope: "character" };
    }
  | { kind: "refused"; message: string };

/** Plain prose opens with none of the grammar's lead characters. */
const isPlainProse = (t: string): boolean => !/^[/"@*(&$#]/.test(t);

/**
 * Where one composer line goes (spec 105 D2, FR-003, FR-022). Pure: the table view sends what
 * this returns. A parse refusal sends nothing.
 */
export function routeSend(text: string, ctx: SendContext): SendRoute {
  const trimmed = text.trim();
  const body =
    ctx.ooc && !trimmed.startsWith("/") && !trimmed.startsWith("((")
      ? `((${trimmed}))`
      : trimmed;
  const parsed = parse(body, {
    id: ctx.id ?? `int-${crypto.randomUUID()}`,
    actor: ctx.actor,
    source: "composer",
    commit: ctx.mode === "turn" ? "confirmed" : "declared",
    ...(ctx.resolve ? { resolve: ctx.resolve } : {}),
  });
  if (!parsed.ok) return { kind: "refused", message: parsed.refusal.message };
  if (
    ctx.mode === "turn" &&
    ctx.active &&
    !ctx.ooc &&
    parsed.intent.kind === "say" &&
    isPlainProse(trimmed)
  ) {
    return {
      kind: "declare-commit",
      declare: {
        text: trimmed,
        characterId: ctx.characterId,
        scope: "character",
      },
    };
  }
  return { kind: "intent", intent: parsed.intent };
}
