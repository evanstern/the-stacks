// Parses the SRD 5.2.1 Equipment chapter (PDF pages 89-103) into equipment records.
// Source text comes from `pdftotext -raw`. Used by extract-index.mjs (names, pages) and
// convert-open5e.mjs (full records). Dev-time only.
import { slug, unwrap } from "./pdf.mjs";

const HEADER_RE =
  /^(System Reference Document 5\.2\.1 \d+|\d+ System Reference Document 5\.2\.1)$/;
const COST_RE = "([\\d,]+) (CP|SP|GP|EP|PP)";
const WEIGHT_RE = "(—|[\\d½¼¾/ ]+ lb\\.(?: \\(full\\))?)";

/** Cleaned lines of pages [from, to] with the running headers removed and curly quotes kept. */
export function lines(rawPages, from, to) {
  const out = [];
  for (let p = from; p <= to; p++) {
    for (const l of rawPages[p].split("\n")) {
      const t = l.replace(/[\t\u00a0]+/g, " ").replace(/\s+$/, "");
      if (!t.trim() || HEADER_RE.test(t.trim())) continue;
      out.push({ text: t.trim(), page: p });
    }
  }
  return out;
}

export function parseCost(s) {
  const m = s.match(new RegExp(`^${COST_RE}$`));
  if (!m) throw new Error(`unparsable cost: ${s}`);
  return { amount: Number(m[1].replace(/,/g, "")), unit: m[2].toLowerCase() };
}

export function parseWeight(s) {
  const t = s
    .replace(/ \(full\)$/, "")
    .replace(/ lb\.$/, "")
    .trim();
  if (t === "—" || t === "Varies") return null;
  const mixed = t.match(/^(\d+)([½¼¾])$/);
  const frac = { "½": 0.5, "¼": 0.25, "¾": 0.75 };
  if (mixed) return Number(mixed[1]) + frac[mixed[2]];
  const fr = t.match(/^(\d+)\/(\d+)$/);
  if (fr) return Number(fr[1]) / Number(fr[2]);
  if (frac[t] !== undefined) return frac[t];
  const n = Number(t.replace(/,/g, ""));
  if (Number.isNaN(n)) throw new Error(`unparsable weight: ${s}`);
  return n;
}

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

const ABILITY = {
  Strength: "str",
  Dexterity: "dex",
  Constitution: "con",
  Intelligence: "int",
  Wisdom: "wis",
  Charisma: "cha",
};

// ---- weapons (page 91) ----
function parseWeapons(raw) {
  const ls = lines(raw, 91, 91);
  const out = [];
  let section = null;
  let buf = "";
  let started = false;
  const rowRe = new RegExp(
    `^(.+?) (\\d+(?:d\\d+)?) (Bludgeoning|Piercing|Slashing) (.+) (Cleave|Graze|Nick|Push|Sap|Slow|Topple|Vex) ${WEIGHT_RE} ${COST_RE}$`,
  );
  for (const { text, page } of ls) {
    if (/^Name Damage Properties/.test(text)) {
      started = true;
      continue;
    }
    if (!started) continue;
    if (text === "Armor") break;
    const sec = text.match(/^(Simple|Martial) (Melee|Ranged) Weapons$/);
    if (sec) {
      section = {
        weaponCategory: sec[1].toLowerCase(),
        rangeType: sec[2].toLowerCase(),
      };
      buf = "";
      continue;
    }
    buf = buf ? `${buf} ${text}` : text;
    const m = buf.match(rowRe);
    if (!m) continue;
    buf = "";
    const [, name, dmg, dtype, propsRaw, mastery, weight, cAmt, cUnit] = m;
    const props = propsRaw === "—" ? [] : splitTop(propsRaw);
    const rec = {
      name,
      page,
      category: "weapon",
      weaponCategory: section.weaponCategory,
      rangeType: section.rangeType,
      damage: dmg.includes("d")
        ? { dice: dmg, type: dtype }
        : { dice: null, average: Number(dmg), type: dtype },
      properties: [],
      mastery,
      weight: parseWeight(weight),
      cost: parseCost(`${cAmt} ${cUnit}`),
    };
    for (const p of props) {
      const pm = p.match(/^(.+?) \((.+)\)$/);
      if (!pm) {
        rec.properties.push(p);
        continue;
      }
      const [, pn, detail] = pm;
      if (pn === "Versatile") {
        rec.properties.push("Versatile");
        rec.versatile = detail;
      } else if (pn === "Thrown" || pn === "Ammunition") {
        rec.properties.push(pn);
        const rm = detail.match(/Range (\d+)\/(\d+)(?:; (.+))?/);
        if (!rm) throw new Error(`unparsable range: ${p}`);
        rec.range = { normal: Number(rm[1]), long: Number(rm[2]) };
        if (rm[3]) rec.ammunition = rm[3];
      } else {
        rec.properties.push(p);
      }
    }
    out.push(rec);
  }
  return out;
}

