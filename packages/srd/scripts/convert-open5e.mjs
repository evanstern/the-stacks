#!/usr/bin/env node
// Usage: node scripts/convert-open5e.mjs <open5e-api-checkout> <commit-sha> <pdf>
// Build first: `pnpm --filter @the-stacks/srd build` (the script validates with dist/schema).
//
// Joins the Open5e `srd-2024` document (data/v2/wizards-of-the-coast/srd-2024/ only) into our record
// shapes and writes data/*.json and provenance/source.json. The SRD 5.2.1 PDF is read for the parts
// the dataset lacks or gets wrong; see specs/027-srd-data/tasks.md "Deviations". Dev-time only.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { lines, parseEquipment } from "./lib/equipment.mjs";
import { monsterBlocks, parseHeader, parseLegendary } from "./lib/monsters.mjs";
import {
  assertPdf,
  loadPages,
  nameKey,
  norm,
  normalizeName,
  slug,
  unwrap,
} from "./lib/pdf.mjs";
import { mdToText } from "./lib/text.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const pkg = join(here, "..");
const [checkout, commit, pdf] = process.argv.slice(2);
if (!checkout || !commit || !pdf) {
  console.error(
    "usage: convert-open5e.mjs <open5e-api-checkout> <commit-sha> <pdf>",
  );
  process.exit(2);
}
const head = execFileSync("git", ["-C", checkout, "rev-parse", "HEAD"], {
  encoding: "utf8",
}).trim();
if (head !== commit)
  throw new Error(`checkout is at ${head}, expected ${commit}`);
assertPdf(pdf);

const { RecordSchemas } = await import(
  pathToFileURL(join(pkg, "dist", "schema", "index.js")).href
);

const DIR = "data/v2/wizards-of-the-coast/srd-2024";
const load = (f) =>
  JSON.parse(readFileSync(join(checkout, DIR, `${f}.json`), "utf8"));
const doc = load("Document")[0];
if (doc.pk !== "srd-2024" || !doc.fields.licenses.includes("cc-by-40")) {
  throw new Error("unexpected Document.json: license is not cc-by-40");
}
const index = JSON.parse(
  readFileSync(join(pkg, "provenance", "srd-5.2.1-index.json"), "utf8"),
);
const raw = loadPages(pdf, "raw");

const problems = [];
const notes = { datasetDisagreements: [], repairs: [] };
const fail = (m) => problems.push(m);

const SOURCE = (section, page) => ({ document: "SRD 5.2.1", section, page });
const byKey = (rows, nameOf) =>
  new Map(rows.map((r) => [nameKey(nameOf(r)), r]));

// ------------------------------------------------------------------ monsters
const DAMAGE_TYPES = [
  "Acid",
  "Bludgeoning",
  "Cold",
  "Fire",
  "Force",
  "Lightning",
  "Necrotic",
  "Piercing",
  "Poison",
  "Psychic",
  "Radiant",
  "Slashing",
  "Thunder",
];
const ABILITY = {
  Strength: "str",
  Dexterity: "dex",
  Constitution: "con",
  Intelligence: "int",
  Wisdom: "wis",
  Charisma: "cha",
};

