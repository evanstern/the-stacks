import type {
  IntentRecorded,
  SessionProjections,
} from "@the-stacks/session-model";
import {
  type FactAction,
  type FactChange,
  type FactRoll,
  type NarrationFacts,
  renderChangeLine,
  renderRollLine,
} from "./facts.js";
import type { TurnTrigger } from "./jobs.js";
import { EITHER_OR_END, STOCK_ENDING } from "./narration-words.js";

/**
 * The fact sheet (spec 098, contracts/fact-sheet.md). Pure: it reads settled
 * engine events (`NarrationFacts`) plus projections, and renders every fact
 * row and the State line in code. The model fills three slots from it. This
 * module imports no engine value, no RNG and nothing from `gate/`: narrate's
 * import closure includes it.
 */

export type SlotName = "restate" | "describe" | "ask";

export interface RestateTarget {
  actionId: string;
  /** "Tamsin Vale" or "The party". */
  subject: string;
  /** The declared text, digits spelled out. */
  text: string;
  resolution:
    | "applied"
    | "no-effect"
    | "refused"
    | "clarify"
    | "held"
    | "partial";
  refusalCode: string | null;
}

export interface FactRow {
  kind:
    | "roll"
    | "hp"
    | "life-state"
    | "condition"
    | "death-saves"
    | "spell-slot"
    | "assist"
    | "refusal"
    | "why"
    | "deed";
  text: string;
}

export interface Speaker {
  name: string;
  /** The settled line the NPC speaks this beat, else null. */
  say: string | null;
}

export interface NarrationSlots {
  restate: string;
  describe: string;
  ask: string;
}

export interface FactSheet {
  trigger: TurnTrigger;
  mode: "free" | "turn";
  restate: RestateTarget[];
  rows: FactRow[];
  speakers: Speaker[];
  slots: SlotName[];
  /** A code-settled ask (a clarify question, verbatim); null when none. */
  ask: string | null;
  /** The code-rendered State line; null only on a talk reply. */
  state: string | null;
  settled: NarrationFacts;
}

/** One planner fact (spec 097 contract §4), as the Intent carrier row stores it. */
export type PlanFact = IntentRecorded["facts"][number];

export interface FactSheetInput {
  settled: NarrationFacts;
  /** The planner's facts for the beat's Intents (spec 098 contract §6). */
  planFacts?: readonly PlanFact[];
  /** SRD rule title by id; the id renders when absent or unknown. */
  ruleTitle?: (id: string) => string | undefined;
  beat: readonly {
    actionId: string;
    characterId: string | null;
    scope: "character" | "party";
    actor: string;
    text: string;
  }[];
  projections: Pick<SessionProjections, "party" | "tableMode" | "encounter">;
  nameOf: (id: string | null) => string;
  submissions: readonly {
    key: string;
    result: "applied" | "pending" | "suggested" | "refused";
  }[];
}

export const DIGIT_WORDS = [
  "zero",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
];

