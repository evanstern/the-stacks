// Parses SRD 5.2.1 stat blocks from `pdftotext -raw` page text. Dev-time only.
import { lines } from "./equipment.mjs";
import { unwrap } from "./pdf.mjs";

const SIZES = "Tiny|Small|Medium|Large|Huge|Gargantuan";
export const SIZE_LINE = new RegExp(
  `^(${SIZES})(?: or (${SIZES}))? ([A-Z].+?)(?: \\((.+)\\))?, (.+)$`,
);

/** Every stat block in the Monsters chapters plus Giant Fly (page 222). */
export function monsterBlocks(raw) {
  const all = [...lines(raw, 222, 222), ...lines(raw, 254, 364)];
  const starts = [];
  for (let i = 1; i < all.length; i++) {
    if (
      SIZE_LINE.test(all[i].text) &&
      !/^(Tiny|Small|Medium|Large|Huge|Gargantuan) /.test(all[i - 1].text)
    ) {
      starts.push(i - 1);
    }
  }
  const blocks = [];
  for (let k = 0; k < starts.length; k++) {
    const from = starts[k];
    const to = k + 1 < starts.length ? starts[k + 1] : all.length;
    const ls = all.slice(from, to);
    blocks.push({
      name: ls[0].text,
      page: ls[0].page,
      lines: ls.map((l) => l.text),
    });
  }
  return blocks;
}

const U_MINUS = /−/g;
const KEYS = [
  "Skills",
  "Vulnerabilities",
  "Resistances",
  "Immunities",
  "Gear",
  "Senses",
  "Languages",
  "CR",
];

function splitTop(s) {
  const parts = [];
  let depth = 0;
  let cur = "";
  for (const ch of s) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) {
      parts.push(cur.trim());
      cur = "";
    } else cur += ch;
  }
  if (cur.trim()) parts.push(cur.trim());
  return parts;
}

const int = (s) =>
  Number(s.replace(U_MINUS, "-").replace(/^\+/, "").replace(/,/g, ""));

/** Parse the header portion (size line through the CR line) of a stat block. */
export function parseHeader(block) {
  const ls = block.lines;
  const sm = ls[1].match(SIZE_LINE);
  if (!sm) throw new Error(`${block.name}: no size line`);
  const [, size1, size2, type, tagsRaw, alignment] = sm;
  const h = {
    name: block.name,
    page: block.page,
    size: size2 ? [size1, size2] : [size1],
    type,
    tags: tagsRaw ? splitTop(tagsRaw) : [],
    alignment,
  };
  let i = 2;
  const acLine = ls[i++];
  const am = acLine.match(/^AC (\d+)\s+Initiative ([+−-]\d+) \((\d+)\)$/);
  if (!am) throw new Error(`${block.name}: AC line "${acLine}"`);
  h.ac = Number(am[1]);
  h.initiative = { mod: int(am[2]), score: Number(am[3]) };
  const hp = ls[i++].match(/^HP (\d+) \((\d+d\d+(?: [+−-] \d+)?)\)$/);
  if (!hp) throw new Error(`${block.name}: HP line "${ls[i - 1]}"`);
  h.hp = { average: Number(hp[1]), formula: hp[2].replace("−", "-") };
  // Speed may wrap; it runs until the "MOD SAVE" line.
  let speed = "";
  while (!/^MOD SAVE/.test(ls[i])) speed += ` ${ls[i++]}`;
  speed = speed.trim().replace(/^Speed /, "");
  h.speed = parseSpeed(speed, block.name);
  while (/^MOD SAVE/.test(ls[i])) i++;
  const abil = {};
  const abilRe = /(Str|Dex|Con|Int|Wis|Cha) ?(\d+) ([+−-]?\d+) ([+−-]?\d+)/g;
  let text = "";
  while (
    !KEYS.some((k) => ls[i].startsWith(`${k} `)) &&
    !/^(Traits|Actions)$/.test(ls[i])
  )
    text += ` ${ls[i++]}`;
  for (const m of text.matchAll(abilRe)) {
    const mod = int(m[3]);
    let save = int(m[4]);
    // The PDF prints one negative save without its sign (Young White Dragon, Int): repair it.
    if (!/^[+−-]/.test(m[4]) && mod < 0 && save === -mod) save = mod;
    abil[m[1].toLowerCase()] = { score: Number(m[2]), mod, save };
  }
  if (Object.keys(abil).length !== 6)
    throw new Error(`${block.name}: abilities "${text}"`);
  h.abilities = abil;
  // Keyed lines, each possibly wrapped.
  const fields = {};
  let key = null;
  for (; i < ls.length; i++) {
    const line = ls[i];
    const k = KEYS.find((x) => line.startsWith(`${x} `));
    if (k) {
      key = k;
      fields[k] = line.slice(k.length + 1);
      if (k === "CR") break;
    } else if (key) fields[key] += ` ${line}`;
  }
  if (!fields.CR) throw new Error(`${block.name}: no CR line`);
  const cm = fields.CR.match(
    /^(\S+) \((?:XP )?([\d,]+)(?: XP)?(?:, or ([\d,]+) in lair)?; PB \+(\d+)\)$/,
  );
  if (!cm) throw new Error(`${block.name}: CR line "${fields.CR}"`);
  h.cr = { rating: cm[1], xp: int(cm[2]) };
  if (cm[3]) h.cr.xpInLair = int(cm[3]);
  h.pb = Number(cm[4]);
  h.skills = {};
  if (fields.Skills) {
    for (const part of splitTop(unwrap(fields.Skills))) {
      const sk = part.match(/^(.+) ([+−-]\d+)$/);
      if (!sk) throw new Error(`${block.name}: skill "${part}"`);
      h.skills[sk[1]] = int(sk[2]);
    }
  }
  h.vulnerabilities = fields.Vulnerabilities
    ? splitTop(unwrap(fields.Vulnerabilities).replace(/;/g, ","))
    : [];
  h.resistances = fields.Resistances
    ? splitTop(unwrap(fields.Resistances).replace(/;/g, ","))
    : [];
  h.damageImmunities = [];
  h.conditionImmunities = [];
  if (fields.Immunities) {
    const [dmg, cond] = unwrap(fields.Immunities).split(/; /);
    const nonEmpty = (x) => (x ? splitTop(x) : []);
    // "Immunities Poison; Exhaustion, Charmed" lists damage then conditions. A single list is
    // damage unless every entry is a condition name.
    if (cond !== undefined) {
      h.damageImmunities = nonEmpty(dmg);
      h.conditionImmunities = nonEmpty(cond);
    } else {
      const CONDS = [
        "Blinded",
        "Charmed",
        "Deafened",
        "Exhaustion",
        "Frightened",
        "Grappled",
        "Incapacitated",
        "Invisible",
        "Paralyzed",
        "Petrified",
        "Poisoned",
        "Prone",
        "Restrained",
        "Stunned",
        "Unconscious",
      ];
      const items = nonEmpty(dmg);
      if (items.every((x) => CONDS.includes(x))) h.conditionImmunities = items;
      else h.damageImmunities = items;
    }
  }
  h.gear = fields.Gear ? splitTop(unwrap(fields.Gear)) : [];
  h.senses = parseSenses(unwrap(fields.Senses ?? ""), block.name);
  h.languages = unwrap(fields.Languages ?? "None");
  return h;
}