function parseAttack(text, where) {
  const lead = text.match(
    /^(Melee or Ranged|Melee|Ranged) Attack Roll: ([+-]\d+)(?: to hit)?(?: \([^)]*\))?, (.+?)\. (?:Hit: )?(?=\d|[A-Z])/,
  );
  if (!lead) {
    fail(`${where}: attack lead not understood: ${text.slice(0, 120)}`);
    return undefined;
  }
  const [whole, kind, bonus, reachRange] = lead;
  const atk = {
    type:
      kind === "Melee"
        ? "melee"
        : kind === "Ranged"
          ? "ranged"
          : "melee-or-ranged",
    bonus: Number(bonus),
  };
  const reach = reachRange.match(/reach (\d+) (?:ft|feet)\b/);
  if (reach) atk.reach = Number(reach[1]);
  const range = reachRange.match(/range (\d+)(?:\/(\d+))? (?:ft|feet)\b/);
  if (range)
    atk.range = range[2]
      ? { normal: Number(range[1]), long: Number(range[2]) }
      : { normal: Number(range[1]) };
  if (!reach && !range) fail(`${where}: no reach or range: ${reachRange}`);
  const rest = text.slice(whole.length);
  const dmgRe = new RegExp(
    `(\\d+)(?: \\((\\d+d\\d+(?: [+-] \\d+)?)\\))? (${DAMAGE_TYPES.join("|")}) damage(?: (if [^.]*?))?(?=[.,]| plus|$)`,
    "g",
  );
  // Damage clauses live in the first sentence only.
  const firstEnd = rest.search(/\.(?:\s|$)/);
  const sentence = firstEnd < 0 ? rest : rest.slice(0, firstEnd + 1);
  const hit = [];
  let last = 0;
  for (const m of sentence.matchAll(dmgRe)) {
    const part = { average: Number(m[1]), dice: m[2] ?? null, type: m[3] };
    if (m[4]) part.condition = m[4];
    hit.push(part);
    last = m.index + m[0].length;
  }
  if (hit.length === 0 && /\d+ (?:\([^)]*\) )?\w+ damage/.test(sentence))
    fail(`${where}: no damage parsed: ${rest.slice(0, 120)}`);
  atk.hit = hit;
  const tail = (sentence.slice(last) + rest.slice(sentence.length))
    .replace(/^[\s.,]+/, "")
    .replace(/^(and|plus)\s+(?=the )/, "$1 ");
  if (tail.trim()) atk.hitText = tail.trim();
  return atk;
}

function parseSave(text, where) {
  const m = text.match(
    /(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma) Saving Throw: DC (\d+)/,
  );
  if (!m) {
    fail(`${where}: save not understood: ${text.slice(0, 120)}`);
    return undefined;
  }
  const save = { ability: ABILITY[m[1]], dc: Number(m[2]) };
  const fail1 = text.match(
    /Failure: (.*?)(?= Success:| Failure or Success:|$)/,
  );
  const ok = text.match(/Success: (.*?)(?= Failure or Success:|$)/);
  if (fail1) save.onFail = fail1[1].trim();
  if (ok) save.onSuccess = ok[1].trim();
  return save;
}

const DICE_NUM = /\d+ \(\d+d\d+(?: [+-] \d+)?\)/g;
const has = (hay, needle) => hay.includes(norm(needle));

/** True when every number the dataset text states (damage, attack bonus, DC) appears in the PDF block. */
function numbersOk(text, blockNorm) {
  for (const m of text.matchAll(DICE_NUM))
    if (!has(blockNorm, m[0])) return false;
  for (const m of text.matchAll(/Attack Roll: ([+-]\d+)/g))
    if (!has(blockNorm, `Attack Roll: ${m[1]}`)) return false;
  for (const m of text.matchAll(/DC (\d+)/g))
    if (!has(blockNorm, `DC ${m[1]}`)) return false;
  return true;
}

function nameFromPk(pk, parentPk) {
  const suffix = pk.slice(parentPk.length + 1);
  return suffix
    ? suffix
        .split("-")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ")
    : null;
}

/** The feature's text as the PDF prints it, found by name inside the stat block. */
function pdfFeatureText(block, name, allNames) {
  const esc = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const start = new RegExp(`^${esc(name)}(?: \\([^)]*\\))?\\. (.*)$`);
  const stops = new RegExp(
    `^(?:${allNames
      .filter((n) => n !== name)
      .map(esc)
      .join(
        "|",
      )})(?: \\([^)]*\\))?\\. |^(?:Traits|Actions|Bonus Actions|Reactions|Legendary Actions)$`,
  );
  const i = block.lines.findIndex((l) => start.test(l));
  if (i < 0) return null;
  const buf = [block.lines[i].match(start)[1]];
  for (
    let j = i + 1;
    j < block.lines.length && !stops.test(block.lines[j]);
    j++
  )
    buf.push(block.lines[j]);
  return unwrap(buf.join("\n"))
    .replace(/^Hit: /, "")
    .replace(/\. Hit: /, ". ");
}

