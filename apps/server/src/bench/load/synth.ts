/**
 * Deterministic synthetic Markdown generator (specs/021-load-bench research
 * R2). Same `seed` and `bytes` always produce byte-identical output; every
 * word comes from the fixed list below, written for this file — no SRD or
 * book text, nothing read from a corpus or fixture (constitution VIII).
 */

/** mulberry32: a small, fast, seedable PRNG — no dependency needed. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ~200 plain English words, original to this file: common nouns, verbs, and
// adjectives with no narrative content, no game terms, and no relation to
// any book, SRD, or fixture.
const WORDS = [
  "time",
  "year",
  "people",
  "way",
  "day",
  "man",
  "thing",
  "woman",
  "life",
  "child",
  "world",
  "school",
  "state",
  "family",
  "student",
  "group",
  "country",
  "problem",
  "hand",
  "part",
  "place",
  "case",
  "week",
  "company",
  "system",
  "program",
  "question",
  "work",
  "government",
  "number",
  "night",
  "point",
  "home",
  "water",
  "room",
  "area",
  "money",
  "story",
  "fact",
  "month",
  "lot",
  "right",
  "study",
  "book",
  "eye",
  "job",
  "word",
  "business",
  "issue",
  "side",
  "kind",
  "head",
  "house",
  "service",
  "friend",
  "power",
  "hour",
  "game",
  "line",
  "end",
  "member",
  "law",
  "car",
  "city",
  "community",
  "name",
  "team",
  "minute",
  "idea",
  "body",
  "information",
  "back",
  "level",
  "office",
  "door",
  "health",
  "person",
  "art",
  "history",
  "party",
  "result",
  "change",
  "morning",
  "reason",
  "research",
  "moment",
  "air",
  "teacher",
  "force",
  "education",
  "foot",
  "age",
  "policy",
  "process",
  "music",
  "market",
  "sense",
  "nation",
  "plan",
  "college",
  "interest",
  "experience",
  "effect",
  "use",
  "class",
  "control",
  "care",
  "field",
  "development",
  "role",
  "effort",
  "rate",
  "heart",
  "show",
  "leader",
  "light",
  "voice",
  "whole",
  "mind",
  "price",
  "report",
  "decision",
  "view",
  "relationship",
  "town",
  "road",
  "arm",
  "matter",
  "value",
  "building",
  "action",
  "century",
  "paper",
  "space",
  "ground",
  "form",
  "event",
  "board",
  "piece",
  "stock",
  "impact",
  "staff",
  "language",
  "site",
  "project",
  "phone",
  "activity",
  "medium",
  "product",
  "letter",
  "approach",
  "truth",
  "wall",
  "step",
  "chance",
  "example",
  "record",
  "future",
  "table",
  "food",
  "note",
  "pattern",
  "evidence",
  "figure",
  "structure",
  "goal",
  "strategy",
  "risk",
  "standard",
  "detail",
  "energy",
  "model",
  "journey",
  "garden",
  "forest",
  "river",
  "mountain",
  "island",
  "bridge",
  "castle",
  "village",
  "harbor",
  "meadow",
  "valley",
  "desert",
  "storm",
  "season",
  "stone",
  "glass",
  "metal",
  "wood",
  "cloth",
  "thread",
  "stitch",
  "signal",
  "engine",
  "wheel",
  "lantern",
  "compass",
  "anchor",
  "ladder",
  "fence",
  "orchard",
  "harvest",
  "current",
  "shadow",
  "horizon",
  "summit",
  "canyon",
  "coastline",
  "trail",
  "outpost",
  "shelter",
  "beacon",
  "channel",
  "reservoir",
  "quarry",
  "pasture",
  "thicket",
  "clearing",
  "ridge",
  "hollow",
];

function cap(word: string): string {
  return word.length ? word[0].toUpperCase() + word.slice(1) : word;
}

function words(rng: () => number, count: number): string[] {
  return Array.from(
    { length: count },
    () => WORDS[Math.floor(rng() * WORDS.length)],
  );
}

function sentence(rng: () => number): string {
  const count = 6 + Math.floor(rng() * 9); // 6-14 words
  return `${cap(words(rng, count).join(" "))}.`;
}

function listItem(rng: () => number): string {
  const count = 3 + Math.floor(rng() * 5); // 3-7 words
  return `- ${cap(words(rng, count).join(" "))}`;
}

function heading(rng: () => number, level: "#" | "##" | "###"): string {
  return `${level} ${cap(words(rng, 2 + Math.floor(rng() * 3)).join(" "))}`;
}

/**
 * Emits Markdown — headings, paragraphs, and bullet lists — until the
 * output reaches `bytes`, checked after each small block so the overshoot
 * stays a small fraction of the target for any realistic profile size
 * (docBytes >= 1024). Deterministic: same `seed` and `bytes` in, same
 * string out.
 */
export function synthDoc(seed: number, bytes: number): string {
  const rng = mulberry32(seed);
  const blocks: string[] = [heading(rng, "#")];
  const currentBytes = () => Buffer.byteLength(blocks.join("\n\n"), "utf8");

  let i = 0;
  while (currentBytes() < bytes) {
    i += 1;
    if (i % 7 === 0) {
      blocks.push(heading(rng, i % 21 === 0 ? "##" : "###"));
    } else if (i % 4 === 0) {
      const itemCount = 2 + Math.floor(rng() * 3);
      blocks.push(
        Array.from({ length: itemCount }, () => listItem(rng)).join("\n"),
      );
    } else {
      const sentenceCount = 1 + Math.floor(rng() * 2);
      blocks.push(
        Array.from({ length: sentenceCount }, () => sentence(rng)).join(" "),
      );
    }
  }

  return `${blocks.join("\n\n")}\n`;
}
