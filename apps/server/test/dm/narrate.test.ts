import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve as resolvePath } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { createGateway } from "../../src/ai/gateway.js";
import { memorySink } from "../../src/ai/usage.js";
import { assemble } from "../../src/dm/nodes/assemble.js";
import type { DirectorNodeOutput } from "../../src/dm/nodes/director.js";
import { narrate } from "../../src/dm/nodes/narrate.js";
import type { ResolveOutput } from "../../src/dm/nodes/resolve.js";
import {
  PROMPT_VERSION as AUDIT_VERSION,
  buildAuditPrompt,
} from "../../src/dm/prompts/audit.js";
import { rosterOf } from "../../src/dm/prompts/common.js";
import {
  buildNarratePrompt,
  PROMPT_VERSION as NARRATE_VERSION,
} from "../../src/dm/prompts/narrate.js";
import { createScriptedDm, loadDmScript } from "../../src/dm/script/load.js";
import { playerFacingSeed } from "../../src/dm/seed/views.js";
import { buildSnapshot } from "../../src/dm/snapshot/index.js";
import { freeEventsThrough, makeCtx, projectDm } from "./helpers.js";
import {
  combatant,
  EMPTY_RESOLVE_SNAPSHOT,
  greyhollowFight,
} from "./snapshot-fixtures.js";

const SRC = resolvePath(dirname(fileURLToPath(import.meta.url)), "../../src");

/** Value-import closure of a module: relative files and bare specifiers. */
function closure(entry: string): { files: Set<string>; bare: Set<string> } {
  const files = new Set<string>();
  const bare = new Set<string>();
  const visit = (file: string): void => {
    if (files.has(file)) return;
    files.add(file);
    const sf = ts.createSourceFile(
      file,
      readFileSync(file, "utf8"),
      ts.ScriptTarget.Latest,
      true,
    );
    const follow = (spec: string): void => {
      if (!spec.startsWith(".")) {
        bare.add(spec);
        return;
      }
      const base = join(dirname(file), spec).replace(/\.js$/, "");
      for (const c of [`${base}.ts`, join(base, "index.ts")]) {
        if (existsSync(c)) {
          visit(c);
          return;
        }
      }
    };
    for (const node of sf.statements) {
      if (
        ts.isImportDeclaration(node) &&
        ts.isStringLiteral(node.moduleSpecifier)
      ) {
        const clause = node.importClause;
        if (clause?.isTypeOnly) continue;
        const named = clause?.namedBindings;
        if (
          clause &&
          !clause.name &&
          named &&
          ts.isNamedImports(named) &&
          named.elements.length > 0 &&
          named.elements.every((e) => e.isTypeOnly)
        ) {
          continue;
        }
        follow(node.moduleSpecifier.text);
      } else if (
        ts.isExportDeclaration(node) &&
        node.moduleSpecifier &&
        ts.isStringLiteral(node.moduleSpecifier) &&
        !node.isTypeOnly
      ) {
        follow(node.moduleSpecifier.text);
      }
    }
  };
  visit(entry);
  return { files, bare };
}

describe("narrate import boundary (AC #6)", () => {
  const { files, bare } = closure(join(SRC, "dm/nodes/narrate.ts"));
  const rel = [...files].map((f) => f.slice(SRC.length + 1));

  it("walks a real closure", () => {
    expect(files.size).toBeGreaterThan(4);
    expect(rel).toContain("dm/facts.ts");
    expect(rel).toContain("dm/pipeline/call.ts");
  });

  it("imports no engine value", () => {
    expect([...bare]).not.toContain("@the-stacks/dnd5e-engine");
    expect(rel).not.toContain("dm/nodes/schemas.ts");
  });

  it("imports nothing from gate/ and no log writer", () => {
    expect(rel.filter((f) => f.startsWith("gate/"))).toEqual([]);
    expect(rel.filter((f) => f.startsWith("session/"))).toEqual([]);
    expect(rel.filter((f) => f.startsWith("events/"))).toEqual([]);
    expect(rel).not.toContain("dm/nodes/resolve.ts");
  });

  it("holds no RNG in its closure", () => {
    for (const f of files) {
      const text = readFileSync(f, "utf8");
      expect(text, f).not.toMatch(
        /Math\.random|randomInt|scriptedRng|seededRng/,
      );
    }
  });
});

const director: DirectorNodeOutput = {
  beat: { decision: "resolve" },
  tableMode: { to: "stay" },
  trackers: [],
  scene: { status: "continue" },
  pacing: { tension: "rising", spotlight: null, beatId: null },
  goalNote: "Keep the vault door in view.",
  companionPrompts: [],
  overrides: [],
};

const resolved: ResolveOutput = {
  submissions: [],
  actionResults: [],
  appendedRows: [],
  nextJob: null,
  chronicle: false,
  npcTurn: null,
  ...EMPTY_RESOLVE_SNAPSHOT,
  lastSeq: 0,
};