function feature(row, kindLabel, ctx) {
  const f = row.fields;
  const nm = f.name.match(/^(.*?) \((.+)\)$/);
  let name = (nm ? nm[1] : f.name).trim();
  if (ctx && !has(ctx.blockNorm, name)) {
    const alt = nameFromPk(row.pk, ctx.parentPk);
    if (alt && has(ctx.blockNorm, alt)) {
      notes.repairs.push(
        `${ctx.monster}: feature "${name}" renamed to "${alt}" (dataset name absent from the PDF block)`,
      );
      name = alt;
    }
  }
  let text = mdToText(f.desc);
  if (ctx && !numbersOk(text, ctx.blockNorm)) {
    const fromPdf = pdfFeatureText(ctx.block, name, ctx.names);
    if (fromPdf && numbersOk(fromPdf, ctx.blockNorm)) {
      notes.repairs.push(
        `${ctx.monster}: "${name}" text taken from the PDF (dataset numbers differ)`,
      );
      text = fromPdf;
    }
  }
  const usageParts = [];
  if (nm) usageParts.push(nm[2].replace(/(\d)-(\d)/, "$1–$2"));
  else if (f.uses_type === "PER_DAY" && f.uses_param)
    usageParts.push(`${f.uses_param}/Day`);
  else if (
    (f.uses_type === "RECHARGE" || f.uses_type === "RECHARGE_ON_ROLL") &&
    f.uses_param
  )
    usageParts.push(`Recharge ${f.uses_param}–6`);
  if (f.limited_to_form) usageParts.push(f.limited_to_form);
  const out = { name, text };
  if (usageParts.length) out.usage = usageParts.join("; ");
  const where = `${row.pk} (${kindLabel})`;
  if (/Attack Roll:/.test(text)) {
    const a = parseAttack(text, where);
    if (a) out.attack = a;
  }
  if (/Saving Throw: DC/.test(text)) {
    const s = parseSave(text, where);
    if (s) out.save = s;
  }
  return out;
}

function monsters() {
  const creatures = byKey(load("Creature"), (r) => r.fields.name);
  const actions = load("CreatureAction");
  const traits = load("CreatureTrait");
  const blocks = new Map(monsterBlocks(raw).map((b) => [b.name, b]));
  const out = [];
  for (const entry of index.kinds.monster) {
    const row = creatures.get(nameKey(entry.name));
    if (!row) {
      fail(`monster ${entry.name}: not in dataset`);
      continue;
    }
    const block = blocks.get(entry.name);
    if (!block) {
      fail(`monster ${entry.name}: stat block not found in PDF`);
      continue;
    }
    const h = parseHeader(block);
    if (h.page !== entry.page && !entry.embedded)
      fail(
        `monster ${entry.name}: PDF block on p.${h.page}, index p.${entry.page}`,
      );
    const f = row.fields;
    if (f.armor_class !== h.ac || f.hit_points !== h.hp.average) {
      notes.datasetDisagreements.push(
        `${entry.name}: dataset AC ${f.armor_class} HP ${f.hit_points}; PDF AC ${h.ac} HP ${h.hp.average}`,
      );
    }
    const mine = (x) => x.fields.parent === row.pk;
    const act = actions.filter(mine);
    const myTraits = traits.filter(mine);
    const baseNameOf = (r) => r.fields.name.replace(/ \(.+\)$/, "");
    const ctx = {
      monster: entry.name,
      block,
      blockNorm: norm(block.lines.join("\n")),
      parentPk: row.pk,
      names: [...act, ...myTraits].map((r) =>
        nameFromPk(r.pk, row.pk) &&
        has(norm(block.lines.join("\n")), baseNameOf(r))
          ? baseNameOf(r)
          : (nameFromPk(r.pk, row.pk) ?? baseNameOf(r)),
      ),
    };
    const ofType = (t) =>
      act
        .filter((a) => a.fields.action_type === t)
        .map((a, i) => ({ a, i }))
        .sort(
          (x, y) =>
            (x.a.fields.order_in_statblock ?? 0) -
              (y.a.fields.order_in_statblock ?? 0) || x.i - y.i,
        )
        .map(({ a }) => feature(a, t, ctx));
    const legendaryList = ofType("LEGENDARY_ACTION");
    const rec = {
      id: nameKey(entry.name) && slug(entry.name),
      name: entry.name,
      source: SOURCE(
        entry.embedded ?? (entry.page >= 344 ? "Animals" : "Monsters A–Z"),
        entry.page,
      ),
      size: h.size,
      type: h.type,
      tags: h.tags,
      alignment: h.alignment,
      ac: h.ac,
      initiative: h.initiative,
      hp: h.hp,
      speed: h.speed,
      abilities: h.abilities,
      skills: h.skills,
      damageVulnerabilities: h.vulnerabilities,
      damageResistances: h.resistances,
      damageImmunities: h.damageImmunities,
      conditionImmunities: h.conditionImmunities,
      gear: h.gear,
      senses: h.senses,
      languages: h.languages,
      cr: h.cr,
      pb: h.pb,
      traits: myTraits.map((t) => feature(t, "trait", ctx)),
      actions: ofType("ACTION"),
      bonusActions: ofType("BONUS_ACTION"),
      reactions: ofType("REACTION"),
    };
    const header = parseLegendary(block, legendaryList[0]?.name);
    if (legendaryList.length && !header)
      fail(`monster ${entry.name}: legendary actions without a PDF header`);
    if (!legendaryList.length && header)
      fail(
        `monster ${entry.name}: PDF legendary header without dataset actions`,
      );
    if (header) rec.legendaryActions = { ...header, actions: legendaryList };
    out.push(rec);
  }
  return out;
}

