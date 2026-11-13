import { createHash } from "node:crypto";
import { type Intent, IntentSchema, toText } from "@the-stacks/intent";
import {
  isDmReadOutput,
  type Proposal,
  type ReadablePost,
  readablePosts,
  type SessionProjections,
} from "@the-stacks/session-model";
import { encounterRan, encounterToStart } from "./gates/plan-gate.js";
import { checkNarration, dropSentences } from "./narration-check.js";
import { type CheckRecord, correctionsFor } from "./nodes/check.js";
import type { DirectorNodeOutput } from "./nodes/director.js";
import { stampIntent } from "./nodes/interpret.js";
import type { ResolveOutput } from "./nodes/resolve.js";
import {
  findLandedNarration,
  type ReadShip,
  resolve,
  shipReadRows,
  submitNarration,
} from "./nodes/resolve.js";
import { ReactOutput } from "./nodes/schemas.js";
import { callJson } from "./pipeline/call.js";
import type {
  ModelCallRecord,
  NodeOutputs,
  TurnContext,
  TurnOutcome,
} from "./pipeline/context.js";
import { rosterOf } from "./prompts/common.js";
import { buildReactPrompt, PROMPT_VERSION } from "./prompts/react.js";
import { PURPOSE_OF } from "./purposes.js";
import { dmOnlySeedText, playerFacingSeed } from "./seed/views.js";
import {
  type CodeTrigger,
  capReached,
  codeTriggers,
  needsModel,
  TALK_CHAIN_CAP,
  type TalkResult,
} from "./talk-triggers.js";

/**
 * The talk path (specs/065-talk-triggers plan D3): a `talk` turn with no
 * committed beat. Assemble ran; this reads the posts, asks `react` once, checks the
 * text in code (spec 103: a leak drops the sentence, a contradiction ships with a
 * correction) and ships one narration row.
 * An `escalate` reaction runs resolve's opening move (plan D5) when legal and
 * ships as `scene` otherwise.
 */

/**
 * Plan D5 / FR-011: the mode is free and `encounterToStart` finds the encounter
 * unstarted (it has not run; spec 088) with no encounter running.
 */
export function legalEscalation(
  seed: TurnContext["seed"],
  p: SessionProjections,
  encounterId: string,
): boolean {
  if (p.tableMode.mode !== "free" || p.encounter !== null) return false;
  const enc = encounterToStart(
    seed,
    { tableMode: { to: "turn", encounterId, reason: "" } },
    "talk",
  );
  return enc !== undefined && !encounterRan(p, enc);
}

const RANK = { addressed: 3, mentioned: 2, overheard: 1 } as const;

const sha = (s: string): string => createHash("sha256").update(s).digest("hex");

/**
 * Step 1 (spec 066 FR-010): the readable posts after the latest DM read output (an `ai:dm`
 * narration, an `action.suggested` row or an `ai:dm` `ooc` talk row), up to the trigger.
 */
function readPosts(
  p: SessionProjections,
  triggerSeq: number | null,
): ReadablePost[] {
  const upTo = triggerSeq ?? p.throughSeq;
  let cutoff = 0;
  for (const e of p.transcript) {
    if (e.seq > upTo) break;
    if (isDmReadOutput(e)) cutoff = e.seq;
  }
  return readablePosts(p).filter((r) => r.seq > cutoff && r.seq <= upTo);
}

/** Merges per-post triggers: one entry per actor, the strongest kind wins. */
function mergeTriggers(all: CodeTrigger[][]): CodeTrigger[] {
  const best = new Map<string, CodeTrigger>();
  for (const t of all.flat()) {
    const cur = best.get(t.actorId);
    if (!cur || RANK[t.kind] > RANK[cur.kind]) best.set(t.actorId, t);
  }
  return [...best.values()];
}

const AI_NOTE = (summary: string, rationale: string) => ({
  summary: summary.slice(0, 200),
  rationale: rationale.slice(0, 2000),
});

