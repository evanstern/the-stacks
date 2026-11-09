import type {
  SessionProjections,
  TranscriptEntry,
} from "@the-stacks/session-model";
import { estimateTokens } from "@the-stacks/srd";
import type { AssembleOutput, BeatItem } from "../nodes/assemble.js";
import type { SceneSeed } from "../seed/schema.js";
import { type ActorSnapshot, snapshotSection } from "../snapshot/index.js";

/**
 * Shared prompt parts and the token caps (contracts/nodes.md "Token budget",
 * SC-007). Every part is assembled by code under its cap, measured with
 * `estimateTokens`. A part over its cap is cut by whole entries.
 */

export const CAPS = {
  doctrine: 900,
  seed: 1500,
  transcript: 1500,
  transcriptEntries: 20,
  srdRecords: 8,
  srdPerRecord: 120,
  snapshotDm: 2000,
  snapshotSeat: 2000,
  snapshotFiction: 800,
  facts: 800,
  passages: 2500,
  passageCount: 5,
} as const;

/**
 * Keeps whole entries while their total fits the cap. `drop: "start"` removes
 * the oldest entries first (chronological lists); `drop: "end"` removes the
 * least important last entries (lists written most important first).
 */
export function capEntries(
  entries: readonly string[],
  cap: number,
  drop: "start" | "end",
): string[] {
  const kept = [...entries];
  const total = () => kept.reduce((n, e) => n + estimateTokens(e) + 1, 0);
  while (kept.length > 0 && total() > cap) {
    if (drop === "start") kept.shift();
    else kept.pop();
  }
  return kept;
}

/** A labelled section from entries under a cap; "" when nothing fits. */
export function section(
  label: string,
  entries: readonly string[],
  cap: number,
  drop: "start" | "end",
): string {
  const kept = capEntries(entries, cap, drop);
  if (kept.length === 0) return "";
  return `## ${label}\n${kept.join("\n")}`;
}

export function joinSections(sections: readonly string[]): string {
  return sections.filter((s) => s !== "").join("\n\n");
}

/** Spec 080 D2: the current beat's discoverable clues as `<beatId>#<n>: text (found with ability skill)`. No DC. */
export function clueEntries(seed: SceneSeed, beatId: string | null): string[] {
  const beat = seed.beats.find((b) => b.id === beatId);
  if (!beat) return [];
  return beat.clues.map((c, i) => {
    const how = c.check
      ? ` (found with ${[c.check.ability, c.check.skill].filter(Boolean).join(" ")})`
      : "";
    return `${beat.id}#${i + 1}: ${c.text}${how}`;
  });
}

/** Goal, location, present NPCs, active encounter: most important first. */
export function seedEntries(
  seed: SceneSeed,
  assembled: AssembleOutput,
): string[] {
  const entries: string[] = [
    `Goal: ${seed.goal.statement} Success: ${seed.goal.success} Failure: ${seed.goal.failure}`,
    `Location: ${seed.location.name}. ${seed.location.identity.features.join(" ")} Mood: ${seed.location.portrayal.mood}`,
  ];
  const encounter = seed.encounters.find(
    (e) => e.id === assembled.activeEncounterId,
  );
  if (encounter) {
    entries.push(
      `Active encounter "${encounter.id}": ${encounter.name}. Terrain: ${encounter.terrain} Morale: ${encounter.morale}`,
    );
  }
  for (const id of assembled.presentNpcIds) {
    const npc = seed.npcs.find((n) => n.id === id);
    if (!npc) continue;
    entries.push(
      `NPC ${npc.id} (${npc.name}, ${npc.identity.role}): voice ${npc.portrayal.voice}; wants ${npc.portrayal.want}`,
    );
  }
  return entries;
}

/** A party member as the transcript names them: id, display name, controlling actor. */
export interface RosterEntry {
  characterId: string;
  name: string;
  actor: string;
}

/** The roster from the projections' party. */
export function rosterOf(party: SessionProjections["party"]): RosterEntry[] {
  return party.map((m) => ({
    characterId: m.characterId,
    name: m.name,
    actor:
      m.controller.kind === "player" ? m.controller.userId : m.controller.actor,
  }));
}