// ------------------------------------------------------------------ spells
/** Spell header fields exactly as the PDF prints them. */
function spellHeader(entry) {
  // A header can run onto the next page (Arcanist’s Magic Aura, Vicious Mockery).
  const ls = lines(raw, entry.page, Math.min(entry.page + 1, 364)).map(
    (l) => l.text,
  );
  const at = ls.findIndex(
    (l) => normalizeName(l) === normalizeName(entry.name),
  );
  if (at < 0)
    throw new Error(`spell ${entry.name}: title not on p.${entry.page}`);
  let i = at + 1;
  let head = "";
  while (i < ls.length && !ls[i].startsWith("Casting Time:"))
    head += ` ${ls[i++]}`;
  const hm = head
    .trim()
    .match(/^(?:Level (\d) ([A-Z][a-z]+)|([A-Z][a-z]+) Cantrip) \((.+)\)$/);
  if (!hm) throw new Error(`spell ${entry.name}: header "${head.trim()}"`);
  const take = (label) => {
    // The PDF prints "Component:" for Barkskin.
    const re = new RegExp(`^${label}s?: `);
    const lm = ls[i]?.match(label === "Components" ? /^Components?: / : re);
    if (!lm)
      throw new Error(`spell ${entry.name}: expected ${label}, got "${ls[i]}"`);
    let t = ls[i++].slice(lm[0].length);
    while (
      i < ls.length &&
      !/^(Casting Time|Range|Components?|Duration): /.test(ls[i]) &&
      label !== "Duration"
    )
      t += `\n${ls[i++]}`;
    return unwrap(t);
  };
  const casting = take("Casting Time");
  const range = take("Range");
  const components = take("Components");
  const duration = take("Duration");
  return {
    level: hm[1] ? Number(hm[1]) : 0,
    school: hm[2] ?? hm[3],
    classes: hm[4].split(", ").map((c) => slug(c)),
    casting,
    range,
    components,
    duration,
  };
}

function spells(classIds) {
  const rows = byKey(load("Spell"), (r) => r.fields.name);
  const out = [];
  for (const entry of index.kinds.spell) {
    const row = rows.get(nameKey(entry.name));
    if (!row) {
      fail(`spell ${entry.name}: not in dataset`);
      continue;
    }
    const f = row.fields;
    const h = spellHeader(entry);
    if (h.level !== f.level || h.school.toLowerCase() !== f.school)
      notes.datasetDisagreements.push(
        `${entry.name}: dataset level ${f.level} ${f.school}; PDF level ${h.level} ${h.school}`,
      );
    for (const c of h.classes)
      if (!classIds.has(c)) fail(`spell ${entry.name}: unknown class ${c}`);
    const ritual = / or Ritual$/.test(h.casting);
    const trigger = h.casting.match(/^(Reaction|Bonus Action), (which .+)$/);
    const castingTime = trigger
      ? trigger[1]
      : h.casting.replace(/ or Ritual$/, "");
    const headC = h.components.split(" (")[0];
    const material = h.components.match(/M \((.+)\)$/)?.[1];
    const rec = {
      id: slug(entry.name),
      name: entry.name,
      source: SOURCE("Spell Descriptions", entry.page),
      level: h.level,
      school: h.school,
      classes: h.classes,
      castingTime,
      ritual,
      ...(trigger ? { reactionTrigger: trigger[2] } : {}),
      range: h.range,
      components: {
        v: /\bV\b/.test(headC),
        s: /\bS\b/.test(headC),
        m: /\bM\b/.test(headC),
        ...(material ? { material } : {}),
      },
      concentration: /^Concentration/.test(h.duration),
      duration: h.duration,
      text: mdToText(f.desc),
      ...(f.higher_level ? { higherLevels: mdToText(f.higher_level) } : {}),
    };
    out.push(rec);
  }
  return out;
}