// ---- armor (page 92) ----
function parseArmor(raw) {
  const ls = lines(raw, 92, 92);
  const out = [];
  let started = false;
  let cat = null;
  let don = null;
  let doff = null;
  const rowRe = new RegExp(
    `^(.+?) (\\d+(?: \\+ Dex modifier(?: \\(max (\\d)\\))?)?|\\+\\d) (—|Str \\d+) (—|Disadvantage) ${WEIGHT_RE} ${COST_RE}$`,
  );
  for (const { text, page } of ls) {
    if (text === "Armor Armor Class (AC) Strength Stealth Weight Cost") {
      started = true;
      continue;
    }
    if (!started) continue;
    const sec = text.match(
      /^(Light|Medium|Heavy) Armor \((.+)\)$|^(Shield) \((.+)\)$/,
    );
    if (sec) {
      cat = (sec[1] ?? sec[3]).toLowerCase();
      const spec = sec[2] ?? sec[4];
      const sm = spec.match(/^(.+) to Don and (.+) to Doff$/);
      if (sm) {
        don = sm[1];
        doff = sm[2];
      } else {
        const same = spec.replace(/ to Don or Doff$/, "");
        don = same;
        doff = same;
      }
      continue;
    }
    const m = text.match(rowRe);
    if (!m) continue;
    const [, name, acRaw, dexMax, str, stealth, weight, cAmt, cUnit] = m;
    let ac;
    if (acRaw.startsWith("+")) ac = { bonus: Number(acRaw.slice(1)) };
    else {
      ac = { base: Number.parseInt(acRaw, 10), addDex: acRaw.includes("Dex") };
      if (dexMax) ac.dexMax = Number(dexMax);
    }
    const rec = {
      name,
      page,
      category: "armor",
      armorCategory: cat,
      ac,
      stealthDisadvantage: stealth === "Disadvantage",
      don,
      doff,
      weight: parseWeight(weight),
      cost: parseCost(`${cAmt} ${cUnit}`),
    };
    if (str !== "—") rec.strength = Number(str.replace("Str ", ""));
    out.push(rec);
  }
  return out;
}

const TOOL_HEAD = /^([A-Z].+) \(((?:[\d,]+ (?:CP|SP|GP))|Varies)\)$/;

function titleCase(s) {
  return s
    .split(" ")
    .map((w) =>
      w === "of"
        ? w
        : w.replace(/(^|-)([a-z])/g, (_, d, c) => d + c.toUpperCase()),
    )
    .join(" ");
}

// ---- tools (pages 93-94 until "Adventuring Gear") ----
function parseTools(raw) {
  const ls = lines(raw, 93, 94);
  const entries = [];
  let cur = null;
  let started = false;
  let group = "artisan";
  for (const { text, page } of ls) {
    if (text === "Artisan’s Tools") {
      started = true;
      continue;
    }
    if (!started) continue;
    if (text === "Adventuring Gear") break;
    if (text === "Other Tools") {
      group = "other";
      continue;
    }
    const h = text.match(TOOL_HEAD);
    if (h && !/^(Ability|Utilize|Craft|Variants):/.test(text)) {
      cur = { name: h[1], costRaw: h[2], page, body: [], group };
      entries.push(cur);
      continue;
    }
    if (cur) cur.body.push(text);
  }
  const out = [];
  for (const e of entries) {
    const body = e.body.join("\n");
    const am = body.match(/Ability: (\w+)\s+Weight: ([^\n]+)/);
    if (!am) throw new Error(`tool without ability line: ${e.name}`);
    const section = (label, next) => {
      const re = new RegExp(`${label}: ([\\s\\S]*?)(?=\\n(?:${next}):|$)`);
      const m = body.match(re);
      return m ? unwrap(m[1]) : null;
    };
    const utilize = section("Utilize", "Craft|Variants");
    const craftRaw = section("Craft", "Variants");
    const variantsRaw = section("Variants", "Zzz");
    const base = {
      ability: ABILITY[am[1]],
      utilize,
      ...(craftRaw ? { craft: splitTop(craftRaw) } : {}),
      category: "tool",
    };
    if (!variantsRaw) {
      out.push({
        ...base,
        name: e.name,
        page: e.page,
        toolCategory: e.group,
        weight: parseWeight(am[2].trim()),
        cost: parseCost(e.costRaw.replace(/\)$/, "")),
      });
      continue;
    }
    const isGaming = e.name === "Gaming Set";
    const variantRe =
      /([A-Za-z][A-Za-z\- ]*?) \(([\d,]+ (?:CP|SP|GP))(?:, ([\d½¼/ ]+ lb\.))?\)/g;
    let vm = variantRe.exec(variantsRaw);
    while (vm) {
      out.push({
        ...base,
        name: `${e.name}, ${titleCase(vm[1].trim().replace(/\s+/g, " "))}`,
        page: e.page,
        toolCategory: isGaming ? "gaming-set" : "musical-instrument",
        weight: vm[3] ? parseWeight(vm[3]) : parseWeight(am[2].trim()),
        cost: parseCost(vm[2]),
      });
      vm = variantRe.exec(variantsRaw);
    }
  }
  return out;
}

