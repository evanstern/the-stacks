import type { z } from "zod";
import type {
  DamagePart as DamagePartSchema,
  MonsterFeature as MonsterFeatureSchema,
  Monster as MonsterSchema,
  SrdKind,
  SrdRecord,
} from "./schema/index.js";
import { estimateTokens } from "./tokens.js";

/** Hard ceiling on the estimated size of a compact form (compact contract). */
export const COMPACT_CEILING = 120;

/** One addable piece of a compact form. `join` is "line" (new line) or "space" (continues the line). */
interface Unit {
  text: string;
  join: "line" | "space";
}

type DamagePart = z.infer<typeof DamagePartSchema>;
type Monster = z.infer<typeof MonsterSchema>;
type MonsterFeature = z.infer<typeof MonsterFeatureSchema>;

const line = (text: string): Unit => ({ text, join: "line" });

/** Leading-sentence units: the first starts a line, the rest continue it. */
function sentences(text: string, prefix = ""): Unit[] {
  const flat = text.replace(/\s*\n+\s*/g, " ").trim();
  if (flat === "") return [];
  const parts = flat.split(/(?<=[.!?])\s+/).filter((s) => s !== "");
  return parts.map((s, i) => ({
    text: i === 0 ? `${prefix}${s}` : s,
    join: i === 0 ? "line" : "space",
  }));
}

function tailCost(n: number): number {
  return 2 + Math.ceil(String(n).length / 3); // "+", digits, "more"
}

function assemble(header: string, units: Unit[], page: number): string {
  const footer = `SRD 5.2.1 p.${page}`;
  const render = (used: Unit[], tail: string | undefined): string => {
    let body = header;
    for (const u of used) body += (u.join === "line" ? "\n" : " ") + u.text;
    if (tail) body += `\n${tail}`;
    return `${body}\n${footer}`;
  };

  const all = render(units, undefined);
  if (estimateTokens(all) <= COMPACT_CEILING) return all;

  const fixed = estimateTokens(header) + estimateTokens(footer);
  let total = fixed;
  const used: Unit[] = [];
  for (let i = 0; i < units.length; i++) {
    const unit = units[i] as Unit;
    const cost = estimateTokens(unit.text);
    const remainingAfter = units.length - i - 1;
    const reserve = remainingAfter > 0 ? tailCost(remainingAfter) : 0;
    if (total + cost + reserve > COMPACT_CEILING) break;
    used.push(unit);
    total += cost;
  }
  const omitted = units.length - used.length;
  return render(used, omitted > 0 ? `+${omitted} more` : undefined);
}

const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);
const dice = (d: string): string => d.replace(/\s+/g, "");
const money = (c: { amount: number; unit: string }): string =>
  `${c.amount}${c.unit}`;

function alignment(text: string): string {
  const words = text.split(/\s+/);
  const initials: Record<string, string> = {
    Lawful: "L",
    Neutral: "N",
    Chaotic: "C",
    Good: "G",
    Evil: "E",
  };
  if (text === "Unaligned") return "U";
  if (words.length <= 2 && words.every((w) => initials[w])) {
    return words.length === 1
      ? (initials[words[0] as string] as string)
      : words.map((w) => initials[w]).join("");
  }
  return text;
}

function shortCondition(condition: string): string {
  return condition
    .replace(/^if the attack roll had Advantage$/i, "adv")
    .replace(/^if the attack roll had Disadvantage$/i, "disadv")
    .replace(/\bAdvantage\b/g, "adv")
    .replace(/\bDisadvantage\b/g, "disadv")
    .replace(/\bthe attack roll\b/g, "attack");
}

function damageText(hit: readonly DamagePart[]): string {
  const [first, ...rest] = hit;
  if (!first) return "";
  const fmt = (p: DamagePart): string =>
    p.dice ? dice(p.dice) : `${p.average}`;
  let out = `${fmt(first)} ${first.type}`;
  if (rest.length > 0) {
    const extra = rest.map((p) => {
      const type = p.type === first.type ? "" : ` ${p.type}`;
      const cond = p.condition ? ` ${shortCondition(p.condition)}` : "";
      return `+${fmt(p)}${type}${cond}`;
    });
    out += ` (${extra.join(", ")})`;
  }
  return out;
}