// ------------------------------------------------------------------ classes
const SKILLS = [
  "Acrobatics",
  "Animal Handling",
  "Arcana",
  "Athletics",
  "Deception",
  "History",
  "Insight",
  "Intimidation",
  "Investigation",
  "Medicine",
  "Nature",
  "Perception",
  "Performance",
  "Persuasion",
  "Religion",
  "Sleight of Hand",
  "Stealth",
  "Survival",
];
const SKILL_BY_KEY = new Map(SKILLS.map((s) => [nameKey(s), s]));
const ABILITY_LONG = {
  Strength: "str",
  Dexterity: "dex",
  Constitution: "con",
  Intelligence: "int",
  Wisdom: "wis",
  Charisma: "cha",
};
// Dataset column names that differ from the printed class-table headers (checked against the PDF).
const NAME_FIX = {
  "Unarmoed Movement": "Unarmored Movement",
  "Improved Brutal Strike (Enhanced)": "Improved Brutal Strike",
  "Cleric Subclasses": "Cleric Subclass",
  "Studdied Attacks": "Studied Attacks",
  "Magic Cunning": "Magical Cunning",
};
const COLUMN_FIX = {
  "srd-2024_druid_wild-shape-uses": "Wild Shape",
  "srd-2024_monk_unarmored-movement": "Unarmored Movement",
  "srd-2024_monk_unarmored-movement-column": "Unarmored Movement",
};

function coreTraits(desc, where) {
  const t = {};
  for (const line of desc.split("\n")) {
    const m = line.match(/^\|([^|]+)\|(.*)\|$/);
    if (m && !/^-+$/.test(m[1].trim()) && m[1].trim())
      t[m[1].trim()] = m[2].trim();
  }
  for (const k of [
    "Primary Ability",
    "Hit Point Die",
    "Saving Throw Proficiencies",
    "Skill Proficiencies",
    "Weapon Proficiencies",
    "Armor Training",
    "Starting Equipment",
  ]) {
    if (!t[k]) fail(`${where}: core traits missing "${k}"`);
  }
  return t;
}

