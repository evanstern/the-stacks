import { estimateTokens } from "@the-stacks/srd";
import {
  type ActorSnapshot,
  type OverflowDetail,
  type RenderOptions,
  type SnapshotActor,
  SnapshotOverflowError,
} from "./types.js";

/**
 * Renders a snapshot in one of three views under a token cap (contract §6).
 * Over the cap, only dead and absent actors compress to one line. Nothing is
 * dropped or cut short; a snapshot that still does not fit is an overflow.
 */

export type RenderResult =
  | { ok: true; lines: string[] }
  | { ok: false; detail: OverflowDetail };

const totalOf = (lines: readonly string[]): number =>
  lines.reduce((n, l) => n + estimateTokens(l) + 1, 0);

function nameOf(snapshot: ActorSnapshot, id: string | null): string | null {
  if (!id) return null;
  return snapshot.actors.find((a) => a.id === id)?.name ?? null;
}

function conditionText(a: SnapshotActor, digits: boolean): string {
  if (a.conditions.length === 0) return "";
  const names = a.conditions.map((c) =>
    digits && c.level !== null ? `${c.condition} ${c.level}` : c.condition,
  );
  return `[${names.join(",")}]`;
}

function stageLines(snapshot: ActorSnapshot, opts: RenderOptions): string[] {
  const { stage } = snapshot;
  const lines: string[] = [];
  if (opts.view === "fiction") {
    const tm = stage.tableMode;
    const who =
      tm.mode === "turn" ? (nameOf(snapshot, tm.activeActorId) ?? null) : null;
    const encWho = stage.encounter
      ? nameOf(snapshot, stage.encounter.activeActorId)
      : null;
    if (stage.encounter) {
      lines.push(`A fight is on.${encWho ? ` It is ${encWho}'s turn.` : ""}`);
    } else {
      lines.push(`No fight is on.${who ? ` It is ${who}'s turn.` : ""}`);
    }
    return lines;
  }
  const tm = stage.tableMode;
  if (tm.mode === "turn") {
    const name = nameOf(snapshot, tm.activeActorId);
    lines.push(
      `Table mode: turn; active ${tm.activeActor}${name ? ` (${name})` : ""}`,
    );
  } else {
    lines.push("Table mode: free");
  }
  const enc = stage.encounter;
  if (enc) {
    const name = nameOf(snapshot, enc.activeActorId);
    lines.push(
      `Encounter round ${enc.round}, active ${enc.activeActorId ?? enc.activeCombatantId}${name ? ` "${name}"` : ""}; order: ${enc.order.join(", ")}`,
    );
  }
  if (opts.view === "dm" && opts.trackers) {
    for (const t of stage.trackers) {
      const adv = opts.trackers.advanceWhen.get(t.trackerId);
      lines.push(
        `Tracker ${t.trackerId} (${t.name}) ${t.filled}/${t.segments}${adv ? `; advance when: ${adv}` : ""}`,
      );
    }
  }
  return lines;
}

function controllerLabel(a: SnapshotActor): string {
  switch (a.controller.kind) {
    case "player":
      return "player";
    case "ai-companion":
      return "ai-companion";
    case "dm":
      return "dm";
  }
}

function sheetText(a: SnapshotActor): string {
  const s = a.sheet;
  if (!s) return "";
  const attacks = s.attacks
    .map(
      (x) =>
        ` attack ${x.name}: ${x.expression} dmg ${x.damage.map((d) => `${d.dice} ${d.damageType}`).join("+")}`,
    )
    .join(";");
  return ` mods ${JSON.stringify(s.abilityMods)} prof +${s.proficiencyBonus} saves ${JSON.stringify(s.saves)} skills ${JSON.stringify(s.skills)}${attacks}${s.spells.length > 0 ? ` spells ${s.spells.join(",")}` : ""}`;
}

function resourcesText(a: SnapshotActor): string {
  const r = a.resources;
  if (!r) return "";
  const parts: string[] = [];
  if (r.deathSaves.successes !== 0 || r.deathSaves.failures !== 0)
    parts.push(
      `death saves ${r.deathSaves.successes} ok/${r.deathSaves.failures} fail`,
    );
  if (r.hitDice.length > 0)
    parts.push(
      `hit dice ${r.hitDice.map((h) => `d${h.die} ${h.remaining}/${h.total}`).join(",")}`,
    );
  if (r.spellSlots.length > 0)
    parts.push(
      `slots left ${r.spellSlots
        .map(
          (s) =>
            `${s.pact ? "pact " : ""}L${s.level}:${s.max - s.expended}/${s.max}`,
        )
        .join(",")}`,
    );
  return parts.length > 0 ? ` ${parts.join("; ")}` : "";
}

function fullLine(a: SnapshotActor, opts: RenderOptions): string {
  if (opts.view === "fiction") return fictionLine(a);
  const detailed =
    opts.view === "dm" || a.kind === "party" || a.id === opts.self;
  const head = `${a.id} "${a.name}" (${a.kind}${a.kind === "party" ? `, ${controllerLabel(a)}` : ""}${a.combatantId && a.combatantId !== a.id ? `, combatant ${a.combatantId}` : ""})`;
  const bits: string[] = [];
  if (a.hp) {
    bits.push(
      `HP ${a.hp.current}/${a.hp.max}${a.hp.temp !== 0 ? ` +${a.hp.temp} temp` : ""}${detailed && a.ac !== null ? ` AC ${a.ac}` : ""} ${a.lifeState}`,
    );
  } else {
    bits.push("no combatant");
  }
  const cond = conditionText(a, true);
  if (cond) bits.push(cond);
  if (a.initiative !== null) bits.push(`init ${a.initiative}`);
  if (a.presence !== "present") bits.push(a.presence);
  let line = `${head}: ${bits.join(" ")}`;
  if (detailed) line += `${resourcesText(a)}${sheetText(a)}`;
  return line;
}

const LIFE_WORDS: Record<string, string> = {
  conscious: "conscious",
  unconscious: "unconscious",
  stable: "unconscious but stable",
  dead: "dead",
};

function fictionLine(a: SnapshotActor): string {
  const who =
    a.kind === "party"
      ? `party, ${a.controller.kind === "player" ? "human player" : "AI companion"}`
      : a.kind;
  const bits: string[] = [a.lifeState ? (LIFE_WORDS[a.lifeState] ?? "") : ""];
  const cond = conditionText(a, false);
  if (cond) bits.push(cond);
  if (a.presence === "yielded") bits.push("stepped back");
  if (a.presence === "absent") bits.push("gone");
  const state = bits.filter(Boolean).join(" ");
  return `${a.name} (${who}): ${state || "present"}`;
}

const isCompressible = (a: SnapshotActor): boolean =>
  a.lifeState === "dead" || a.presence === "absent";

function compressedLine(a: SnapshotActor, opts: RenderOptions): string {
  const dead = a.lifeState === "dead";
  const gone = a.presence === "absent";
  if (opts.view === "fiction")
    return `${a.name} (${a.kind}): ${dead ? "dead" : "gone"}`;
  const word = dead && gone ? "dead, absent" : dead ? "dead" : "absent";
  return `${a.id} "${a.name}" (${a.kind}): ${word}`;
}

export function renderSnapshot(
  snapshot: ActorSnapshot,
  opts: RenderOptions,
): RenderResult {
  const stage = stageLines(snapshot, opts);
  const full = snapshot.actors.map((a) => fullLine(a, opts));
  if (totalOf([...stage, ...full]) <= opts.cap) {
    return { ok: true, lines: [...stage, ...full] };
  }
  let compressed = 0;
  const lines = snapshot.actors.map((a, i) => {
    if (isCompressible(a)) {
      compressed++;
      return compressedLine(a, opts);
    }
    return full[i] as string;
  });
  const all = [...stage, ...lines];
  const tokens = totalOf(all);
  if (tokens <= opts.cap) return { ok: true, lines: all };
  return {
    ok: false,
    detail: {
      view: opts.view,
      tokens,
      cap: opts.cap,
      actors: snapshot.actors.length,
      compressed,
    },
  };
}

/** `## <label>` plus the lines; throws SnapshotOverflowError when they cannot fit. */
export function snapshotSection(
  label: string,
  snapshot: ActorSnapshot,
  opts: RenderOptions,
): string {
  const r = renderSnapshot(snapshot, opts);
  if (!r.ok) throw new SnapshotOverflowError(r.detail);
  return `## ${label}\n${r.lines.join("\n")}`;
}