// ---- adventuring gear (pages 94-99) ----
function parseGear(raw) {
  const ls = lines(raw, 94, 100);
  const startIdx = ls.findIndex((l) => l.text === "Acid (25 GP)");
  const gearLines = ls.slice(startIdx);
  const stopRe =
    /^(Adventuring Gear|Item Weight Cost|Type Amount Storage Weight Cost|Focus Weight Cost|Symbol Weight Cost|Arcane Focuses|Druidic Focuses|Holy Symbols|Ammunition|Mounts and Vehicles)$/;

  // entries
  const entries = new Map();
  let cur = null;
  for (let i = 0; i < gearLines.length; i++) {
    const { text, page } = gearLines[i];
    let name = null;
    const h = text.match(TOOL_HEAD);
    if (h && !/^(Ability|Utilize|Craft|Variants):/.test(text)) name = h[1];
    if (text === "Spell Scroll (Cantrip, 30 GP;") {
      name = "Spell Scroll";
      i++; // consume "Level 1, 50 GP)"
    }
    if (name) {
      cur = { name, page, body: [], open: true };
      entries.set(name, cur);
      continue;
    }
    if (cur?.open) {
      if (stopRe.test(text)) cur.open = false;
      else cur.body.push(text);
    }
  }
  const entryText = (name) => {
    const e = entries.get(name);
    return e ? unwrap(e.body.join("\n")) : "";
  };

  // main table
  const rows = [];
  let inTable = false;
  const rowRe = new RegExp(
    `^(.+?) ${WEIGHT_RE.replace("(—|", "(—|Varies|")} ((?:[\\d,]+ (?:CP|SP|GP))|Varies)$`,
  );
  for (let i = 0; i < gearLines.length; i++) {
    const { text, page } = gearLines[i];
    if (text === "Item Weight Cost") {
      inTable = true;
      continue;
    }
    if (inTable && (text === "Ammunition" || /^Type Amount Storage/.test(text)))
      break;
    if (!inTable || text === "Adventuring Gear") continue;
    const m = text.match(rowRe);
    if (!m) throw new Error(`gear table row not understood: ${text}`);
    rows.push({ name: m[1], page, weightRaw: m[2], costRaw: m[3] });
  }

  const out = [];
  const gear = (name, page, weight, cost, text) => ({
    name,
    page,
    category: "adventuring-gear",
    weight,
    cost,
    text,
  });
  const META = new Set([
    "Ammunition",
    "Arcane Focus",
    "Druidic Focus",
    "Holy Symbol",
  ]);
  for (const r of rows) {
    if (META.has(r.name)) continue;
    const scroll = r.name.match(/^Spell Scroll \((Cantrip|Level 1)\)$/);
    const e = entries.get(scroll ? "Spell Scroll" : r.name);
    out.push(
      gear(
        r.name,
        e ? e.page : r.page,
        parseWeight(r.weightRaw),
        parseCost(r.costRaw),
        scroll ? entryText("Spell Scroll") : entryText(r.name),
      ),
    );
  }

  // sub-tables
  const sub = (title, headerRe, prefix, rowParse, introName) => {
    const i = gearLines.findIndex((l) => l.text === title);
    if (i < 0) throw new Error(`gear sub-table not found: ${title}`);
    let j = i + 1;
    if (!headerRe.test(gearLines[j].text))
      throw new Error(`unexpected header after ${title}`);
    j++;
    for (; j < gearLines.length; j++) {
      const r = rowParse(gearLines[j]);
      if (!r) break;
      out.push(
        gear(
          `${prefix}${r.label}`,
          gearLines[j].page,
          r.weight,
          r.cost,
          [entryText(introName), r.note ? `${r.label}: ${r.note}.` : ""]
            .filter(Boolean)
            .join(" "),
        ),
      );
    }
  };
  const focusRow = (line) => {
    const m = line.text.match(new RegExp(`^(.+?) ${WEIGHT_RE} (${COST_RE})$`));
    if (!m) return null;
    const noteM = m[1].match(/^(.+?) \((.+)\)$/);
    return {
      label: titleCase(noteM ? noteM[1] : m[1]),
      note: noteM ? noteM[2].replace(/^also/, "Also") : "",
      weight: parseWeight(m[2]),
      cost: parseCost(m[3]),
    };
  };
  sub(
    "Arcane Focuses",
    /^Focus Weight Cost$/,
    "Arcane Focus, ",
    focusRow,
    "Arcane Focus",
  );
  sub(
    "Druidic Focuses",
    /^Focus Weight Cost$/,
    "Druidic Focus, ",
    focusRow,
    "Druidic Focus",
  );
  sub(
    "Holy Symbols",
    /^Symbol Weight Cost$/,
    "Holy Symbol, ",
    focusRow,
    "Holy Symbol",
  );

  // ammunition table
  const ai = gearLines.findIndex((l) =>
    /^Type Amount Storage Weight Cost$/.test(l.text),
  );
  for (let j = ai + 1; j < gearLines.length; j++) {
    const m = gearLines[j].text.match(
      new RegExp(`^(.+?) (\\d+) (\\w+) ${WEIGHT_RE} (${COST_RE})$`),
    );
    if (!m) break;
    out.push(
      gear(
        m[1],
        gearLines[j].page,
        parseWeight(m[4]),
        parseCost(m[5]),
        `Amount: ${m[2]}. Storage: ${m[3]}.`,
      ),
    );
  }
  return out;
}

