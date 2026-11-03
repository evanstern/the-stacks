import { createHash } from "node:crypto";
import { z } from "zod";
import {
  DEFENCE_VERBS,
  DICE_LANGUAGE,
  EITHER_OR_END,
  LIST_LINE,
  MAX_WORDS,
  NEGATIVE_WORDS,
  namePairMatch,
  namePairsWith,
  namePairsWithIntentReflex,
  POSITIVE_WORDS,
  REFLEX_VERBS,
  SCENE_START_VERBS,
  verbForms,
  wordCount,
} from "../audit-words.js";
import { type ClaimState, checkClaims } from "../claims.js";
import { type NarrationFacts, renderDiceLines } from "../facts.js";
import { factualSummary, spellDigits } from "../fallback.js";
import { callJson } from "../pipeline/call.js";
import type {
  ModelCallRecord,
  Node,
  NodeErrorKind,
} from "../pipeline/context.js";
import { buildAuditPrompt, PROMPT_VERSION } from "../prompts/audit.js";
import { PURPOSE_OF } from "../purposes.js";
import { nameTerms } from "../snapshot/aliases.js";
import { composeText, narrateAttempt } from "./narrate.js";

/**
 * The audit node (contracts/audit.md): deterministic checks, one `dm.audit`
 * call, and the bounded regenerate loop (at most three attempts). A mismatch
 * never ships silently: the fallback summary ships and a flag is recorded.
 */

export const MAX_NARRATION_ATTEMPTS = 3;

export const AUDIT_ISSUE_KINDS = [
  "ledger-mismatch",
  "invented-mechanics",
  "player-agency",
  "doctrine",
  "other",
] as const;
export type AuditIssueKind = (typeof AUDIT_ISSUE_KINDS)[number];

export interface AuditIssue {
  kind: AuditIssueKind;
  detail: string;
}

export const AuditModelOutput = z
  .object({
    verdict: z.enum(["pass", "fail"]),
    issues: z
      .array(
        z.object({
          kind: z.enum(AUDIT_ISSUE_KINDS),
          detail: z.string().min(1).max(300),
        }),
      )
      .max(8),
  })
  .refine((o) => o.verdict === "pass" || o.issues.length > 0);

export interface RecordedIssue extends AuditIssue {
  blocking: boolean;
}

/** Kinds from `dm.audit` that block (contracts/audit-criteria.md). */
const BLOCKING_LLM_KINDS: ReadonlySet<AuditIssueKind> = new Set([
  "ledger-mismatch",
  "invented-mechanics",
  "player-agency",
]);
export const llmIssueBlocks = (kind: AuditIssueKind): boolean =>
  BLOCKING_LLM_KINDS.has(kind);

/** Party-name terms: full name, characterId, given name. Deduped, no empties. */
export function partyNameTerms(party: NarrationFacts["party"]): string[] {
  const terms = new Set<string>();
  for (const m of party) {
    for (const t of nameTerms(m.name, [m.characterId])) terms.add(t);
  }
  return [...terms];
}

const escapeRe = (t: string): string =>
  t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** True when `detail` holds a whole-word party-name term (contracts/audit-criteria.md, E2). */
export function detailNamesPartyMember(
  detail: string,
  party: NarrationFacts["party"],
): boolean {
  return partyNameTerms(party).some((term) => {
    const body = term.split(/\s+/).map(escapeRe).join("\\s+");
    return new RegExp(
      `(?<![\\p{L}\\p{N}_-])${body}(?![\\p{L}\\p{N}_-])`,
      "iu",
    ).test(detail);
  });
}

/** Whether one `dm.audit` issue blocks, given the party (the E2 filter). */
export function llmIssueBlocksFor(
  issue: AuditIssue,
  party: NarrationFacts["party"],
): boolean {
  if (issue.kind !== "player-agency") return llmIssueBlocks(issue.kind);
  return detailNamesPartyMember(issue.detail, party);
}

export interface AuditAttempt {
  attempt: number;
  /** The attempt's prose word count. */
  words: number;
  deterministic: { pass: boolean; issues: RecordedIssue[] };
  llm:
    | { verdict: "pass" | "fail"; issues: RecordedIssue[] }
    | { skipped: true }
    | { error: NodeErrorKind };
  /** The attempt's prose is not stored; its hash is. */
  proseSha256: string;
}

