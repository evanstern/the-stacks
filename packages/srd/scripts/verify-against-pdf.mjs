#!/usr/bin/env node
// Usage: node scripts/verify-against-pdf.mjs <path-to-SRD_CC_v5.2.1.pdf>
// Checks every shipped record against the page of the official PDF it cites and writes
// provenance/verification.json. Exit status 1 when any record has ok:false. Dev-time only.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { lines as cleanLines } from "./lib/equipment.mjs";
import { monsterBlocks } from "./lib/monsters.mjs";
import {
  assertPdf,
  loadPages,
  norm,
  normalizeName,
  PDF_SHA256,
} from "./lib/pdf.mjs";

const pkg = join(dirname(fileURLToPath(import.meta.url)), "..");
const pdf = process.argv[2];
if (!pdf) {
  console.error("usage: verify-against-pdf.mjs <pdf>");
  process.exit(2);
}
assertPdf(pdf);
const raw = loadPages(pdf, "raw");
const read = (f) => JSON.parse(readFileSync(join(pkg, f), "utf8"));
const index = read("provenance/srd-5.2.1-index.json");

const pageText = (p) =>
  norm(
    cleanLines(raw, p, p)
      .map((l) => l.text)
      .join("\n"),
  );
const pageCache = new Map();
const page = (p) => {
  if (!pageCache.has(p)) pageCache.set(p, pageText(p));
  return pageCache.get(p);
};
const rangeText = (a, b) => {
  const parts = [];
  for (let p = a; p <= b; p++)
    parts.push(
      cleanLines(raw, p, p)
        .map((l) => l.text)
        .join("\n"),
    );
  return norm(parts.join("\n"));
};
const has = (hay, needle) => hay.includes(norm(String(needle)));
/** Every number the dataset text states must also appear in the cited PDF text. */
const numbersMissing = (text, hay) => {
  const seen = new Set(hay.match(/\d[\d,]*/g) ?? []);
  return [...new Set(text.match(/\d[\d,]*/g) ?? [])].filter(
    (n) => !seen.has(n.replace(/,$/, "")) && !seen.has(n),
  );
};

const out = [];
const add = (kind, rec, missing) =>
  out.push({
    kind,
    id: rec.id,
    page: rec.source.page,
    ok: missing.length === 0,
    missing,
  });

// ---- monsters
const blocks = new Map(monsterBlocks(raw).map((b) => [b.name, b]));
const thousands = (n) => n.toLocaleString("en-US");
for (const m of read("data/monster.json")) {
  const miss = [];
  const b = blocks.get(m.name);
  if (!b || b.page !== m.source.page)
    miss.push(`stat block "${m.name}" not on page ${m.source.page}`);
  const t = norm(b ? b.lines.join("\n") : "");
  const need = (label, s) => {
    if (!has(t, s)) miss.push(`${label}: ${s}`);
  };
  need("AC", `AC ${m.ac}`);
  need("HP", `HP ${m.hp.average} (${m.hp.formula})`);
  need("CR", `CR ${m.cr.rating} (`);
  need("XP", thousands(m.cr.xp));
  if (m.cr.xpInLair) need("lair XP", thousands(m.cr.xpInLair));
  need("PB", `PB +${m.pb}`);
  for (const f of [
    ...m.traits,
    ...m.actions,
    ...m.bonusActions,
    ...m.reactions,
    ...(m.legendaryActions?.actions ?? []),
  ]) {
    need("feature", f.name);
    if (f.attack) {
      need(
        "attack bonus",
        `Attack Roll: ${f.attack.bonus >= 0 ? "+" : ""}${f.attack.bonus}`,
      );
      for (const d of f.attack.hit)
        need(
          "damage",
          d.dice
            ? `${d.average} (${d.dice}) ${d.type}`
            : `${d.average} ${d.type}`,
        );
    }
    if (f.save) need("save DC", `DC ${f.save.dc}`);
    for (const n of numbersMissing(f.text, t))
      miss.push(`number in "${f.name}": ${n}`);
  }
  add("monster", m, miss);
}