function classes() {
  const chars = load("CharacterClass");
  const feats = load("ClassFeature");
  const items = load("ClassFeatureItem");
  const out = [];
  const featsOf = (parentPk) =>
    feats.filter((f) => f.fields.parent === parentPk);
  const itemsOf = (featPk) => items.filter((i) => i.fields.parent === featPk);
  for (const entry of index.kinds.class) {
    const cls = chars.find(
      (c) => c.fields.name === entry.name && !c.fields.subclass_of,
    );
    const sub = chars.find((c) => c.fields.subclass_of === cls?.pk);
    if (!cls || !sub) {
      fail(`class ${entry.name}: not in dataset`);
      continue;
    }
    if (normalizeName(sub.fields.name) !== normalizeName(entry.subclass.name))
      fail(
        `class ${entry.name}: subclass ${sub.fields.name} vs PDF ${entry.subclass.name}`,
      );
    const where = `class ${entry.name}`;
    const core = featsOf(cls.pk).find((f) => f.pk.endsWith("_core-traits"));
    const ct = coreTraits(core.fields.desc, where);
    const skillText = ct["Skill Proficiencies"];
    let skillChoices;
    const cm = skillText.match(/^Choose (\d+): (.+)$/);
    if (cm) {
      const from = cm[2]
        .replace(/, or /, ", ")
        .replace(/ or /, ", ")
        .split(", ")
        .map((s) => {
          const canon = SKILL_BY_KEY.get(nameKey(s));
          if (!canon) fail(`${where}: unknown skill "${s}"`);
          return canon ?? s;
        });
      skillChoices = { count: Number(cm[1]), from };
    } else if (/^Choose any (\d+) skills$/.test(skillText)) {
      skillChoices = {
        count: Number(skillText.match(/(\d+)/)[1]),
        from: SKILLS,
      };
    } else fail(`${where}: skill text "${skillText}"`);
    const saves = ct["Saving Throw Proficiencies"]
      .split(" and ")
      .map((s) => ABILITY_LONG[s.trim()]);
    const list = (s) => (!s || s === "None" ? [] : [s]);
    // class table columns and per-level features
    const levels = Array.from({ length: 20 }, (_, i) => ({
      level: i + 1,
      proficiencyBonus: 0,
      features: [],
      columns: {},
    }));
    const classFeatures = [];
    const columnFeats = [];
    for (const f of featsOf(cls.pk)) {
      if (f.pk.endsWith("_core-traits")) continue;
      const its = itemsOf(f.pk);
      const colItems = its.filter((i) => i.fields.column_value != null);
      const plain = its.filter((i) => i.fields.column_value == null);
      if (colItems.length) columnFeats.push({ f, its: colItems });
      if (colItems.length && !plain.length) continue;
      const name = NAME_FIX[f.fields.name] ?? f.fields.name;
      const minLevel = plain.length
        ? Math.min(...plain.map((i) => i.fields.level))
        : 1;
      classFeatures.push({
        name,
        level: minLevel,
        text: mdToText(f.fields.desc),
      });
      for (const it of plain) {
        levels[it.fields.level - 1].features.push(
          it.fields.detail ? `${name} (${it.fields.detail})` : name,
        );
      }
    }
    for (const { f, its } of columnFeats) {
      if (f.pk.endsWith("_proficiency-bonus")) {
        for (const it of its)
          levels[it.fields.level - 1].proficiencyBonus = Number(
            it.fields.column_value.replace("+", ""),
          );
        continue;
      }
      let name = COLUMN_FIX[f.pk] ?? NAME_FIX[f.fields.name] ?? f.fields.name;
      const slot = name.match(/^(\d)(?:st|nd|rd|th)$/);
      if (slot) name = slot[1];
      for (const it of its)
        levels[it.fields.level - 1].columns[name] = it.fields.column_value;
      for (const lv of levels)
        if (!(name in lv.columns)) lv.columns[name] = "—";
    }
    for (const lv of levels) {
      if (!lv.proficiencyBonus)
        fail(`${where}: level ${lv.level} has no proficiency bonus`);
      const keys = Object.keys(lv.columns);
      const sorted = {};
      for (const k of [
        ...keys.filter((x) => !/^\d$/.test(x)),
        ...keys.filter((x) => /^\d$/.test(x)).sort(),
      ])
        sorted[k] = lv.columns[k];
      lv.columns = sorted;
    }
    const spellFeat = classFeatures
      .map((c) => c.text)
      .join("\n")
      .match(
        /(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma) is (?:your|the) spellcasting ability/,
      );
    const subFeatures = featsOf(sub.pk).map((f) => {
      const its = itemsOf(f.pk);
      return {
        name: NAME_FIX[f.fields.name] ?? f.fields.name,
        level: its.length ? Math.min(...its.map((i) => i.fields.level)) : 3,
        text: mdToText(f.fields.desc),
      };
    });
    out.push({
      id: slug(entry.name),
      name: entry.name,
      source: SOURCE(entry.name, entry.page),
      hitDie: cls.fields.hit_dice.toLowerCase(),
      primaryAbility: ct["Primary Ability"],
      savingThrows: saves,
      skillChoices,
      weaponProficiencies: list(ct["Weapon Proficiencies"]),
      armorTraining: list(ct["Armor Training"]),
      toolProficiencies: list(ct["Tool Proficiencies"]),
      startingEquipment: ct["Starting Equipment"],
      ...(spellFeat ? { spellcastingAbility: ABILITY_LONG[spellFeat[1]] } : {}),
      levels,
      features: classFeatures,
      subclass: {
        id: slug(sub.fields.name),
        name: sub.fields.name,
        text: mdToText(sub.fields.desc),
        features: subFeatures,
      },
    });
  }
  return out;
}