export interface AuditRecord {
  attempts: AuditAttempt[];
  final: "passed" | "passed-after-regenerate" | "fallback";
  /** True when any attempt had a blocking issue. */
  flagged: boolean;
  shippedProseSha256: string;
}

export interface AuditOutput {
  record: AuditRecord;
  /** What `submitNarration` ships; null when there was nothing to narrate. */
  shipped: {
    prose: string;
    text: string;
    actionIds: string[];
    fallback: boolean;
    /** Journal body for the audit flag, set only on a fallback. */
    flagBody: string | null;
  } | null;
}

const sha = (s: string): string => createHash("sha256").update(s).digest("hex");

/**
 * Pure. Checks over one narration: the claim checker (spec 051) replaces the
 * four actor-anonymous death and drop checks. Every issue here blocks.
 */
export function deterministicChecks(
  facts: NarrationFacts,
  narration: { prose: string; diceLines: readonly string[] },
  state: ClaimState,
): { pass: boolean; issues: AuditIssue[] } {
  const { prose } = narration;
  const issues: AuditIssue[] = [];
  const add = (kind: AuditIssueKind, detail: string) =>
    issues.push({ kind, detail });

  if (prose.trim().length === 0) add("doctrine", "The narration is empty.");
  if (/[0-9]/.test(prose)) {
    add(
      "ledger-mismatch",
      "The prose contains digits; numbers live on the dice lines.",
    );
  }

  const hasRoll =
    facts.actions.some((a) => a.rolls.length > 0) ||
    (facts.npcTurn?.rolls.length ?? 0) > 0;
  if (!hasRoll && DICE_LANGUAGE.test(prose)) {
    add(
      "invented-mechanics",
      "The prose names dice or a roll, and this turn had none.",
    );
  }

  for (const c of checkClaims(state, prose).issues) {
    add("ledger-mismatch", `Actor state: ${c.detail}`);
  }

  for (const a of facts.actions) {
    if (!a.characterName) continue;
    // Only the character's own rolls: a reaction attack belongs to someone else (spec 079).
    const own = a.rolls.filter((r) => r.name === a.characterName && r.outcome);
    if (own.length !== 1) continue;
    const only = own[0]?.outcome;
    if (!only) continue;
    const opposite =
      only === "hit" || only === "critical-hit" || only === "success"
        ? NEGATIVE_WORDS
        : POSITIVE_WORDS;
    const parts = a.characterName.split(/\s+/);
    const aliases = [
      ...new Set([a.characterName, parts[0], parts[parts.length - 1]]),
    ].filter((n): n is string => !!n && n.length >= 3);
    if (aliases.some((n) => namePairsWith(prose, n, opposite))) {
      add(
        "ledger-mismatch",
        `The prose pairs ${a.characterName} with the opposite of the recorded ${only}.`,
      );
    }
  }

  // Agency checks (spec 074): run on the prose without a matched trailing
  // clarify question; the question asks the player and decides nothing.
  const normText = (t: string) =>
    spellDigits(t)
      .toLowerCase()
      .replace(/["'\u2018\u2019\u201c\u201d]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  let agencyProse = prose;
  const trimmed = prose.trimEnd();
  for (const c of facts.clarify) {
    const q = c.question.trim();
    if (q && normText(trimmed).endsWith(normText(q))) {
      // Cut at the last sentence break so the question leaves the tail.
      const cut = Math.max(
        trimmed.lastIndexOf(". ", trimmed.length - q.length),
        trimmed.lastIndexOf("\n", trimmed.length - q.length),
      );
      agencyProse = cut >= 0 ? trimmed.slice(0, cut + 1) : "";
      break;
    }
  }
  const aliasesOf = (full: string): string[] => {
    const parts = full.split(/\s+/);
    return [...new Set([full, parts[0], parts[parts.length - 1]])].filter(
      (n): n is string => !!n && n.length >= 3,
    );
  };
  const forms = (lemmas: readonly string[]): string[] =>
    lemmas.flatMap(verbForms);
  const defence = forms(DEFENCE_VERBS);
  const reflex = forms(REFLEX_VERBS);
  const partyNames = new Set(facts.party.map((m) => m.name));
  const missedParty = new Set<string>();
  for (const r of [
    ...facts.actions.flatMap((a) => a.rolls),
    ...(facts.npcTurn?.rolls ?? []),
  ]) {
    if (r.outcome === "miss" && r.target && partyNames.has(r.target)) {
      missedParty.add(r.target);
    }
  }
  // ponytail: lexical window of two words before the verb and three before an
  // intent marker; upgrade to the claim gate's clause parser (claims.ts) if the
  // playtest shows paraphrases ("slips aside") passing.
  for (const name of missedParty) {
    const own = facts.actions.find((a) => a.characterName === name)?.text ?? "";
    const ownChoice = [
      ...DEFENCE_VERBS,
      ...REFLEX_VERBS,
      ...defence,
      ...reflex,
    ].some((v) => new RegExp(`\\b${v}\\b`, "i").test(own));
    if (ownChoice) continue;
    let hit: string | null = null;
    for (const n of aliasesOf(name)) {
      hit =
        namePairMatch(agencyProse, n, defence) ??
        namePairsWithIntentReflex(agencyProse, n, reflex);
      if (hit) break;
    }
    if (hit) {
      add(
        "player-agency",
        `The prose shows ${name} choosing a defence ("${hit.slice(0, 60)}") on a recorded miss.`,
      );
    }
  }
  if (facts.trigger === "scene-start") {
    const sceneVerbs = forms(SCENE_START_VERBS);
    for (const m of facts.party) {
      const hit = aliasesOf(m.name)
        .map((n) => namePairMatch(agencyProse, n, sceneVerbs))
        .find((h) => h);
      if (hit) {
        add(
          "player-agency",
          `The opening moves or voices ${m.name} ("${hit.slice(0, 60)}").`,
        );
      }
    }
  }

  const words = wordCount(prose);
  if (words > MAX_WORDS) {
    add("doctrine", `The prose is ${words} words; the limit is ${MAX_WORDS}.`);
  }
  const listLine = LIST_LINE.exec(prose);
  const eitherOrHit = EITHER_OR_END.exec(prose.trim());
  // The clarify question is the one either-or ending allowed (specs/073).
  const norm = (t: string) =>
    spellDigits(t)
      .toLowerCase()
      .replace(/["'\u2018\u2019\u201c\u201d]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  const proseTail = norm(prose);
  const eitherOr =
    eitherOrHit &&
    facts.clarify.some((c) => proseTail.endsWith(norm(c.question)))
      ? null
      : eitherOrHit;
  if (listLine || eitherOr) {
    const quoted = eitherOr
      ? `the closing question "${eitherOr[0].trim().slice(0, 120)}"`
      : "a list line";
    add(
      "doctrine",
      `The prose offers an option menu: ${quoted}. Ask one open question instead.`,
    );
  }
  if (facts.clarify.length > 0 && !prose.trim().endsWith("?")) {
    add(
      "doctrine",
      "The facts ask a question and the prose does not end with one.",
    );
  }

  const expected = renderDiceLines(facts);
  if (
    expected.length !== narration.diceLines.length ||
    expected.some((l, i) => l !== narration.diceLines[i])
  ) {
    add("ledger-mismatch", "The dice lines differ from the renderer's output.");
  }
  return { pass: issues.length === 0, issues };
}

export const audit: Node<"audit"> = async (ctx) => {
  const narration = ctx.results.narrate;
  const assembled = ctx.results.assemble;
  const resolved = ctx.results.resolve;
  if (!narration || !assembled || !resolved) {
    return {
      ok: false,
      node: "audit",
      calls: [],
      error: { kind: "internal", message: "audit ran before narrate" },
    };
  }
  if (narration.skipped) {
    return {
      ok: true,
      node: "audit",
      calls: [],
      output: {
        record: {
          attempts: [],
          final: "passed",
          flagged: false,
          shippedProseSha256: sha(""),
        },
        shipped: null,
      },
    };
  }

  const { facts } = narration;
  const claimState: ClaimState = {
    snapshot: resolved.snapshot,
    diff: resolved.diff,
  };
  const calls: ModelCallRecord[] = [];
  const attempts: AuditAttempt[] = [];
  const allIssues: string[] = [];
  const line = (i: RecordedIssue): string =>
    `${i.blocking ? "" : "[advisory] "}${i.kind}: ${i.detail}`;
  const advisory = (xs: readonly AuditIssue[]): RecordedIssue[] =>
    xs.map((i) => ({ ...i, blocking: false }));
  let current = { prose: narration.prose, diceLines: narration.diceLines };
  let issuesSoFar: AuditIssue[] = [];
  let attempt = 1;

  const fallback = (): AuditOutput => {
    const prose = factualSummary(facts, claimState);
    const diceLines = renderDiceLines(facts);
    return {
      record: {
        attempts,
        final: "fallback",
        flagged: true,
        shippedProseSha256: sha(prose),
      },
      shipped: {
        prose,
        text: composeText(prose, diceLines),
        actionIds: narration.actionIds,
        fallback: true,
        flagBody:
          allIssues.join("\n").slice(0, 8000) ||
          "The audit could not pass a narration.",
      },
    };
  };

  for (;;) {
    const detRaw = deterministicChecks(facts, current, claimState);
    const det = {
      pass: detRaw.pass,
      issues: detRaw.issues.map((i) => ({ ...i, blocking: true })),
    };
    let llm: AuditAttempt["llm"] = { skipped: true };
    let llmFailed = false;
    if (det.pass) {
      const prompt = buildAuditPrompt({
        facts,
        snapshot: resolved.snapshot,
        prose: current.prose,
      });
      const res = await callJson(ctx.deps, {
        purpose: PURPOSE_OF.audit,
        promptVersion: PROMPT_VERSION,
        system: prompt.system,
        user: prompt.user,
        schema: AuditModelOutput,
        signal: ctx.signal,
      });
      calls.push(...res.calls);
      if (res.ok) {
        llm = {
          verdict: res.value.verdict,
          issues: res.value.issues.map((i) => ({
            ...i,
            blocking: llmIssueBlocksFor(i, facts.party),
          })),
        };
      } else {
        if (res.error.kind === "aborted" || res.error.kind === "fenced") {
          return { ok: false, node: "audit", error: res.error, calls };
        }
        llm = { error: res.error.kind };
        llmFailed = true;
      }
    }
    attempts.push({
      attempt,
      words: wordCount(current.prose),
      deterministic:
        attempt === 1
          ? {
              pass: det.pass,
              issues: [...det.issues, ...advisory(narration.withheld)],
            }
          : det,
      llm,
      proseSha256: sha(current.prose),
    });

    const llmIssues = "issues" in llm ? llm.issues : [];
    const blocking = [...det.issues, ...llmIssues].filter((i) => i.blocking);
    if (det.pass && "verdict" in llm && blocking.length === 0) {
      return {
        ok: true,
        node: "audit",
        calls,
        output: {
          record: {
            attempts,
            final: attempt === 1 ? "passed" : "passed-after-regenerate",
            flagged: attempt > 1,
            shippedProseSha256: sha(current.prose),
          },
          shipped: {
            prose: current.prose,
            text: composeText(current.prose, current.diceLines),
            actionIds: narration.actionIds,
            fallback: false,
            flagBody: null,
          },
        },
      };
    }

    const found = [
      ...(attempt === 1 ? advisory(narration.withheld) : []),
      ...det.issues,
      ...llmIssues,
    ];
    allIssues.push(
      `Attempt ${attempt}: ${
        llmFailed ? "the audit call failed; " : ""
      }${found.map(line).join(" | ") || "no detail"}`,
    );
    if (llmFailed || attempt >= MAX_NARRATION_ATTEMPTS) {
      return { ok: true, node: "audit", calls, output: fallback() };
    }
    issuesSoFar = [
      ...issuesSoFar,
      ...blocking.map(({ kind, detail }) => ({ kind, detail })),
    ];
    attempt++;
    const regen = await narrateAttempt(
      ctx,
      assembled,
      facts,
      resolved.snapshot,
      {
        prose: current.prose,
        issues: issuesSoFar,
      },
    );
    calls.push(...regen.calls);
    if (!regen.ok) {
      if (regen.error.kind === "aborted" || regen.error.kind === "fenced") {
        return { ok: false, node: "audit", error: regen.error, calls };
      }
      allIssues.push(
        `Attempt ${attempt}: regeneration failed (${regen.error.kind})`,
      );
      return { ok: true, node: "audit", calls, output: fallback() };
    }
    current = { prose: regen.prose, diceLines: renderDiceLines(facts) };
  }
};