// ---- mounts, tack, vehicles (pages 100-101) ----
function parseMounts(raw) {
  const ls = lines(raw, 100, 101);
  const out = [];
  let mode = null;
  let saddleMode = false;
  const mk = (o) => ({ category: "mount-or-vehicle", ...o });
  for (const { text, page } of ls) {
    if (text === "Mounts and Other Animals") {
      mode = "mount";
      continue;
    }
    if (text === "Tack, Harness, and Drawn Vehicles") {
      mode = "tack";
      continue;
    }
    if (text === "Airborne and Waterborne Vehicles") {
      mode = "large";
      continue;
    }
    if (!mode) continue;
    if (mode === "mount") {
      const m = text.match(new RegExp(`^(.+?) ([\\d,]+ lb\\.) ${COST_RE}$`));
      if (m) {
        out.push(
          mk({
            name: m[1],
            page,
            vehicleType: "mount",
            cost: parseCost(`${m[3]} ${m[4]}`),
            carryingCapacity: m[2],
          }),
        );
      } else if (/^Tack, Harness|^Item Carrying/.test(text)) continue;
      continue;
    }
    if (mode === "tack") {
      if (text === "Large Vehicles") {
        mode = null;
        continue;
      }
      if (text === "Saddle") {
        saddleMode = true;
        continue;
      }
      const m = text.match(new RegExp(`^(.+?) ${WEIGHT_RE} ${COST_RE}$`));
      if (!m) continue;
      let name = m[1];
      if (/^Stabling/.test(name)) continue; // a service, not an item (see tasks.md Deviations)
      let type;
      if (saddleMode && ["Exotic", "Military", "Riding"].includes(name)) {
        name = `Saddle (${name})`;
        type = "tack";
      } else {
        saddleMode = false;
        type = name.startsWith("Feed") ? "tack" : "drawn";
      }
      out.push(
        mk({
          name,
          page,
          vehicleType: type,
          cost: parseCost(`${m[3]} ${m[4]}`),
          weight: parseWeight(m[2]),
        }),
      );
      continue;
    }
    if (mode === "large") {
      const m = text.match(
        new RegExp(
          `^(Airship|Galley|Keelboat|Longship|Rowboat|Sailing Ship|Warship) ([\\d½¼/]+ mph) (\\S+) (\\S+) (\\S+) (\\d+) (\\d+) (\\S+) ${COST_RE}$`,
        ),
      );
      if (m) {
        out.push(
          mk({
            name: m[1],
            page,
            vehicleType: m[1] === "Airship" ? "airborne" : "waterborne",
            cost: parseCost(`${m[9]} ${m[10]}`),
            speed: m[2],
            stats: {
              Crew: m[3],
              Passengers: m[4],
              "Cargo (Tons)": m[5],
              AC: m[6],
              HP: m[7],
              "Damage Threshold": m[8],
            },
          }),
        );
      }
    }
  }
  return out;
}

export function parseEquipment(rawPages) {
  const all = [
    ...parseWeapons(rawPages),
    ...parseArmor(rawPages),
    ...parseTools(rawPages),
    ...parseGear(rawPages),
    ...parseMounts(rawPages),
  ];
  const seen = new Map();
  for (const r of all) {
    const id = slug(r.name);
    if (seen.has(id))
      throw new Error(
        `equipment id collision: ${id} (${r.name} / ${seen.get(id)})`,
      );
    seen.set(id, r.name);
  }
  return all;
}