export async function runTalkTurn(
  ctx: TurnContext,
  assembled: NodeOutputs["assemble"],
): Promise<TurnOutcome> {
  const p = assembled.projections;
  const calls: ModelCallRecord[] = [];
  // A reclaim after the opening move landed: the mode is already `turn`, so
  // read the posts as the first attempt saw them (mode free).
  const resumed = ctx.checkpoint.submissions.some((x) =>
    x.key.startsWith("director:"),
  );
  const posts = readPosts(
    resumed ? { ...p, tableMode: { mode: "free" } } : p,
    ctx.job.triggerSeq,
  );
  const perPost = posts.map((e) =>
    codeTriggers(e.text, assembled.snapshot, ctx.seed),
  );
  const triggers = mergeTriggers(perPost);
  const result: TalkResult = {
    posts: posts.map((e) => e.seq),
    codeTriggers: triggers,
    modelTriggers: [],
    outcome: "none",
    confirmItems: 0,
    answered: false,
    reason: "",
  };
  let nextJob: ResolveOutput["nextJob"] = null;
  const done = (shipped: boolean, companions: string[]): TurnOutcome => ({
    status: "talk",
    talk: result,
    companions,
    nextJob,
    shipped,
    calls,
  });
  const fenced = (): TurnOutcome => ({
    status: "failed",
    node: "narrate",
    error: { kind: "fenced", message: "the lease was lost" },
    calls,
  });

  // Rule 2 posts become confirm items in code, with no model call (FR-010, FR-011).
  const codeItems = codeItemsOf(p, posts, `sug-${ctx.job.id}`);
  const modelNeeded = needsModel(posts);

  // Step 2: no human-authored read post and no declared Intent means nothing to do.
  if (!modelNeeded && codeItems.length === 0) {
    result.reason = "no readable post needs a read";
    return done(false, []);
  }

  // Reclaim: a landed narration is never shipped twice.
  if (ctx.job.attempt > 1) {
    const landed = await findLandedNarration(ctx, 0);
    if (landed || ctx.checkpoint.narration?.shipped) {
      result.outcome = "reply";
      result.reason = "narration already landed before a reclaim";
      return done(true, []);
    }
  }

  const reachesCap = capReached(p, TALK_CHAIN_CAP - 1);
  const presentNpcIds = assembled.presentNpcIds.filter(
    (id) =>
      assembled.snapshot.actors.find((a) => a.id === id)?.lifeState !== "dead",
  );
  const free = p.tableMode.mode === "free";
  const secrets = dmOnlySeedText(ctx.seed).map((s) => s.toLowerCase());
  const view = playerFacingSeed(ctx.seed);
  const nameOfActor = (actor: string): string => {
    if (actor.startsWith("ai:companion:"))
      return (
        assembled.snapshot.actors.find(
          (a) => a.id === actor.slice("ai:companion:".length),
        )?.name ?? actor
      );
    return (
      p.party.find(
        (m) => m.controller.kind === "player" && m.controller.userId === actor,
      )?.name ?? "a player"
    );
  };
  const humans = p.party
    .filter((m) => m.controller.kind === "player")
    .map((m) => ({ id: m.characterId, name: m.name }));

  const ask = async () => {
    const prompt = buildReactPrompt({
      seed: view,
      roster: rosterOf(p.party),
      snapshot: assembled.snapshot,
      posts: posts.map((e) => ({
        seq: e.seq,
        speaker: nameOfActor(e.actor),
        text: e.text,
        rule: e.rule,
      })),
      humans,
      triggers,
      transcriptTail: assembled.transcriptTail,
      presentNpcIds,
      encounterIds: free
        ? ctx.seed.encounters
            .filter((e) => legalEscalation(ctx.seed, p, e.id))
            .map((e) => e.id)
        : [],
      reachesCap,
    });
    return callJson(ctx.deps, {
      purpose: PURPOSE_OF.narrate,
      promptVersion: PROMPT_VERSION,
      system: prompt.system,
      user: prompt.user,
      schema: ReactOutput,
      signal: ctx.signal,
    });
  };
  // Step 3: one react call (only when a model post needs it); a reclaim reuses the checkpointed output.
  let react: ReactOutput | null = ctx.checkpoint.react ?? null;
  if (!react && modelNeeded) {
    const first = await ask();
    calls.push(...first.calls);
    if (!first.ok)
      return { status: "failed", node: "narrate", error: first.error, calls };
    react = first.value;
    if (!(await ctx.deps.saveCheckpoint({ ...ctx.checkpoint, react })))
      return fenced();
  }
  const outcome = react?.outcome ?? "none";

  const checked = (text: string) =>
    checkNarration({
      slots: { restate: "", describe: text, ask: "" },
      rows: [],
      hasRoll: false,
      snapshot: assembled.snapshot,
      dmOnlyText: secrets,
      unmetSuccess: [],
      departedIds: [],
    });

  // Step 5: code checks (spec 103). No second call: a leak drops the sentence, a contradiction ships.
  let corrections: ReturnType<typeof correctionsFor> = [];
  let shownText = react?.text ?? "";
  let record: CheckRecord = {
    leak: [],
    contradiction: [],
    corrected: false,
    shippedProseSha256: sha(shownText),
  };
  const proseOutcome = outcome !== "none" && outcome !== "confirm";
  if (react && proseOutcome) {
    const found = checked(react.text);
    const drop = found
      .filter((i) => i.check === "leak" || i.kind === "digit")
      .map((i) => i.sentence);
    shownText = dropSentences(react.text, drop);
    corrections = correctionsFor(found);
    record = {
      leak: found.filter((i) => i.check === "leak"),
      contradiction: found.filter((i) => i.check === "contradiction"),
      corrected: drop.length > 0 || corrections.length > 0,
      shippedProseSha256: sha(shownText),
    };
  }
  const prose =
    react && proseOutcome
      ? !shownText.trim()
        ? "every sentence was dropped by the check (leak)"
        : outcome === "reply" && !presentNpcIds.includes(react.speaker ?? "")
          ? "the speaker is not a present character"
          : null
      : null;

  // FR-011: model items stamped, validated and filtered; code items first. At most four.
  const sugId = `sug-${ctx.job.id}`;
  const items: { itemId: string; text: string; intent: Intent }[] = [
    ...codeItems,
  ];
  if (react && outcome === "confirm") {
    for (const m of react.confirm) {
      if (items.length >= 4) break;
      const actorId =
        m.characterId ??
        p.party.find((x) => x.controller.kind === "player")?.characterId ??
        null;
      const member = p.party.find((x) => x.characterId === actorId);
      const snap = assembled.snapshot.actors.find(
        (a) => a.id === actorId || a.characterId === actorId,
      );
      if (
        !actorId ||
        member?.controller.kind !== "player" ||
        snap?.presence !== "present" ||
        (snap.lifeState !== null && snap.lifeState !== "conscious")
      )
        continue;
      const n = items.length + 1;
      const stamped = stampIntent(m.body, {
        id: `${sugId}.i${n}`,
        actor: { kind: "pc", id: actorId },
        source: "ai",
        commit: "declared",
      });
      if (!stamped.ok) continue;
      if (checked(m.text).length > 0) continue;
      items.push({ itemId: `i${n}`, text: m.text, intent: stamped.intent });
    }
  }

  const answerAsker = [...posts].reverse().find((e) => e.rule === 3)?.actor;
  let answerText = "";
  if (react?.answer && answerAsker) {
    const found = checked(react.answer);
    answerText = dropSentences(
      react.answer,
      found.map((i) => i.sentence),
    );
  }

  result.modelTriggers = react?.triggers ?? [];
  result.reason = react?.reason ?? "declared Intents confirmed in code";
  result.confirmItems = items.length;
  result.answered = answerText.trim() !== "";

  if (outcome === "none" || outcome === "confirm") {
    result.outcome =
      outcome === "confirm" && items.length > 0 ? "confirm" : "none";
  } else if (prose) {
    result.reason = prose;
    result.outcome = "none";
  } else result.outcome = outcome;

  const shipOnly = result.outcome === "none" || result.outcome === "confirm";
  let checkpoint = { ...ctx.checkpoint, ...(react ? { react } : {}) };

  // Step 4 and 6: a legal escalation runs resolve's opening move; else scene.
  if (result.outcome === "escalate" && react) {
    // A resumed run has no unstarted encounter left; resolve skips its landed rows.
    const encounterId = react.encounterId ?? "";
    if (!resumed && !legalEscalation(ctx.seed, p, encounterId)) {
      result.outcome = "scene";
    } else {
      const director: DirectorNodeOutput = {
        beat: { decision: "resolve" },
        tableMode: { to: "turn", encounterId, reason: react.reason },
        trackers: [],
        scene: { status: "continue" },
        pacing: { tension: "high", spotlight: null, beatId: null },
        goalNote: "",
        companionPrompts: [],
        overrides: [],
      };
      const opened = await resolve({
        ...ctx,
        checkpoint,
        results: {
          assemble: assembled,
          director,
          interpret: { readings: [] },
        },
      });
      calls.push(...opened.calls);
      if (!opened.ok)
        return {
          status: "failed",
          node: "resolve",
          error: opened.error,
          calls,
        };
      nextJob = opened.output.nextJob;
      checkpoint = {
        ...checkpoint,
        submissions: opened.output.submissions,
        lastSeq: opened.output.lastSeq,
      };
    }
  }

  // Spec 098 OQ-4: an escalation that started a fight names whose move it is. A reply has no State line.
  let text = shownText;
  if (result.outcome === "escalate") {
    const after = await ctx.deps.loadProjections(ctx.job.sessionId);
    const active = after.encounter?.activeCombatantId;
    if (active) {
      const name = after.engine.combatants[active]?.name ?? active;
      text = `${text}\n\nState: The fight begins. It is ${name}'s turn.`;
    }
  }

  // FR-013: answer, then confirm, each fenced with its own reclaim key.
  const ships: ReadShip[] = [];
  if (answerText.trim() && answerAsker) {
    ships.push({
      key: "answer:1",
      kind: "talk",
      build: () => ({
        kind: "talk",
        ...AI_NOTE(
          "Answer the question",
          "An ask_dm answer; no state changes.",
        ),
        talk: {
          text: answerText.slice(0, 4000),
          channel: "ooc",
          characterId: null,
        },
        visibility: answerAsker,
      }),
    });
  }
  if (items.length > 0) {
    const readSeq = Math.max(...posts.map((e) => e.seq));
    ships.push({
      key: "confirm:1",
      kind: "action.suggest",
      build: (): Proposal => ({
        kind: "action.suggest",
        ...AI_NOTE("Confirm the read", "The DM asks the players to confirm."),
        suggestion: { suggestionId: sugId, readSeq, items },
      }),
    });
  }
  if (ships.length > 0) {
    if (!(await ctx.deps.fence())) return fenced();
    const sent = await shipReadRows(ctx, checkpoint, ships);
    if (!sent.ok) {
      if (sent.error.detail?.code === "SUGGESTION_STALE") {
        result.outcome = "interrupted";
        result.confirmItems = 0;
        result.reason = "a later post arrived during the read";
        return done(false, []);
      }
      return { status: "failed", node: "resolve", error: sent.error, calls };
    }
    checkpoint = sent.checkpoint;
  }
  if (shipOnly) return done(false, []);

  // Step 7: ship one narration row, then name the companions to prompt.
  if (!(await ctx.deps.fence())) return fenced();
  const shipped = await submitNarration(
    ctx,
    {
      record,
      shipped: {
        prose: shownText,
        text,
        actionIds: [],
        corrections,
      },
    },
    checkpoint,
  );
  if (!shipped.ok)
    return { status: "failed", node: "resolve", error: shipped.error, calls };
  const companions =
    reachesCap || result.outcome === "escalate"
      ? []
      : (react?.companionPrompts ?? []).filter((id) =>
          p.party.some(
            (m) => m.characterId === id && m.controller.kind === "ai-companion",
          ),
        );
  return done(shipped.shipped, companions);
}

/** FR-011: each rule 2 post becomes one item in code, re-stamped to `<suggestionId>.i<n>`. */
function codeItemsOf(
  p: SessionProjections,
  posts: readonly ReadablePost[],
  sugId: string,
): { itemId: string; text: string; intent: Intent }[] {
  const out: { itemId: string; text: string; intent: Intent }[] = [];
  for (const post of posts) {
    if (post.rule !== 2 || out.length >= 4) continue;
    const view = p.intents.find((v) => v.id === post.intentId);
    if (!view || view.intent.actor.kind !== "pc") continue;
    const n = out.length + 1;
    const parsed = IntentSchema.safeParse({
      ...view.intent,
      id: `${sugId}.i${n}`,
      source: "ai",
      commit: "declared",
    });
    if (!parsed.success) continue;
    const text = (view.intent.text ?? toText(view.intent) ?? view.intent.kind)
      .slice(0, 500)
      .trim();
    out.push({
      itemId: `i${n}`,
      text: text || view.intent.kind,
      intent: parsed.data,
    });
  }
  return out;
}