function parseSpeed(s, name) {
  const out = { walk: 0 };
  let hover = false;
  let rest = s;
  if (/\(hover\)/.test(rest)) {
    hover = true;
    rest = rest.replace(/ \(hover\)/, "");
  }
  for (const part of splitTop(rest)) {
    if (/ form only\)$/.test(part)) continue; // form-specific speed: not representable
    const both = part.match(/^Climb or Fly (\d+) ft\. \(GM’s choice\)$/);
    if (both) {
      out.climb = Number(both[1]);
      out.fly = Number(both[1]);
      continue;
    }
    const m = part.match(/^(?:(Burrow|Climb|Fly|Swim) )?(\d+) ft\.$/);
    if (!m) throw new Error(`${name}: speed part "${part}"`);
    if (m[1]) out[m[1].toLowerCase()] = Number(m[2]);
    else out.walk = Number(m[2]);
  }
  if (hover) out.hover = true;
  return out;
}

function parseSenses(s, name) {
  const out = { passivePerception: 0 };
  for (const part of s.replace(/, (?=Passive Perception)/, "; ").split("; ")) {
    const pp = part.match(/^Passive Perception (\d+)$/);
    if (pp) {
      out.passivePerception = Number(pp[1]);
      continue;
    }
    for (const sub of splitTop(part)) {
      const m = sub.match(
        /^(Blindsight|Darkvision|Tremorsense|Truesight) (\d+) ft\.(?: \(.*\))?$/,
      );
      if (!m) throw new Error(`${name}: sense "${sub}"`);
      out[m[1].toLowerCase()] = Number(m[2]);
    }
  }
  return out;
}

/** Legendary-action header: `{ uses, usesInLair?, text }` from the stat block text, or null. */
export function parseLegendary(block, firstActionName) {
  const i = block.lines.findIndex((l) => /^Legendary Action Uses:/.test(l));
  if (i < 0) return null;
  let j = i;
  const stop = firstActionName
    ? new RegExp(
        `^${firstActionName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[. (]`,
      )
    : null;
  const buf = [];
  for (; j < block.lines.length; j++) {
    if (j > i && stop?.test(block.lines[j])) break;
    buf.push(block.lines[j]);
  }
  const t = unwrap(buf.join("\n"));
  const m = t.match(
    /^Legendary Action Uses: (\d+)(?: \((\d+) in Lair\))?\. (.+)$/,
  );
  if (!m) throw new Error(`${block.name}: legendary header "${t}"`);
  const out = { uses: Number(m[1]), text: m[3] };
  if (m[2]) out.usesInLair = Number(m[2]);
  return out;
}
