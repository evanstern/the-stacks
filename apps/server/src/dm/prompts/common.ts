import type {
  SessionProjections,
  TranscriptEntry,
} from "@the-stacks/session-model";
import { estimateTokens } from "@the-stacks/srd";
import type { AssembleOutput, BeatItem } from "../nodes/assemble.js";
import type { SceneSeed } from "../seed/schema.js";

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
  projections: 800,
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

function transcriptLine(e: TranscriptEntry): string {
  switch (e.kind) {
    case "talk":
      return `[${e.seq}] ${e.actor} said: ${e.text}`;
    case "narration":
      return `[${e.seq}] narration: ${e.text}`;
    case "action.declared":
      return `[${e.seq}] ${e.actor} declared ${e.actionId}: ${e.text}`;
    case "action.commented":
      return `[${e.seq}] ${e.actor} ${e.stance} on ${e.actionId}: ${e.text}`;
    case "action.committed":
      return `[${e.seq}] ${e.actionId} committed (${e.authority})`;
    case "action.resolved":
      return `[${e.seq}] ${e.actionId} resolved: ${e.outcome}`;
  }
}

/** The last 20 entries, oldest dropped first to fit. */
export function transcriptEntries(tail: readonly TranscriptEntry[]): string[] {
  return tail.slice(-CAPS.transcriptEntries).map(transcriptLine);
}

export function beatEntries(beat: readonly BeatItem[]): string[] {
  return beat.map(
    (b) =>
      `${b.actionId} [${b.status}] by ${b.characterId ?? b.actor} (${b.scope}): ${b.text}`,
  );
}

/** Party, encounter and table mode; trackers only when asked (the Director). */
export function projectionEntries(
  projections: SessionProjections,
  seed: SceneSeed,
  withTrackers: boolean,
): string[] {
  const entries: string[] = [];
  entries.push(
    projections.tableMode.mode === "turn"
      ? `Table mode: turn; active ${projections.tableMode.activeActor}`
      : "Table mode: free",
  );
  for (const m of projections.party) {
    const c = m.combatant;
    const sheet = seed.characters.find((s) => s.characterId === m.characterId);
    const state = c
      ? `${m.combatantId} HP ${c.hp.current}/${c.hp.max}${c.ac !== null ? ` AC ${c.ac}` : ""} ${c.lifeState}${c.conditions.length > 0 ? ` [${c.conditions.map((x) => x.condition).join(",")}]` : ""}`
      : "no combatant";
    const mods = sheet
      ? ` mods ${JSON.stringify(sheet.identity.abilityMods)} prof +${sheet.identity.proficiencyBonus} saves ${JSON.stringify(sheet.identity.saves)} skills ${JSON.stringify(sheet.identity.skills)}`
      : "";
    const attacks = sheet
      ? sheet.identity.attacks
          .map(
            (a) =>
              ` attack ${a.name}: ${a.expression} dmg ${a.damage.map((d) => `${d.dice} ${d.damageType}`).join("+")}`,
          )
          .join(";")
      : "";
    entries.push(
      `Party ${m.characterId} (${m.name}, ${m.controller.kind}): ${state}${mods}${attacks}`,
    );
  }
  const enc = projections.encounter;
  if (enc) {
    entries.push(
      `Encounter round ${enc.round}, active ${enc.activeCombatantId}: ${enc.order
        .map(
          (o) =>
            `${o.combatantId} init ${o.initiative} HP ${o.hp.current}/${o.hp.max} ${o.lifeState}`,
        )
        .join("; ")}`,
    );
  }
  if (withTrackers) {
    for (const t of projections.trackers) {
      const def = seed.trackers.find((s) => s.trackerId === t.trackerId);
      entries.push(
        `Tracker ${t.trackerId} (${t.name}) ${t.filled}/${t.segments}${def ? `; advance when: ${def.advanceWhen}` : ""}`,
      );
    }
  }
  return entries;
}

export function srdEntries(assembled: AssembleOutput): string[] {
  return assembled.srdRecords.slice(0, CAPS.srdRecords).map((r) => r.compact);
}

/** The shared description of the step grammar (interpret and adjudicate). */
export const STEP_GRAMMAR = [
  "A step states mechanics INPUTS as data. Allowed steps:",
  '{"step":"none","reason":str}  (certain outcome; no roll)',
  '{"step":"check","reason":str,"combatantId":id|null,"kind":"ability-check"|"saving-throw","ability":"str"|"dex"|"con"|"int"|"wis"|"cha","skill":str|null,"expression":"1d20+5","mode":"normal"|"advantage"|"disadvantage","dc":int,"autoFail":{"reason":str}|null,"onSuccess":[effect],"onFailure":[effect]}',
  '{"step":"attack","reason":str,"attackerId":id|null,"targetId":id,"expression":"1d20+5","mode":roll mode,"targetAc":int|null,"onHit":[effect]}',
  '{"step":"effect","reason":str,"effects":[effect]}',
  '{"step":"roll","reason":str,"expression":"1d6","mode":roll mode}',
  "An effect is one of:",
  '{"effect":"damage","targetId":id,"components":[{"amount":Amount,"damageType":str}],"defenses":{"resistances":[],"vulnerabilities":[],"immunities":[]}|null}',
  '{"effect":"heal","targetId":id,"amount":Amount}',
  '{"effect":"condition","op":"apply"|"remove","targetId":id,"condition":str,"source":str}',
  'Amount is {"kind":"roll","expression":"1d8+3"} or {"kind":"fixed","value":int}; use fixed only where the SRD names a fixed value.',
  "The expression carries the modifier you choose (ability modifier, proficiency, bonus dice). Never state a total, an applied amount or whether anything succeeds: the engine rolls and decides every number.",
].join("\n");