// ---- spells
const SCH = (s) => norm(s);
for (const s of read("data/spell.json")) {
  const miss = [];
  const ls = cleanLines(
    raw,
    s.source.page,
    Math.min(s.source.page + 1, 364),
  ).map((l) => l.text);
  const at = ls.findIndex((l) => normalizeName(l) === normalizeName(s.name));
  if (at < 0) miss.push(`name "${s.name}" not on page ${s.source.page}`);
  const win = norm(ls.slice(Math.max(at, 0), Math.max(at, 0) + 14).join("\n"));
  const header =
    s.level === 0
      ? `${SCH(s.school)} cantrip (`
      : `level ${s.level} ${SCH(s.school)} (`;
  if (!has(win, header)) miss.push(`header: ${header}`);
  const list = win.match(/\(([^)]*)\)/)?.[1] ?? "";
  const classes = list.split(",").map((c) => c.trim().replace(/ /g, "-"));
  if (classes.join(",") !== s.classes.join(","))
    miss.push(`classes: page "${list}" vs ${s.classes.join(",")}`);
  for (const [label, v] of [
    ["Range", s.range],
    ["Duration", s.duration],
  ])
    if (!has(win, `${label}: ${v}`)) miss.push(`${label}: ${v}`);
  if (!has(win, `casting time: ${s.castingTime}`))
    miss.push(`casting time: ${s.castingTime}`);
  if (s.reactionTrigger && !has(win, s.reactionTrigger))
    miss.push(`trigger: ${s.reactionTrigger}`);
  if (s.ritual && !has(win, "or ritual")) miss.push("ritual");
  const span = rangeText(s.source.page, Math.min(s.source.page + 1, 175));
  for (const m of `${s.text} ${s.higherLevels ?? ""}`.matchAll(/\b\d+d\d+\b/g))
    if (!has(span, m[0])) miss.push(`dice in text: ${m[0]}`);
  for (const n of numbersMissing(`${s.text} ${s.higherLevels ?? ""}`, span))
    miss.push(`number in text: ${n}`);
  add("spell", s, miss);
}

// ---- classes
const classEntries = index.kinds.class;
classEntries.forEach((e, i) => {
  e.last = i + 1 < classEntries.length ? classEntries[i + 1].page + 1 : 82;
});
const SAVE = {
  str: "strength",
  dex: "dexterity",
  con: "constitution",
  int: "intelligence",
  wis: "wisdom",
  cha: "charisma",
};
for (const c of read("data/class.json")) {
  const miss = [];
  const e = classEntries.find((x) => x.name === c.name);
  const t = rangeText(e.page, e.last);
  const need = (label, s) => {
    if (!has(t, s)) miss.push(`${label}: ${s}`);
  };
  need("hit die", `Hit Point Die ${c.hitDie.toUpperCase()}`);
  need(
    "saves",
    `Saving Throw Proficiencies ${c.savingThrows.map((x) => SAVE[x]).join(" and ")}`,
  );
  need("primary ability", `Primary Ability ${c.primaryAbility}`);
  need("skills", `Choose ${c.skillChoices.count}`);
  if (c.skillChoices.from.length < 18)
    for (const sk of c.skillChoices.from) need("skill", sk);
  need(
    "subclass",
    `${c.name} Subclass: ${c.subclass.name}`.replace(
      / Subclass: /,
      " subclass: ",
    ),
  );
  for (const f of [...c.features, ...c.subclass.features])
    need("feature", f.name);
  for (const lv of c.levels)
    for (const f of lv.features)
      need("level feature", f.replace(/ \(.*\)$/, ""));
  for (const col of Object.keys(c.levels[0].columns))
    if (!/^\d$/.test(col)) need("column", col);
  for (const f of [...c.features, ...c.subclass.features])
    for (const n of numbersMissing(f.text, t))
      miss.push(`number in "${f.name}": ${n}`);
  add("class", c, miss);
}

// ---- equipment
const money = (c) => `${thousands(c.amount)} ${c.unit.toUpperCase()}`;
for (const q of read("data/equipment.json")) {
  const miss = [];
  const t = page(q.source.page);
  const base =
    q.name.includes(", ") &&
    /^(Gaming Set|Musical Instrument|Arcane Focus|Druidic Focus|Holy Symbol)/.test(
      q.name,
    )
      ? q.name.split(", ")[1]
      : q.name;
  const label = q.name.replace(/^Saddle \((.+)\)$/, "$1");
  if (!has(t, base) && !has(t, label)) miss.push(`name: ${q.name}`);
  const costStr = money(q.cost);
  if (!has(t, costStr)) miss.push(`cost: ${costStr}`);
  if (q.category === "weapon") {
    const d = q.damage.dice ?? String(q.damage.average);
    if (!has(t, `${q.name} ${d} ${q.damage.type}`))
      miss.push(`damage: ${d} ${q.damage.type}`);
    if (!has(t, `${q.mastery}`)) miss.push(`mastery: ${q.mastery}`);
  }
  if (q.category === "armor") {
    const ac = "base" in q.ac ? `${q.ac.base}` : `+${q.ac.bonus}`;
    if (!has(t, `${q.name} ${ac}`)) miss.push(`ac: ${ac}`);
  }
  add("equipment", q, miss);
}

// ---- conditions
for (const c of read("data/condition.json")) {
  const miss = [];
  if (!has(page(c.source.page), `${c.name} [Condition]`))
    miss.push(`heading: ${c.name} [Condition]`);
  add("condition", c, miss);
}

const bad = out.filter((r) => !r.ok);
writeFileSync(
  join(pkg, "provenance", "verification.json"),
  `${JSON.stringify({ pdfSha256: PDF_SHA256, records: out }, null, 1)}\n`,
);
console.log(`${out.length} records checked, ${bad.length} mismatched`);
for (const r of bad.slice(0, 60))
  console.log(
    `  ${r.kind}/${r.id} p.${r.page}: ${r.missing.slice(0, 4).join(" | ")}`,
  );
process.exit(bad.length ? 1 : 0);