function monsterAction(f: MonsterFeature): string {
  if (f.attack) {
    const a = f.attack;
    const bits = [`${f.name} ${a.bonus >= 0 ? "+" : ""}${a.bonus}`];
    if (a.reach !== undefined) bits.push(`${a.reach}ft`);
    if (a.range)
      bits.push(
        a.range.long !== undefined
          ? `${a.range.normal}/${a.range.long}ft`
          : `${a.range.normal}ft`,
      );
    const dmg = damageText(a.hit);
    if (dmg) bits.push(dmg);
    return bits.join(" ");
  }
  if (f.save) return `${f.name} DC ${f.save.dc} ${cap(f.save.ability)}`;
  return f.name;
}

function monsterUnits(m: Monster): { header: string; units: Unit[] } {
  const size = m.size.join("/");
  const header = `${m.name} [monster/${m.id}] ${size} ${m.type}, ${alignment(m.alignment)}`;
  const speed = [`${m.speed.walk}`];
  for (const mode of ["burrow", "climb", "fly", "swim"] as const) {
    const v = m.speed[mode];
    if (v !== undefined) speed.push(`${mode} ${v}`);
  }
  const units: Unit[] = [
    line(
      `AC ${m.ac} HP ${m.hp.average} (${m.hp.formula}) Spd ${speed.join(" ")} CR ${m.cr.rating}`,
    ),
  ];
  const mods = (["str", "dex", "con", "int", "wis", "cha"] as const)
    .map((k) => {
      const mod = m.abilities[k].mod;
      return `${cap(k)}${mod >= 0 ? "+" : ""}${mod}`;
    })
    .join(" ");
  units.push(line(mods));
  for (const a of m.actions) units.push(line(monsterAction(a)));
  if (m.bonusActions.length > 0)
    units.push(
      line(`Bonus: ${m.bonusActions.map((a) => monsterAction(a)).join(", ")}`),
    );
  if (m.reactions.length > 0)
    units.push(
      line(`React: ${m.reactions.map((a) => monsterAction(a)).join(", ")}`),
    );
  if (m.traits.length > 0)
    units.push(line(`Traits: ${m.traits.map((t) => t.name).join(", ")}`));
  return { header, units };
}

function spellUnits(s: SrdRecord<"spell">): { header: string; units: Unit[] } {
  const level = s.level === 0 ? "cantrip" : `level ${s.level}`;
  const header = `${s.name} [spell/${s.id}] ${s.school} ${level}${s.ritual ? " ritual" : ""}${s.concentration ? " conc" : ""}`;
  const comps = [
    s.components.v && "V",
    s.components.s && "S",
    s.components.m && "M",
  ]
    .filter(Boolean)
    .join(",");
  const units: Unit[] = [
    line(`${s.castingTime}; ${s.range}; ${comps}; ${s.duration}`),
    ...sentences(s.text),
  ];
  if (s.higherLevels) {
    const first = sentences(s.higherLevels)[0];
    if (first)
      units.push(
        line(`${s.level === 0 ? "Upgrade" : "Higher"}: ${first.text}`),
      );
  }
  return { header, units };
}

function classUnits(c: SrdRecord<"class">): { header: string; units: Unit[] } {
  const casts = c.spellcastingAbility ? `; casts ${c.spellcastingAbility}` : "";
  const header = `${c.name} [class/${c.id}] ${c.hitDie}; saves ${c.savingThrows.join(",")}; primary ${c.primaryAbility}${casts}`;
  const units: Unit[] = [];
  for (const row of c.levels.slice(0, 5)) {
    if (row.features.length > 0)
      units.push(line(`L${row.level} ${row.features.join(", ")}`));
  }
  units.push(line(`Subclass ${c.subclass.name}`));
  units.push(line("+L6-20"));
  return { header, units };
}

