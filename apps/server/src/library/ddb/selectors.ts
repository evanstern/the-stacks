/**
 * D&D Beyond export class names, in one place (research.md R3). A markup
 * change is a one-file edit here; no other file in `ddb/` may hardcode a DDB
 * class name.
 *
 * Observed by unzipping real Player's Handbook ("23 - Combat", "19 -
 * Equipment") and Monster Manual ("G" — Goblin/Goblin Boss) export pages into
 * a scratch directory (never committed) and inspecting their markup
 * directly, 2026-09-28. See research.md R3 for the per-selector source.
 */

/** The book content lives inside this element; everything outside it is chrome. */
export const CONTENT_ROOT = ".p-article-content";

/**
 * Heading elements inside the content root. DDB always adds `heading-anchor`
 * to h2-h6 section headings (sometimes combined with `compendium-hr` and/or
 * `compendium-header`, in no fixed order) — match on that one class, not the
 * full class string. The content root's own top `<h1>` (the chapter/article
 * title, e.g. `<h1 id="Combat">Chapter 9: Combat</h1>`) carries no class and
 * is a heading by tag alone. `h1.page-title` sits in page chrome *outside*
 * the content root (used as the page title in the edge case where the
 * content root has no heading of its own).
 */
export const HEADING_ANCHOR_CLASS = "heading-anchor";
export const PAGE_TITLE_SELECTOR = "h1.page-title";

/** A table is any `<table>` in the content root; DDB's own table classes
 * (`table-compendium`, `table--equipment`, `table--left-all`, …) are cosmetic
 * and not needed to detect one. A table's name, when present, is the heading
 * inside its `<caption>`. */
export const TABLE_TAG = "table";

/** One creature stat block. */
export const STAT_BLOCK_CONTAINER = ".stat-block-background";
export const STAT_BLOCK_PARTS = {
  /** Creature name. */
  title: ".Stat-Block-Styles_Stat-Block-Title",
  /** Size/type/alignment line, kept as part of the block's text. */
  metadata: ".Stat-Block-Styles_Stat-Block-Metadata",
  /** A `<strong>Label</strong> value` line (Armor Class, Hit Points, Speed,
   * Skills, Senses, Languages, Challenge, …). */
  data: ".Stat-Block-Styles_Stat-Block-Data",
  /** Same as `data`, marking the last line before traits/actions. */
  dataLast: ".Stat-Block-Styles_Stat-Block-Data-Last",
  /** A subsection label inside the block ("Actions", "Legendary Actions"). */
  sectionHeading: ".Stat-Block-Styles_Stat-Block-Heading",
  /** A named trait or action: `<em><strong>Name.</strong></em> text`. */
  body: ".Stat-Block-Styles_Stat-Block-Body",
} as const;

/** The six-ability-score grid: one `.stat-block-ability-scores-stat` per
 * ability, each holding a `-heading` (STR/DEX/…) and a `-data` (`-score` +
 * `-modifier`). */
export const STAT_BLOCK_ABILITY_SCORES = {
  container: ".stat-block-ability-scores",
  stat: ".stat-block-ability-scores-stat",
  heading: ".stat-block-ability-scores-heading",
  data: ".stat-block-ability-scores-data",
  score: ".stat-block-ability-scores-score",
  modifier: ".stat-block-ability-scores-modifier",
} as const;

/** A boxed callout, attached to the section it appears in. */
export const SIDEBAR_SELECTORS = [
  "aside.text--rules-sidebar",
  "aside",
  "blockquote",
];

/** An inline term with a hover tooltip (rules, conditions, skills, senses,
 * actions, spells, items, monsters, weapon properties). Its class always
 * ends in `-tooltip`; kept as ordinary inline text (not chrome). */
export const TOOLTIP_CLASS_SUFFIX = "-tooltip";

/**
 * Site chrome to strip entirely: tags, DDB's own chrome classes, and its
 * hashed CSS-module classes (`_name_hash_`, e.g. `_menuNav_1vzu8_31`).
 */
export const CHROME_TAGS = ["nav", "header", "footer", "script", "style"];
export const CHROME_CLASS_PREFIXES = ["quick-menu", "ddb-footer"];
export const CHROME_HASHED_CLASS_PATTERN = /^_[a-zA-Z]+_[a-z0-9]+/;
/** Elements at the top of the content root that are navigation aids, not
 * content: the "Jump to..." `<select>` and a hidden prev/next-chapter div. */
export const CONTENT_ROOT_CHROME_SELECTORS = [
  "select.nav-select",
  "#comp-next-nav",
];