async function setup(responses: string[]) {
  const scripted = createScriptedDm(
    loadDmScript({
      v: 1,
      name: "narrate",
      dice: [],
      calls: responses.map((value) => ({
        purpose: "dm.narrate",
        respond: { type: "text", value },
      })),
    }),
  );
  const gateway = createGateway({
    config: scripted.aiConfig,
    sink: memorySink(),
    adapters: { fake: () => scripted.provider },
  });
  const events = freeEventsThrough("action.resolved");
  const ctx0 = makeCtx({
    deps: { gateway, loadProjections: async () => projectDm(events) },
  });
  const assembled = await assemble(ctx0);
  if (!assembled.ok) throw new Error("assemble failed");
  const snapshot = buildSnapshot(assembled.output.projections, ctx0.seed);
  const ctx = {
    ...ctx0,
    results: {
      assemble: assembled.output,
      director,
      resolve: { ...resolved, snapshot },
    },
  };
  return { scripted, ctx, assembled: assembled.output, snapshot };
}

describe("narrate", () => {
  it("ships prose plus the rendered dice lines, with facts and no command in the prompt", async () => {
    const { ctx, scripted, assembled, snapshot } = await setup([
      "The tumblers give way, and the vault door swings inward on a breath of cold air. Something moves inside.",
    ]);
    const out = await narrate(ctx);
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    const n = out.output;
    expect(n.skipped).toBe(false);
    expect(n.prose).not.toMatch(/[0-9]/);
    expect(n.diceLines.length).toBeGreaterThan(0);
    expect(n.text).toBe(`${n.prose}\n\n${n.diceLines.join("\n")}`);
    expect(n.actionIds).toEqual(["act-lockpick"]);
    expect(out.calls.map((c) => c.purpose)).toEqual(["dm.narrate"]);
    expect(scripted.remaining().calls["dm.narrate"]).toBe(0);

    const prompt = buildNarratePrompt({
      seed: playerFacingSeed(ctx.seed),
      roster: rosterOf(assembled.projections.party),
      assembled,
      snapshot,
      facts: n.facts,
      prior: null,
    });
    expect(prompt.user).toContain("act-lockpick");
    expect(prompt.user).toContain("applied");
    expect(prompt.user).not.toMatch(
      /gate\.submit|"type":"check\.roll"|execute\(/,
    );
    expect(prompt.system).toMatch(/NO digits/);
  });

  it("includes the previous text and issues when regenerating", async () => {
    const { ctx, assembled, snapshot } = await setup(["x"]);
    const out = await narrate(ctx);
    if (!out.ok) throw new Error("narrate failed");
    const prompt = buildNarratePrompt({
      seed: playerFacingSeed(ctx.seed),
      roster: rosterOf(assembled.projections.party),
      assembled,
      snapshot,
      facts: out.output.facts,
      prior: {
        prose: "Too long.",
        issues: [{ kind: "doctrine", detail: "Over the word limit." }],
      },
    });
    expect(prompt.user).toContain("Previous text: Too long.");
    expect(prompt.user).toContain("Over the word limit.");
  });

  it("returns a gateway error as a node failure", async () => {
    const { ctx } = await setup([]);
    const out = await narrate(ctx);
    expect(out.ok).toBe(false);
  });

  it("skips with no call when there is nothing to narrate", async () => {
    const { ctx } = await setup([]);
    const empty = makeCtx({
      deps: {
        loadProjections: async () =>
          projectDm(freeEventsThrough("action.declared")),
      },
    });
    const assembled = await assemble(empty);
    if (!assembled.ok) throw new Error("assemble failed");
    const out = await narrate({
      ...empty,
      results: { assemble: assembled.output, director, resolve: resolved },
    });
    expect(ctx).toBeTruthy();
    expect(out.ok && out.output.skipped).toBe(true);
    expect(out.calls).toEqual([]);
  });

  it("builds the v2 prompt: party, world, no-effect, on-hold, open question, events", async () => {
    const { ctx, assembled } = await setup(["x"]);
    const out = await narrate(ctx);
    if (!out.ok) throw new Error("narrate failed");
    const fight = greyhollowFight();
    fight.projections.engine.combatants["goblin-3"] = combatant(
      "goblin-3",
      "Goblin",
      { hp: { current: 0, max: 7, temp: 0 }, lifeState: "dead" },
    );
    const snapshot = buildSnapshot(fight.projections, fight.seed);
    const facts = {
      ...out.output.facts,
      events: [
        {
          kind: "encounter-started" as const,
          combatants: ["Tamsin Vale", "Goblin-3"],
          first: "Goblin-3",
        },
        { kind: "turn-advanced" as const, next: "Tamsin Vale" },
        { kind: "encounter-ended" as const },
        { kind: "combatant-joined" as const, name: "Snag" },
        { kind: "combatant-left" as const, name: "Odo" },
      ],
      clarify: [{ actionId: "act-lockpick", question: "Which door?" }],
      npcTurn: {
        name: "Goblin-3",
        outcomes: ["miss" as const],
        rolls: [
          {
            name: "Goblin-3",
            reason: "jabs at Tamsin with its dagger",
            expression: "1d20+4",
            shown: "9",
            total: 9,
            against: null,
            outcome: "miss" as const,
            autoFail: false,
            target: "Tamsin Vale",
          },
        ],
        changes: [],
      },
    };
    const prompt = buildNarratePrompt({
      seed: playerFacingSeed(ctx.seed),
      roster: rosterOf(assembled.projections.party),
      assembled,
      snapshot,
      facts,
      prior: null,
    });
    expect(NARRATE_VERSION).toBe("dm.narrate-v4");
    expect(prompt.user).toContain("## Party (player characters)");
    expect(prompt.user).toContain("Tamsin Vale (party, human player)");
    expect(prompt.user).toContain("Brother Odo (party, AI companion)");
    expect(prompt.user).toContain("## Other characters (the world)");
    // A goblin that died on an earlier turn still reads as dead (T021).
    expect(prompt.user).toContain("Goblin (monster): dead");
    expect(prompt.user).toContain(
      "jabs at Tamsin with its dagger target Tamsin Vale",
    );
    expect(prompt.user).toContain(
      "Event: a fight starts (Tamsin Vale, Goblin-3); Goblin-3 acts first",
    );
    expect(prompt.user).toContain("Event: Tamsin Vale acts next");
    expect(prompt.user).toContain("Event: the fight ends");
    expect(prompt.user).toContain("Event: Snag joins");
    expect(prompt.user).toContain("Event: Odo leaves");
    expect(prompt.user).toContain(
      "on hold (the intent is unclear; nothing happened yet)",
    );
    expect(prompt.system).toContain(
      "No rules effect means nothing was rolled.",
    );
    expect(prompt.system).toContain(
      "When a foe's attack misses, its grab fails, or a party member succeeds on a save against it, describe only what the foe did.",
    );
    expect(prompt.system).toContain(
      "Never show a wound on a party member unless a fact records damage to them.",
    );
    const sys = prompt.system;
    expect(sys.indexOf("When a foe's attack misses")).toBeGreaterThan(
      sys.indexOf("No rules effect means nothing was rolled."),
    );
    expect(sys.indexOf("When a foe's attack misses")).toBeLessThan(
      sys.indexOf("When an intent is unclear"),
    );
    expect(prompt.system).toContain(
      "end with one short open question in your own words",
    );
    expect(prompt.system).toContain("Never offer options.");
    expect(prompt.system).toContain("Cover every Event line.");
    expect(prompt.system).toContain("companions speak for themselves");
  });

  it("drops NPCs that S1 reads absent from the beat's NPC list (spec 050)", async () => {
    const { ctx, snapshot } = await setup(["x"]);
    const s1 = {
      ...snapshot,
      actors: snapshot.actors.map((a) =>
        a.id === "pell" ? { ...a, presence: "absent" as const } : a,
      ),
    };
    expect(s1.actors.find((a) => a.id === "snag")?.presence).toBe("present");
    const out = await narrate({
      ...ctx,
      results: {
        ...ctx.results,
        director: {
          ...director,
          pacing: { ...director.pacing, beatId: "reed-camp" },
        },
        resolve: { ...resolved, snapshot: s1 },
      },
    });
    if (!out.ok) throw new Error("narrate failed");
    expect(out.output.facts.presentNpcs.map((n) => n.id)).toEqual(["snag"]);
  });

  it("builds the v2 audit prompt: party section and the five statements", async () => {
    const { ctx } = await setup(["x"]);
    const out = await narrate(ctx);
    if (!out.ok) throw new Error("narrate failed");
    const fight = greyhollowFight();
    const snapshot = buildSnapshot(fight.projections, fight.seed);
    const p = buildAuditPrompt({
      facts: out.output.facts,
      snapshot,
      prose: "Prose.",
    });
    expect(AUDIT_VERSION).toBe("dm.audit-v3");
    expect(p.user).toContain("## Party (player characters)");
    expect(p.user).toContain("Brother Odo (party, AI companion)");
    expect(p.user).toContain("## Other characters (the world)");
    expect(p.system).toContain("beyond their declared action");
    expect(p.system).toContain("never `player-agency`");
    expect(p.system).toContain("No rules effect means nothing was rolled");
    expect(p.system).toContain("ending on that open question is correct");
    expect(p.system).toContain("Code checks length; do not report length.");
    expect(p.system).toContain("Report craft concerns as `doctrine`");
  });
});