// ------------------------------------------------------------------ conditions
function conditions() {
  const rows = byKey(load("ConditionDescription"), (r) => r.fields.describes);
  const out = [];
  for (const entry of index.kinds.condition) {
    const row = rows.get(nameKey(entry.name));
    if (!row) {
      fail(`condition ${entry.name}: not in dataset`);
      continue;
    }
    const lines = mdToText(row.fields.desc).split("\n").filter(Boolean);
    const lead = lines.filter((l) => !l.startsWith("- "));
    const effects = lines
      .filter((l) => l.startsWith("- "))
      .map((l) => {
        const m = l.slice(2).match(/^(.+?)\. (.+)$/s);
        if (!m)
          fail(
            `condition ${entry.name}: effect not understood: ${l.slice(0, 80)}`,
          );
        return { name: m?.[1] ?? l, text: m?.[2] ?? l };
      });
    out.push({
      id: slug(entry.name),
      name: entry.name,
      source: SOURCE("Rules Glossary", entry.page),
      text: lead.join("\n\n"),
      effects,
    });
  }
  return out;
}

// ------------------------------------------------------------------ equipment
function equipment() {
  const bySection = (r) => {
    if (r.category === "weapon") return "Weapons";
    if (r.category === "armor") return "Armor";
    if (r.category === "tool") return "Tools";
    if (r.category === "adventuring-gear") return "Adventuring Gear";
    return "Mounts and Vehicles";
  };
  const items = parseEquipment(raw);
  const out = [];
  for (const entry of index.kinds.equipment) {
    const r = items.find((i) => i.name === entry.name);
    if (!r) {
      fail(`equipment ${entry.name}: not in the PDF tables`);
      continue;
    }
    const { name, page, ...rest } = r;
    out.push({
      id: slug(name),
      name,
      source: SOURCE(bySection(r), page),
      ...rest,
    });
  }
  return out;
}

// ------------------------------------------------------------------ run
const klass = classes();
const result = {
  monster: monsters(),
  spell: spells(new Set(klass.map((c) => c.id))),
  class: klass,
  equipment: equipment(),
  condition: conditions(),
};

for (const [kind, recs] of Object.entries(result)) {
  const ids = new Set();
  for (const rec of recs) {
    if (ids.has(rec.id)) fail(`${kind}: duplicate id ${rec.id}`);
    ids.add(rec.id);
    const parsed = RecordSchemas[kind].safeParse(rec);
    if (!parsed.success)
      fail(
        `${kind} ${rec.id}: ${parsed.error.issues
          .slice(0, 3)
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join("; ")}`,
      );
  }
  if (recs.length !== index.kinds[kind].length)
    fail(
      `${kind}: ${recs.length} records, index has ${index.kinds[kind].length}`,
    );
}

if (problems.length) {
  console.error(`${problems.length} problem(s):`);
  for (const p of problems.slice(0, 80)) console.error(`  - ${p}`);
  process.exit(1);
}

for (const [kind, recs] of Object.entries(result)) {
  writeFileSync(
    join(pkg, "data", `${kind}.json`),
    `${JSON.stringify(recs, null, 2)}\n`,
  );
  console.log(kind, recs.length);
}
writeFileSync(
  join(pkg, "provenance", "source.json"),
  `${JSON.stringify(
    {
      upstream: {
        name: "Open5e",
        repository: "https://github.com/open5e/open5e-api",
        branch: "staging",
        commit,
        directory: DIR,
        document: doc.fields.name,
        license: "CC-BY-4.0",
        licenseAsDeclared: doc.fields.licenses,
      },
      pdf: {
        url: "https://media.dndbeyond.com/compendium-images/srd/5.2/SRD_CC_v5.2.1.pdf",
        sha256: index.pdfSha256,
      },
      usedFor: {
        monster:
          "traits and actions from the dataset; header lines, XP, proficiency bonus and legendary-action text from the PDF",
        spell: "dataset",
        class: "dataset",
        condition: "dataset",
        equipment:
          "PDF tables and entries (the dataset's descriptions for equipment are not SRD text)",
      },
      converter: "scripts/convert-open5e.mjs v1",
      convertedAt: new Date().toISOString().slice(0, 10),
      datasetDisagreements: notes.datasetDisagreements,
      repairs: notes.repairs,
    },
    null,
    2,
  )}\n`,
);
console.log(
  "dataset disagreements:",
  notes.datasetDisagreements.length,
  "repairs:",
  notes.repairs.length,
);
for (const r of notes.repairs) console.log("  repair:", r);