/** "Goblin-3" becomes "Goblin three"; every digit becomes its word. */
export function spellDigits(text: string): string {
  return text
    .replace(/-(?=[0-9])/g, " ")
    .replace(/[0-9]/g, (d) => ` ${DIGIT_WORDS[Number(d)]} `)
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

/** Refusal reason by gate code (contract §3.2). */
export const REFUSAL_REASON: Readonly<Record<string, string>> = {
  STEP_ACTOR_MISMATCH: "the step named another character",
  UNKNOWN_COMBATANT: "that target is not in the scene",
  NO_SLOT_AVAILABLE: "no spell slot of that level is left",
  SPELL_UNKNOWN: "the caster does not know that spell",
  SPELL_NOT_PREPARED: "that spell is not prepared",
  SPELL_UNRESOLVED: "the engine cannot resolve that spell yet",
  STAT_UNDEFINED: "the sheet has no value for that roll",
  NOT_YOUR_TURN: "it is not that character's turn",
  TURN_MOVED: "it is not that character's turn",
  CHARACTER_UNABLE: "that character cannot act",
};

const refusalReason = (code: string): string =>
  REFUSAL_REASON[code] ?? "the rules do not allow it";

export const MAX_PROSE_CHARS = 1200;

/**
 * Drops a trailing "What do you do?" sentence when a sentence end precedes it
 * (TASK-0214 R5). The audit's literal-ending check stays as the backstop for
 * prose with no earlier sentence.
 */
export function dropStockEnding(prose: string): string {
  const m = STOCK_ENDING.exec(prose.trim());
  if (!m) return prose;
  const t = prose.trim();
  // Strip the opening quote of a quoted stock line.
  const head = t
    .slice(0, m.index)
    .replace(/["'“‘]+$/, "")
    .trimEnd();
  return /[.!?]["'”’]*$/.test(head) ? head : prose;
}

/** Cuts prose to the cap at a sentence end when one exists. */
export function clipProse(text: string): string {
  const trimmed = text.trim();
  if (trimmed.length <= MAX_PROSE_CHARS) return trimmed;
  const cut = trimmed.slice(0, MAX_PROSE_CHARS);
  const end = Math.max(
    cut.lastIndexOf(". "),
    cut.lastIndexOf("! "),
    cut.lastIndexOf("? "),
  );
  return end > 200 ? cut.slice(0, end + 1) : cut;
}

function rowKind(c: FactChange): FactRow["kind"] {
  return c.kind;
}

/** Spec 111: one `Deed:` row per direct entry, in the Intent's text form. */
export const deedLine = (s: {
  name: string;
  deed: { text: string; stopped: string | null };
}): string =>
  `Deed: ${s.name}: ${s.deed.text}${s.deed.stopped ? ` (stopped, ${s.deed.stopped})` : ""}`;

/** Every fact row for the turn, in narration order (contract §3). Pure. */
export function renderRows(facts: NarrationFacts): FactRow[] {
  const rows: FactRow[] = [];
  const push = (rolls: FactRoll[], changes: FactChange[]): void => {
    for (const r of rolls) rows.push({ kind: "roll", text: renderRollLine(r) });
    for (const c of changes) {
      const text = renderChangeLine(c);
      if (text) rows.push({ kind: rowKind(c), text });
    }
  };
  for (const a of facts.actions) {
    push(a.rolls, a.changes);
    if (a.outcome === "refused" && a.refusalCode) {
      const subject = a.characterName ?? "The party";
      rows.push({
        kind: "refusal",
        text: `${subject}: refused, ${refusalReason(a.refusalCode)} (${a.refusalCode})`,
      });
    }
  }
  // Pulls log before the NPC turn's rows, so the auditor's null-action group sees them first.
  for (const s of facts.pulled ?? []) push(s.rolls, s.changes);
  if (facts.npcTurn) push(facts.npcTurn.rolls, facts.npcTurn.changes);
  for (const s of facts.settled ?? []) push(s.rolls, s.changes);
  for (const s of facts.direct ?? []) {
    if (s.deed)
      rows.push({
        kind: "deed",
        text: deedLine({ name: s.name, deed: s.deed }),
      });
    push(s.rolls, s.changes);
  }
  return rows;
}

/** One `why` row per PlanFact (spec 098 contract §6). `unserved` renders no row. Pure. */
export function renderWhyRows(
  facts: readonly PlanFact[],
  nameOf: (id: string | null) => string,
  ruleTitle: (id: string) => string | undefined = () => undefined,
): FactRow[] {
  const rows: FactRow[] = [];
  for (const f of facts) {
    let text: string | null = null;
    switch (f.kind) {
      case "rule":
        text = `Rule: ${ruleTitle(f.rule) ?? f.rule}`;
        break;
      case "dc": {
        const rule = f.opposition?.rule ?? f.difficulty;
        if (f.dc !== undefined) text = `DC ${f.dc}${rule ? ` (${rule})` : ""}`;
        else if (f.opposition)
          text = `Opposed by ${nameOf(f.opposition.opponentId)} (${f.opposition.rule})`;
        else if (f.difficulty) text = `Difficulty: ${f.difficulty}`;
        break;
      }
      case "reach":
        text = `Reach: ${f.band}, ${f.use}`;
        break;
      case "pull-in":
        text = `${nameOf(f.actorId)} joins the fight`;
        break;
      case "reaction":
        text = `${nameOf(f.reactorId)} may react as the mover leaves`;
        break;
      case "ruling":
        text = `DM ruling: ${f.decision}${f.reason ? `: ${f.reason}` : ""}`;
        break;
      case "no-roll":
        text = "No roll needed";
        break;
      case "ignored":
        text = `The DM sets the ${f.field}`;
        break;
      case "unserved":
        break;
    }
    if (text) rows.push({ kind: "why", text });
  }
  return rows;
}

function answererOf(
  input: FactSheetInput,
  item: FactSheetInput["beat"][number],
): string {
  const member =
    input.projections.party.find((m) =>
      m.controller.kind === "player"
        ? m.controller.userId === item.actor
        : m.controller.actor === item.actor,
    ) ??
    input.projections.party.find((m) => m.characterId === item.characterId);
  return member?.name ?? input.nameOf(item.characterId);
}

function subjectOf(
  input: FactSheetInput,
  item: FactSheetInput["beat"][number],
): string {
  if (item.scope === "party") return "The party";
  return (
    input.settled.party.find((p) => p.characterId === item.characterId)?.name ??
    input.projections.party.find((m) => m.characterId === item.characterId)
      ?.name ??
    "The character"
  );
}

function restateTargets(input: FactSheetInput): RestateTarget[] {
  const { settled } = input;
  const out: RestateTarget[] = [];
  for (const item of input.beat) {
    const action = settled.actions.find(
      (a): a is FactAction => a.actionId === item.actionId,
    );
    const held = settled.held?.some((h) => h.text === item.text) ?? false;
    const clarify = settled.clarify.some((c) => c.actionId === item.actionId);
    let resolution: RestateTarget["resolution"];
    if (clarify) resolution = "clarify";
    else if (action) {
      const laterRefused = input.submissions.some(
        (s) =>
          s.key.startsWith(`act:${item.actionId}:`) && s.result === "refused",
      );
      resolution =
        action.outcome === "applied" &&
        (action.followUps.length > 0 || laterRefused)
          ? "partial"
          : action.outcome;
    } else if (held) resolution = "held";
    else continue;
    out.push({
      actionId: item.actionId,
      subject: subjectOf(input, item),
      text: spellDigits(item.text),
      resolution,
      refusalCode: action?.refusalCode ?? null,
    });
  }
  return out;
}

function statusClause(input: FactSheetInput, t: RestateTarget): string {
  const item = input.beat.find((b) => b.actionId === t.actionId);
  switch (t.resolution) {
    case "applied":
      return `${t.subject}'s action is done.`;
    case "partial":
      return `${t.subject}'s action is partly done; the rest has not happened.`;
    case "no-effect":
      return `${t.subject}'s action is done; nothing changed.`;
    case "refused":
      return `${t.subject}'s action did not happen.`;
    case "clarify": {
      const who = item ? answererOf(input, item) : t.subject;
      return `Nothing has happened yet. ${t.subject}'s action waits on ${who}'s answer.`;
    }
    case "held": {
      const name = input.settled.held?.find((h) => h.text === item?.text)?.name;
      return `${t.subject}'s action waits for ${name ?? "a companion"}'s turn.`;
    }
  }
}

/** The State line (contract §4.4): status clauses, then the floor clause. */
export function renderStateLine(
  input: FactSheetInput,
  restate: readonly RestateTarget[],
): string {
  const { settled } = input;
  const clauses = restate.map((t) => statusClause(input, t));
  const clarifying = restate.find((t) => t.resolution === "clarify");
  let floor: string;
  if (settled.director.sceneEnded) {
    floor = "The scene is over; the DM moves next.";
  } else if (input.projections.tableMode.mode === "turn") {
    const clarifyItem = clarifying
      ? input.beat.find((b) => b.actionId === clarifying.actionId)
      : undefined;
    const activeId = input.projections.encounter?.activeCombatantId;
    const active = clarifyItem
      ? answererOf(input, clarifyItem)
      : activeId
        ? input.nameOf(activeId)
        : "the DM";
    const started = settled.events.some((e) => e.kind === "encounter-started");
    floor = `${started ? "The fight begins. " : ""}It is ${active}'s turn.`;
  } else if (settled.events.some((e) => e.kind === "encounter-ended")) {
    floor = "The fight is over. Anyone may act.";
  } else if (clarifying || settled.clarify.length > 0) {
    floor = "Anyone else may act.";
  } else floor = "Anyone may act.";
  return ["State:", ...clauses, floor].join(" ");
}

/** Builds the sheet from settled events and projections (contract §1, §2, §4). */
export function buildFactSheet(input: FactSheetInput): FactSheet {
  const { settled } = input;
  const restate = restateTargets(input);
  const ask =
    settled.clarify.length > 0
      ? settled.clarify
          .map((c) => c.question.trim())
          .filter(Boolean)
          .join(" ") || null
      : null;
  let slots: SlotName[];
  if (settled.trigger === "talk") slots = [];
  else if (settled.trigger === "npc-turn") slots = ["describe"];
  else if (settled.trigger === "scene-start") slots = ["describe", "ask"];
  else if (restate.length === 0) slots = ["describe"];
  // A routine turn never asks: the model's "What do you do next?" is a prompt to act, not a clarification.
  else slots = ["restate", "describe"];
  const speakers: Speaker[] = settled.presentNpcs.map((n) => ({
    name: n.name,
    say:
      settled.npcTurn?.name === n.name
        ? (settled.npcTurn.plan?.say ?? null)
        : null,
  }));
  return {
    trigger: settled.trigger,
    mode: input.projections.tableMode.mode,
    restate,
    rows: [
      ...renderRows(settled),
      ...renderWhyRows(input.planFacts ?? [], input.nameOf, input.ruleTitle),
    ],
    speakers,
    slots,
    ask,
    state: settled.trigger === "talk" ? null : renderStateLine(input, restate),
    settled,
  };
}

/** The code restate: `<subject> means to: "<text>".` per target. */
export function defaultRestate(sheet: FactSheet): string {
  return sheet.restate
    .map((t) => `${t.subject} means to: "${t.text}".`)
    .join(" ");
}

// Label forms at line start: `[x]`, `[x]:`, `x:`, `**x:**`, `**x**:` (the model drifts from the bracket form).
export const TAG =
  /^[ \t]*(?:\[(restate|describe|ask)\]:?|\*\*(restate|describe|ask):?\*\*:?|(restate|describe|ask):)[ \t]*/gim;

/** The sentence-ish pieces `dropDigitSentences` works on: a split after a sentence end, quotes kept. */
export const PIECE_SPLIT = /(?<=[.!?]["'”’)]*)\s+/;

/** Narration holds no digits (spec 103 FR-004): a sentence with one is dropped; rows carry numbers. */
export function dropDigitSentences(t: string): string {
  return t
    .split(PIECE_SPLIT)
    .filter((x) => !/[0-9]/.test(x))
    .join(" ");
}

/** Parses the model's tagged text into validated slots (contract §5.1). */
export function parseSlots(text: string, sheet: FactSheet): NarrationSlots {
  const raw: Record<SlotName, string[]> = {
    restate: [],
    describe: [],
    ask: [],
  };
  let current: SlotName = "describe";
  let last = 0;
  for (const m of text.matchAll(TAG)) {
    raw[current].push(text.slice(last, m.index));
    current = (m[1] ?? m[2] ?? (m[3] as string)).toLowerCase() as SlotName;
    last = (m.index ?? 0) + m[0].length;
  }
  raw[current].push(text.slice(last));
  const slot = (n: SlotName): string =>
    sheet.slots.includes(n)
      ? raw[n]
          .map((s) => s.trim())
          .filter(Boolean)
          .join(" ")
      : "";

  let restate = slot("restate");
  if (sheet.slots.includes("restate") && (!restate || /[0-9]/.test(restate))) {
    restate = defaultRestate(sheet);
  }
  let ask = slot("ask");
  if (
    ask &&
    !(
      ask.endsWith("?") &&
      ask.split("?").length === 2 &&
      !EITHER_OR_END.test(ask) &&
      !STOCK_ENDING.test(ask)
    )
  ) {
    ask = "";
  }
  if (sheet.ask) ask = sheet.ask;
  if (!sheet.ask) ask = dropDigitSentences(ask);
  const describe = dropStockEnding(
    clipProse(dropDigitSentences(slot("describe"))),
  );
  return { restate, describe, ask };
}

/** The shipped text: restate, describe, ask, then rows and the State line (contract §5.2). */
export function composeReply(slots: NarrationSlots, sheet: FactSheet): string {
  const code = [...sheet.rows.map((r) => r.text), sheet.state ?? ""]
    .filter(Boolean)
    .join("\n");
  return [slots.restate, slots.describe, slots.ask, code]
    .filter(Boolean)
    .join("\n\n");
}
