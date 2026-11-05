import type { SessionProjections } from "@the-stacks/session-model";
import { callJson } from "../pipeline/call.js";
import type { Node } from "../pipeline/context.js";
import { buildDirectorPrompt, PROMPT_VERSION } from "../prompts/director.js";
import { PURPOSE_OF } from "../purposes.js";
import type { SceneSeed } from "../seed/schema.js";
import type { BeatItem } from "./assemble.js";
import { DirectorOutput } from "./schemas.js";

/**
 * The director node (contracts/director.md): the model decides, code
 * enforces legality. An illegal decision is replaced by its fallback and
 * recorded as an override in the turn record. Nothing is written here;
 * resolve's Director group turns the legal decision into gate proposals.
 */

export type DirectorOverrideKind =
  | "hold"
  | "turn"
  | "free"
  | "tracker"
  | "scene-end"
  | "companionPrompts"
  | "arrivals";

export interface DirectorOverride {
  decision: DirectorOverrideKind;
  reason: string;
}

/** The legal decision plus the overrides applied to the model's. */
export type DirectorNodeOutput = DirectorOutput & {
  overrides: DirectorOverride[];
};

export interface LegalityInput {
  trigger: string;
  forceResolve: boolean;
  projections: SessionProjections;
  seed: SceneSeed;
  beat: readonly BeatItem[];
}

/** Characters controlled by an AI companion. */
export function aiCompanionIds(projections: SessionProjections): string[] {
  return projections.party
    .filter((m) => m.controller.kind === "ai-companion")
    .map((m) => m.characterId);
}

/** Seed NPC ids, in seed order, whose logged presence is `absent`. */
export function offstageNpcIds(
  projections: SessionProjections,
  seed: SceneSeed,
): string[] {
  return seed.npcs
    .filter((n) => projections.scenePresence[n.id]?.presence === "absent")
    .map((n) => n.id);
}

/** Seed encounters whose monsters are not yet in the engine state. */
export function runnableEncounterIds(
  projections: SessionProjections,
  seed: SceneSeed,
): string[] {
  return seed.encounters
    .filter(
      (e) =>
        !e.monsters.some((m) => projections.engine.combatants[m.combatantId]),
    )
    .map((e) => e.id);
}

const TEXT_CAP = 300;

