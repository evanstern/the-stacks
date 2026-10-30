import type {
  SessionProjections,
  StoredEvent,
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

/** FR-001: public IC talk from a human or companion, AI seat, free mode. */
export function isReadable(row: StoredEvent, p: SessionProjections): boolean {
  if (row.type !== "talk" || row.visibility !== "public") return false;
  if ((row.payload as { channel?: string }).channel !== "ic") return false;
  if (!isHumanActor(row.actor) && !row.actor.startsWith("ai:companion:"))
    return false;
  return p.gate.seat.kind === "ai" && p.tableMode.mode === "free";
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

/** OQ-16: skip the model when no NPC is named and the post asks nothing. */
export function needsModel(triggers: CodeTrigger[], text: string): boolean {
  return (
    triggers.some((t) => !t.party && t.kind !== "overheard") ||
    text.includes("?")
  );
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