/**
 * Player user id to the character they seat, for the DM-side prompts.
 * ponytail: a user seating two characters labels as the first; upgrade path
 * is TASK-0269, where each Intent carries its seat's actor.
 */
export function seatsOf(
  party: SessionProjections["party"],
): Map<string, string> {
  const seats = new Map<string, string>();
  for (const m of party) {
    if (m.controller.kind === "player" && !seats.has(m.controller.userId)) {
      seats.set(m.controller.userId, m.characterId);
    }
  }
  return seats;
}

/** The DM-side actor label: a character id or an ai actor, never a user id. */
export function dmActorLabel(
  actor: string,
  characterId: string | null,
  seats: ReadonlyMap<string, string>,
): string {
  return (
    characterId ??
    seats.get(actor) ??
    (actor === "system" || actor.startsWith("ai:") ? actor : "a player")
  );
}

function speaker(
  actor: string,
  characterId: string | null,
  roster: readonly RosterEntry[] | undefined,
  seats: ReadonlyMap<string, string> = new Map(),
): string {
  if (!roster) return dmActorLabel(actor, characterId, seats);
  if (characterId) {
    const byChar = roster.find((r) => r.characterId === characterId);
    if (byChar) return byChar.name;
  }
  const companion = actor.startsWith("ai:companion:")
    ? roster.find((r) => r.characterId === actor.slice("ai:companion:".length))
    : undefined;
  if (companion) return companion.name;
  if (actor === "ai:dm") return "the DM";
  return "a player";
}

function transcriptLine(
  e: TranscriptEntry,
  roster: readonly RosterEntry[] | undefined,
  seats?: ReadonlyMap<string, string>,
): string {
  switch (e.kind) {
    case "talk":
      return `[${e.seq}] ${speaker(e.actor, e.characterId, roster, seats)} said: ${e.text}`;
    case "narration":
      return `[${e.seq}] narration: ${e.text}`;
    case "action.declared":
      return `[${e.seq}] ${speaker(e.actor, e.characterId, roster, seats)} declared ${e.actionId}: ${e.text}`;
    case "action.commented":
      return `[${e.seq}] ${speaker(e.actor, null, roster, seats)} ${e.stance} on ${e.actionId}: ${e.text}`;
    case "action.committed":
      return `[${e.seq}] ${e.actionId} committed (${e.authority})`;
    case "action.resolved":
      return `[${e.seq}] ${e.actionId} resolved: ${e.outcome}`;
    case "action.withdrawn":
      return `[${e.seq}] ${e.actionId} withdrawn`;
  }
}

/**
 * The last 20 entries, oldest dropped first to fit. With a roster the output
 * is player-facing: non-public entries are dropped and speakers are named.
 * Without one it is the DM-side form: every entry, a human labelled by seated character id.
 */
export function transcriptEntries(
  tail: readonly TranscriptEntry[],
  roster?: readonly RosterEntry[],
  seats?: ReadonlyMap<string, string>,
): string[] {
  const kept = roster ? tail.filter((e) => e.visibility === "public") : tail;
  return kept
    .slice(-CAPS.transcriptEntries)
    .map((e) => transcriptLine(e, roster, seats));
}

export function beatEntries(
  beat: readonly BeatItem[],
  seats: ReadonlyMap<string, string> = new Map(),
): string[] {
  return beat.map(
    (b) =>
      `${b.actionId} [${b.status}] by ${dmActorLabel(b.actor, b.characterId, seats)} (${b.scope}): ${b.text}`,
  );
}

/** `## State` from the snapshot in the `dm` view; throws SnapshotOverflowError on overflow. */
export function dmStateSection(
  snapshot: ActorSnapshot,
  seed: { trackers?: readonly { trackerId: string; advanceWhen: string }[] },
  withTrackers: boolean,
): string {
  return snapshotSection("State", snapshot, {
    view: "dm",
    cap: CAPS.snapshotDm,
    trackers: withTrackers
      ? {
          advanceWhen: new Map(
            (seed.trackers ?? []).map((t) => [t.trackerId, t.advanceWhen]),
          ),
        }
      : false,
  });
}

export function srdEntries(assembled: AssembleOutput): string[] {
  return assembled.srdRecords.slice(0, CAPS.srdRecords).map((r) => r.compact);
}
