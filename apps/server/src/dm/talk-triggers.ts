import {
  type ReadablePost,
  readablePosts,
  type SessionProjections,
} from "@the-stacks/session-model";
import type { SceneSeed } from "./seed/schema.js";
import type { ActorSnapshot } from "./snapshot/types.js";

/**
 * Pure talk-trigger rules (specs/065-talk-triggers plan D1). No I/O, no model.
 * The read rule, the chain cap and the code triggers.
 */

/** Chain cap (OQ-10): DM reactions allowed after the latest human row. */
export const TALK_CHAIN_CAP = 2;

export type TalkTriggerKind = "addressed" | "mentioned" | "overheard";

export interface CodeTrigger {
  kind: TalkTriggerKind;
  actorId: string;
  /** True for a party member (an AI companion); false for a seed NPC. */
  party: boolean;
}

const isHumanActor = (actor: string): boolean =>
  !actor.startsWith("ai:") && actor !== "system";

/**
 * Spec 066 FR-006: true when the row at `row.seq` is a post the AI DM reads. Delegates to the
 * pure `readablePosts` in session-model, so the server and the client agree.
 */
export function isReadable(
  row: { seq: number },
  p: SessionProjections,
): boolean {
  return readablePosts(p).some((post) => post.seq === row.seq);
}

/** FR-012: true when `cap` DM narration rows follow the latest human row. */
export function capReached(
  p: SessionProjections,
  cap: number = TALK_CHAIN_CAP,
): boolean {
  let count = 0;
  for (let i = p.transcript.length - 1; i >= 0; i--) {
    const e = p.transcript[i];
    if (!e) continue;
    if (isHumanActor(e.actor)) break;
    if (e.kind === "narration" && e.actor === "ai:dm") count++;
  }
  return count >= cap;
}

const escapeRe = (s: string): string =>
  s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const wordRe = (term: string): string =>
  `(?<![\\p{L}\\p{N}_])${escapeRe(term)}(?![\\p{L}\\p{N}_])`;

const STOP = new Set(["with", "from", "that", "this", "their"]);

/** Role words of an NPC: letter runs of 4+ chars, lowercase. */
function roleWords(role: string): string[] {
  return (role.toLowerCase().match(/\p{L}+/gu) ?? []).filter(
    (w) => w.length >= 4 && !STOP.has(w),
  );
}

/** FR-002: triggers by whole-word match on aliases and seed role words. */
export function codeTriggers(
  text: string,
  snapshot: ActorSnapshot,
  seed: SceneSeed | null,
): CodeTrigger[] {
  const out: CodeTrigger[] = [];
  for (const a of snapshot.actors) {
    const party = a.kind === "party";
    if (a.kind === "monster") continue;
    if (party && a.controller.kind !== "ai-companion") continue;
    if (a.presence !== "present" || a.lifeState === "dead") continue;
    const terms = a.aliases.filter((t) => t.trim());
    const role = seed?.npcs.find((n) => n.id === a.id)?.identity.role;
    const roles = role ? roleWords(role) : [];
    const named = (t: string, pre = "", post = ""): boolean =>
      new RegExp(pre + wordRe(t) + post, "iu").test(text);
    const addressed = terms.some(
      (t) => named(t, "^\\s*") || named(t, "", "\\s*[,?]"),
    );
    const mentioned =
      terms.some((t) => named(t)) || roles.some((w) => named(w));
    if (addressed) out.push({ kind: "addressed", actorId: a.id, party });
    else if (mentioned) out.push({ kind: "mentioned", actorId: a.id, party });
    else if (!party) out.push({ kind: "overheard", actorId: a.id, party });
  }
  return out;
}

/**
 * Spec 066 FR-010: the read calls the model when a post is rule 1, 3 or 4 and human-authored.
 * A read of rule 2 posts only (a declared Intent) or of companion posts only makes no call.
 */
export function needsModel(posts: readonly ReadablePost[]): boolean {
  return posts.some((post) => post.rule !== 2 && isHumanActor(post.actor));
}

/** FR-004: every addressed actor is a companion and no NPC is named. */
export function companionOnly(triggers: CodeTrigger[]): boolean {
  const addressed = triggers.filter((t) => t.kind === "addressed");
  return (
    addressed.length > 0 &&
    addressed.every((t) => t.party) &&
    !triggers.some((t) => !t.party && t.kind !== "overheard")
  );
}

/** What a talk turn records in `jobs.result.talk` (FR-014). */
export interface TalkResult {
  /** Seqs of the posts the turn read. */
  posts: number[];
  codeTriggers: CodeTrigger[];
  modelTriggers: { kind: string; actorId: string | null }[];
  outcome: "none" | "reply" | "scene" | "escalate" | "confirm" | "interrupted";
  /** Spec 066 FR-013: model and code items the read shipped in an `action.suggested` row. */
  confirmItems: number;
  /** Spec 066 FR-013: true when an `ask_dm` answer shipped. */
  answered: boolean;
  reason: string;
}