/** Cuts text to the cap at the last space before it; a spaceless run is cut hard. */
export function capText(text: string): string {
  if (text.length <= TEXT_CAP) return text;
  const head = text.slice(0, TEXT_CAP);
  const space = head.lastIndexOf(" ");
  return (space > 0 ? head.slice(0, space) : head).trim();
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Caps `reason` on a plain object, returning a copy when it changes. */
function capReason(v: unknown): unknown {
  if (!isPlainObject(v) || typeof v.reason !== "string") return v;
  const reason = capText(v.reason);
  return reason === v.reason ? v : { ...v, reason };
}

/**
 * Director normalizer (contracts/director-output.md, row C4): cuts an
 * over-long `goalNote` and each over-long `reason` to the schema's 300-character
 * cap. Touches no number, id or discriminant and adds no default.
 */
export function normalizeDirector(json: unknown): unknown {
  if (!isPlainObject(json)) return json;
  const out: Record<string, unknown> = { ...json };
  if (typeof out.goalNote === "string") out.goalNote = capText(out.goalNote);
  out.beat = capReason(out.beat);
  out.tableMode = capReason(out.tableMode);
  out.scene = capReason(out.scene);
  if (Array.isArray(out.trackers)) out.trackers = out.trackers.map(capReason);
  for (const key of Object.keys(out)) {
    if (out[key] === undefined) delete out[key];
  }
  return out;
}

/** Applies director.md's legality table. Pure. */
export function legalizeDirector(
  model: DirectorOutput,
  input: LegalityInput,
): DirectorNodeOutput {
  const { projections, seed } = input;
  const overrides: DirectorOverride[] = [];
  const out: DirectorNodeOutput = {
    beat: model.beat,
    tableMode: model.tableMode,
    trackers: model.trackers,
    scene: model.scene,
    pacing: model.pacing,
    goalNote: model.goalNote,
    companionPrompts: model.companionPrompts,
    arrivals: model.arrivals ?? [],
    overrides,
  };
  const free = projections.tableMode.mode === "free";
  const companions = aiCompanionIds(projections);

  if (input.trigger === "scene-start") {
    // Scene start runs the setup group only; pacing is the one decision kept.
    if (model.beat.decision !== "resolve") {
      overrides.push({ decision: "hold", reason: "scene start never holds" });
    }
    if (model.tableMode.to !== "stay") {
      const kind = model.tableMode.to === "turn" ? "turn" : "free";
      overrides.push({ decision: kind, reason: "scene start keeps the mode" });
    }
    if (model.trackers.length > 0) {
      overrides.push({
        decision: "tracker",
        reason: "scene start creates trackers at zero",
      });
    }
    if (model.scene.status === "end") {
      overrides.push({
        decision: "scene-end",
        reason: "a scene cannot end as it starts",
      });
    }
    if (model.companionPrompts.length > 0) {
      overrides.push({
        decision: "companionPrompts",
        reason: "scene start prompts no companion",
      });
    }
    out.beat = { decision: "resolve" };
    out.tableMode = { to: "stay" };
    out.trackers = [];
    out.scene = { status: "continue" };
    out.companionPrompts = [];
    if ((model.arrivals ?? []).length > 0) {
      overrides.push({
        decision: "arrivals",
        reason: "scene start logs only the seed declaration",
      });
    }
    out.arrivals = [];
    return out;
  }

  // hold
  if (model.beat.decision === "hold") {
    const named = model.beat.companions;
    const busy = new Set(input.beat.map((b) => b.characterId));
    let reason: string | null = null;
    if (input.forceResolve) reason = "the beat was already held once";
    else if (!free) reason = "a hold is legal only in free mode";
    else if (named.some((id) => !companions.includes(id))) {
      reason = "a named companion is not an AI companion in the party";
    } else if (named.some((id) => busy.has(id))) {
      reason = "a named companion already has a committed action in the beat";
    }
    if (reason) {
      overrides.push({ decision: "hold", reason });
      out.beat = { decision: "resolve" };
    }
  }

  // table mode
  if (model.tableMode.to === "turn") {
    const runnable = runnableEncounterIds(projections, seed);
    if (!free) {
      overrides.push({ decision: "turn", reason: "already in turn mode" });
      out.tableMode = { to: "stay" };
    } else if (!runnable.includes(model.tableMode.encounterId)) {
      overrides.push({
        decision: "turn",
        reason: "the encounter is not a seed encounter that has yet to run",
      });
      out.tableMode = { to: "stay" };
    }
  } else if (model.tableMode.to === "free" && free) {
    overrides.push({ decision: "free", reason: "already in free mode" });
    out.tableMode = { to: "stay" };
  }

  // trackers
  const known = new Set(projections.trackers.map((t) => t.trackerId));
  const trackers = model.trackers.filter((t) => known.has(t.trackerId));
  if (trackers.length !== model.trackers.length) {
    overrides.push({
      decision: "tracker",
      reason: "a tracker advance named a tracker that does not exist",
    });
  }
  out.trackers = trackers;

  // scene end
  if (model.scene.status === "end" && projections.scene === null) {
    overrides.push({ decision: "scene-end", reason: "no scene is set" });
    out.scene = { status: "continue" };
  }

  // companion prompts
  if (model.companionPrompts.length > 0) {
    const legal = free
      ? model.companionPrompts.filter((id) => companions.includes(id))
      : [];
    if (legal.length !== model.companionPrompts.length) {
      overrides.push({
        decision: "companionPrompts",
        reason: free
          ? "a prompted character is not an AI companion in the party"
          : "companion prompts are legal only in free mode",
      });
    }
    out.companionPrompts = legal;
  }

  // arrivals
  const offstage = new Set(offstageNpcIds(projections, seed));
  const arrivals = [...new Set(model.arrivals ?? [])].filter((id) =>
    offstage.has(id),
  );
  if (arrivals.length !== (model.arrivals ?? []).length) {
    overrides.push({
      decision: "arrivals",
      reason: "an arrival named an NPC that is not offstage",
    });
  }
  out.arrivals = arrivals;
  return out;
}

export const director: Node<"director"> = async (ctx) => {
  const assembled = ctx.results.assemble;
  if (!assembled) {
    return {
      ok: false,
      node: "director",
      calls: [],
      error: { kind: "internal", message: "director ran before assemble" },
    };
  }
  const prompt = buildDirectorPrompt({
    ctx,
    assembled,
    aiCompanions: aiCompanionIds(assembled.projections).map((id) => {
      const m = assembled.projections.party.find((p) => p.characterId === id);
      return `${id} (${m?.name ?? id})`;
    }),
    runnableEncounterIds: runnableEncounterIds(assembled.projections, ctx.seed),
    offstageNpcs: offstageNpcIds(assembled.projections, ctx.seed).map((id) => {
      const n = ctx.seed.npcs.find((x) => x.id === id);
      return `NPC ${id} (${n?.name ?? id}, ${n?.identity.role ?? "npc"})`;
    }),
  });
  const result = await callJson(ctx.deps, {
    purpose: PURPOSE_OF.director,
    promptVersion: PROMPT_VERSION,
    system: prompt.system,
    user: prompt.user,
    schema: DirectorOutput,
    normalize: normalizeDirector,
    signal: ctx.signal,
  });
  if (!result.ok) {
    return {
      ok: false,
      node: "director",
      error: result.error,
      calls: result.calls,
    };
  }
  const output = legalizeDirector(result.value, {
    trigger: ctx.job.trigger,
    forceResolve: ctx.job.forceResolve,
    projections: assembled.projections,
    seed: ctx.seed,
    beat: assembled.beat,
  });
  if (output.overrides.length > 0) {
    ctx.deps.log({
      event: "dm.director.overrides",
      jobId: ctx.job.id,
      overrides: output.overrides.map((o) => o.decision),
    });
  }
  return { ok: true, node: "director", output, calls: result.calls };
};