function equipmentUnits(e: SrdRecord<"equipment">): {
  header: string;
  units: Unit[];
} {
  const header = `${e.name} [equipment/${e.id}]`;
  switch (e.category) {
    case "weapon": {
      const dmg = e.damage.dice
        ? `${dice(e.damage.dice)} ${e.damage.type}`
        : `${e.damage.average ?? 0} ${e.damage.type}`;
      const props = e.properties.map((p) =>
        p === "Versatile" && e.versatile
          ? `Versatile (${dice(e.versatile)})`
          : p,
      );
      if (e.range) props.push(`range ${e.range.normal}/${e.range.long}`);
      const bits = [
        `${e.weaponCategory} ${e.rangeType} ${dmg}`,
        ...(props.length > 0 ? [props.join(", ")] : []),
        `mastery ${e.mastery}`,
        money(e.cost),
      ];
      return { header, units: [line(bits.join("; "))] };
    }
    case "armor": {
      const ac =
        "bonus" in e.ac
          ? `AC +${e.ac.bonus}`
          : `AC ${e.ac.base}${e.ac.addDex ? `+Dex${e.ac.dexMax !== undefined ? `(max ${e.ac.dexMax})` : ""}` : ""}`;
      const bits = [e.armorCategory, ac];
      if (e.strength !== undefined) bits.push(`Str ${e.strength}`);
      if (e.stealthDisadvantage) bits.push("stealth disadv");
      bits.push(money(e.cost));
      return { header, units: [line(bits.join("; "))] };
    }
    case "adventuring-gear":
      return {
        header,
        units: [line(`${e.category}; ${money(e.cost)}`), ...sentences(e.text)],
      };
    case "tool":
      return {
        header,
        units: [
          line(`tool ${e.toolCategory}; ${cap(e.ability)}; ${money(e.cost)}`),
          ...sentences(e.utilize, "Utilize: "),
        ],
      };
    case "mount-or-vehicle": {
      const bits = [e.vehicleType, money(e.cost)];
      if (e.speed) bits.push(`speed ${e.speed}`);
      if (e.carryingCapacity) bits.push(`carries ${e.carryingCapacity}`);
      return { header, units: [line(bits.join("; "))] };
    }
  }
}

function conditionUnits(c: SrdRecord<"condition">): {
  header: string;
  units: Unit[];
} {
  const units: Unit[] = [];
  for (const effect of c.effects) {
    units.push(...sentences(effect.text, `${effect.name}: `));
  }
  return { header: `${c.name} [condition/${c.id}]`, units };
}

function ruleUnits(r: SrdRecord<"rule">): { header: string; units: Unit[] } {
  const units: Unit[] = [];
  for (const block of r.blocks) {
    if (block.type === "table") {
      block.rows.forEach((row, i) => {
        const cells = row.join(" | ");
        units.push(
          line(i === 0 && block.title ? `${block.title}: ${cells}` : cells),
        );
      });
    }
  }
  for (const block of r.blocks) {
    if (block.type === "text") units.push(...sentences(block.text));
  }
  for (const block of r.blocks) {
    if (block.type === "list") {
      for (const item of block.items) units.push(line(`- ${item}`));
    }
  }
  if (r.children.length > 0) {
    // Child titles are the last path segment, recovered from the id's last "." part is lossy,
    // so list child ids' final slug segment. Titles are not stored on the parent.
    const titles = r.children.map((c) => c.slice(c.lastIndexOf(".") + 1));
    units.push(line(`See: ${titles.join(", ")}`));
  }
  return { header: `${r.title} [rule/${r.id}]`, units };
}

/** Pure: same record in, same string out. No I/O. */
export function toCompact<K extends SrdKind>(
  kind: K,
  record: SrdRecord<K>,
): string {
  const page = (record as { source: { page: number } }).source.page;
  let built: { header: string; units: Unit[] };
  switch (kind) {
    case "monster":
      built = monsterUnits(record as SrdRecord<"monster">);
      break;
    case "spell":
      built = spellUnits(record as SrdRecord<"spell">);
      break;
    case "class":
      built = classUnits(record as SrdRecord<"class">);
      break;
    case "equipment":
      built = equipmentUnits(record as SrdRecord<"equipment">);
      break;
    case "condition":
      built = conditionUnits(record as SrdRecord<"condition">);
      break;
    case "rule":
      built = ruleUnits(record as SrdRecord<"rule">);
      break;
    default:
      throw new Error(`Unknown kind: ${String(kind)}`);
  }
  return assemble(built.header, built.units, page);
}
