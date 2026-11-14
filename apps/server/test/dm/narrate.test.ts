import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve as resolvePath } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { createGateway } from "../../src/ai/gateway.js";
import { memorySink } from "../../src/ai/usage.js";
import { agencyRule } from "../../src/dm/doctrine/doctrine.js";
import { composeReply } from "../../src/dm/fact-sheet.js";
import { assemble } from "../../src/dm/nodes/assemble.js";
import type { DirectorNodeOutput } from "../../src/dm/nodes/director.js";
import {
  dropStockEnding,
  narrate,
  withholdRefusedInputs,
} from "../../src/dm/nodes/narrate.js";
import type { ResolveOutput } from "../../src/dm/nodes/resolve.js";
import { rosterOf } from "../../src/dm/prompts/common.js";
import {
  buildNarratePrompt,
  factEntries,
  PROMPT_VERSION as NARRATE_VERSION,
} from "../../src/dm/prompts/narrate.js";
import { createScriptedDm, loadDmScript } from "../../src/dm/script/load.js";
import { playerFacingSeed } from "../../src/dm/seed/views.js";
import { buildSnapshot } from "../../src/dm/snapshot/index.js";
import {
  emptyCheckpoint,
  freeEventsThrough,
  makeCtx,
  projectDm,
} from "./helpers.js";
import {
  combatant,
  EMPTY_RESOLVE_SNAPSHOT,
  greyhollowFight,
} from "./snapshot-fixtures.js";
import { stage, stages } from "./world.js";

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
    expect(rel).toContain("dm/fact-sheet.ts");
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
  it("builds a sheet, parses tagged slots and ships the template (spec 098)", async () => {
    const { ctx } = await setup([
      "[restate] Ana means to pick the lock.\n[describe] The tumblers give way and the door swings inward.\n[ask] Who goes in first?",
    ]);
    const out = await narrate(ctx);
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    const n = out.output;
    expect(n.sheet.slots).toEqual(["restate", "describe"]);
    expect(n.slots).toEqual({
      restate: "Ana means to pick the lock.",
      describe: "The tumblers give way and the door swings inward.",
      ask: "",
    });
    expect(n.text).toBe(
      [
        "Ana means to pick the lock.",
        "The tumblers give way and the door swings inward.",
        `${n.diceLines.join("\n")}\n${n.sheet.state}`,
      ].join("\n\n"),
    );
  });

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
    expect(n.text).toBe(
      `${n.prose}\n\n${n.diceLines.join("\n")}\n${n.sheet.state}`,
    );
    expect(n.actionIds).toEqual(["act-lockpick"]);
    expect(out.calls.map((c) => c.purpose)).toEqual(["dm.narrate"]);
    expect(scripted.remaining().calls["dm.narrate"]).toBe(0);

    const prompt = buildNarratePrompt({
      seed: playerFacingSeed(ctx.seed),
      roster: rosterOf(assembled.projections.party),
      assembled,
      snapshot,
      facts: n.facts,
    });
    expect(prompt.user).toContain("act-lockpick");
    expect(prompt.user).toContain("applied");
    expect(prompt.user).not.toMatch(
      /gate\.submit|"type":"check\.roll"|execute\(/,
    );
    expect(prompt.system).toMatch(/NO digits/);
    expect(prompt.system).toContain("Describe every Direct action line");
    const withDeed = buildNarratePrompt({
      seed: playerFacingSeed(ctx.seed),
      roster: rosterOf(assembled.projections.party),
      assembled,
      snapshot,
      facts: {
        ...n.facts,
        direct: [
          {
            name: "Tamsin Vale",
            deed: { text: "/search #ferry-house", stopped: null },
            rolls: [],
            outcomes: [],
            changes: [],
          },
        ],
      },
    });
    expect(withDeed.user).toContain(
      "Direct action: Tamsin Vale: /search #ferry-house",
    );
  });

  it("lists the first beat's present NPCs at scene start, whatever the Director's beat", async () => {
    const { ctx } = await setup(["x", "x", "x", "x"]);
    const ids = async (trigger: "scene-start" | "commit", beatId: string) => {
      const out = await narrate({
        ...ctx,
        job: { ...ctx.job, trigger },
        results: {
          ...ctx.results,
          director: {
            ...director,
            pacing: { ...director.pacing, beatId },
          },
        },
      });
      if (!out.ok) throw new Error("narrate failed");
      return out.output.facts.presentNpcs.map((n) => n.id);
    };
    expect(await ids("scene-start", "ferry-house")).toEqual(["wenna"]);
    expect(await ids("scene-start", "reed-camp")).toEqual(["wenna"]);
    const gone = await narrate({
      ...ctx,
      job: { ...ctx.job, trigger: "scene-start" },
      results: {
        ...ctx.results,
        resolve: {
          ...resolved,
          snapshot: {
            ...ctx.results.resolve?.snapshot,
            actors: (ctx.results.resolve?.snapshot.actors ?? []).map((a) =>
              a.id === "wenna" ? { ...a, presence: "absent" as const } : a,
            ),
          },
        },
      },
    });
    if (!gone.ok) throw new Error("narrate failed");
    expect(gone.output.facts.presentNpcs).toEqual([]);
    const commit = await ids("commit", "ferry-house");
    const beat = ctx.seed.beats.find((b) => b.id === "ferry-house");
    expect(commit).toEqual((beat?.npcIds ?? []).filter((id) => id === "wenna"));
  });

  it("ships empty slots, not a failure, when the call errors (spec 103)", async () => {
    const { ctx } = await setup([]);
    const out = await narrate(ctx);
    if (!out.ok) throw new Error("narrate failed");
    expect(out.output.narrateError).toBe("gateway");
    expect(out.output.slots.describe).toBe("");
    expect(out.output.text).toBe(
      composeReply(out.output.slots, out.output.sheet),
    );
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
    });
    expect(NARRATE_VERSION).toBe("dm.narrate-v25");
    expect(prompt.system).toContain(
      "A refused action did not happen: no roll and no result. Never show it succeed, fail or land, and never show anyone react to its result.",
    );
    expect(
      factEntries({
        ...facts,
        actions: [
          {
            actionId: "a9",
            characterName: "Odo",
            text: "parleys",
            outcome: "refused",
            refusalCode: "UNKNOWN_COMBATANT",
            rolls: [],
            outcomes: [],
            changes: [],
            followUps: [],
          },
        ],
      }),
    ).toContain(
      'Action a9 by Odo: "parleys" -> refused (refused: UNKNOWN_COMBATANT): it did not happen; nothing was rolled and nothing changed',
    );
    expect(prompt.system).toContain(
      "A roll's band and outcome are settled. A success means the attempted task happens. Deliver the outcome and any learned fact plainly in the prose; invent no other.",
    );
    expect(
      factEntries({
        ...facts,
        held: [{ name: "Brother Odo", text: "Odo casts Cure Wounds." }],
      }),
    ).toContain(
      `Waiting: "Odo casts Cure Wounds." waits for Brother Odo's turn; nothing has happened yet.`,
    );
    const banded = factEntries({
      ...facts,
      actions: [
        {
          actionId: "a1",
          characterName: "Odo",
          text: "offers the toll",
          outcome: "applied",
          refusalCode: null,
          rolls: [
            {
              name: "Odo",
              reason: "Odo offers the toll",
              expression: "1d20+3",
              shown: "7",
              total: 10,
              against: { kind: "DC" as const, value: 15 },
              outcome: "failure" as const,
              autoFail: false,
              target: null,
              band: "severe-failure" as const,
              margin: -5,
              consequence: "Snag spurns the toll.",
              revealed: "The toll was a ruse.",
            },
          ],
          outcomes: ["failure" as const],
          changes: [],
          followUps: [],
        },
      ],
    });
    expect(banded.join("\n")).toContain(
      "roll: Odo offers the toll -> severe failure; outcome (settled): Snag spurns the toll.\n  learned (settled): The toll was a ruse.",
    );
    expect(prompt.system).toContain(
      "A not-yet-attempted step has not happened, in this beat or an earlier one. Stop before it; never show it start or done.",
    );
    expect(prompt.system).toContain(agencyRule("narrate"));
    expect(prompt.system).toContain(
      "Never show the party member choosing a defence: no dodge, no duck, no twist that times the blow, no step aside.",
    );
    const reflexFacts = {
      ...facts,
      involuntary: [
        {
          name: "Tamsin Vale",
          trigger: "avoid" as const,
          detail: "missed by Snag",
        },
        {
          name: "Brother Odo",
          trigger: "stagger" as const,
          detail: "critical hit by Snag",
        },
      ],
    };
    const reflexNarrate = buildNarratePrompt({
      seed: playerFacingSeed(ctx.seed),
      roster: rosterOf(assembled.projections.party),
      assembled,
      snapshot,
      facts: reflexFacts,
    }).user;
    for (const u of [reflexNarrate]) {
      expect(u).toContain(
        "Reflex: Tamsin Vale may flinch as it misses (missed by Snag)",
      );
      expect(u).toContain(
        "Reflex: Brother Odo may stagger (critical hit by Snag)",
      );
    }
    const opening = buildNarratePrompt({
      seed: playerFacingSeed(ctx.seed),
      roster: rosterOf(assembled.projections.party),
      assembled,
      snapshot,
      facts: { ...facts, trigger: "scene-start" },
    }).user;
    expect(opening).toContain(
      "The opening shows the place and what the party finds. It never moves, leads or voices a party member.",
    );
    expect(prompt.system).toContain(
      "Name a character as dead or unconscious only when a fact or the state sections say so; when a fact says so, say so.",
    );
    expect(prompt.system).toContain(
      "A dead, unconscious, stable or absent character does not act or speak. Count only what the state sections show.",
    );
    expect(prompt.system).not.toContain("only when a fact says so;");
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
      "When a foe's attack misses a party member, its grab fails, or a party member succeeds on a save against it, tell it from the foe's side: the blow goes wide, glances off armour, finds only air.",
    );
    expect(prompt.system).toContain(
      "Never show a wound unless a fact records damage.",
    );
    const sys = prompt.system;
    expect(sys.indexOf("When a foe's attack misses")).toBeGreaterThan(
      sys.indexOf("No rules effect means nothing was rolled."),
    );
    expect(sys.indexOf("When a foe's attack misses")).toBeLessThan(
      sys.indexOf("When an intent is unclear"),
    );
    expect(prompt.system).toContain(
      "describe the moment and stop. Code asks the question.",
    );
    expect(prompt.system).toContain(
      'Never end on "What do you do?" or an either-or question.',
    );
    expect(prompt.system).toContain("Cover every Event line.");
    expect(prompt.system).toContain("AI companions included");
  });

  describe("open followUps from earlier beats (spec 079, US4)", () => {
    async function laterBeat(followUps: string[]) {
      const base = await setup(["x"]);
      const reading = { actionId: "act-lockpick", followUps };
      const out = await narrate({
        ...base.ctx,
        deps: {
          ...base.ctx.deps,
          loadPriorTurns: async () => [
            {
              jobId: "earlier",
              checkpoint: {
                ...emptyCheckpoint(),
                interpret: { readings: [reading] } as never,
              },
            },
          ],
        },
        results: {
          ...base.ctx.results,
          assemble: { ...base.assembled, beat: [] },
          resolve: {
            ...resolved,
            snapshot: base.snapshot,
            diff: { fromSeq: 0, toSeq: 1, stage: [], actors: [] },
          },
        },
      });
      if (!out.ok) throw new Error("narrate failed");
      return out.output;
    }

    it("carries a member's earlier followUp into a later beat's facts", async () => {
      const n = await laterBeat(["Search the door."]);
      expect(n.facts.openFollowUps?.map((f) => f.text)).toEqual([
        "Search the door.",
      ]);
      expect(factEntries(n.facts).join("\n")).toContain(
        "Earlier beat, not yet attempted: ",
      );
    });

    it("carries nothing without prior turns", async () => {
      const base = await setup(["x"]);
      const out = await narrate({
        ...base.ctx,
        results: {
          ...base.ctx.results,
          assemble: { ...base.assembled, beat: [] },
        },
      });
      if (!out.ok) throw new Error("narrate failed");
      expect(out.output.facts.openFollowUps).toBeUndefined();
    });
  });

  describe("input check on follow-ups and goalNote (spec 051, OQ-2)", () => {
    async function withheldRun(goalNote: string, followUps: string[] = []) {
      const base = await setup(["x"]);
      // goblin-3 ("Goblin lookout") died on an earlier turn: dead in S1,
      // absent from the diff.
      const fight = greyhollowFight();
      const snapshot = buildSnapshot(fight.projections, fight.seed);
      for (const a of snapshot.actors) {
        if (a.id === "goblin-3") a.lifeState = "dead";
      }
      const out = await narrate({
        ...base.ctx,
        results: {
          ...base.ctx.results,
          director: { ...director, goalNote },
          interpret: {
            readings: [
              stages("act-lockpick", [stage({ kind: "check" })], {
                followUps,
              }) as never,
            ],
          },
          resolve: {
            ...resolved,
            snapshot,
            diff: { fromSeq: 0, toSeq: 1, stage: [], actors: [] },
          },
        },
      });
      if (!out.ok) throw new Error("narrate failed");
      const prompt = buildNarratePrompt({
        seed: playerFacingSeed(base.ctx.seed),
        roster: rosterOf(base.assembled.projections.party),
        assembled: base.assembled,
        snapshot,
        facts: out.output.facts,
      });
      return { n: out.output, prompt };
    }

    it("withholds a follow-up that names a dead actor acting", async () => {
      const { n, prompt } = await withheldRun("Keep the vault door in view.", [
        "Snag dies in the mud.",
        "Search the door.",
      ]);
      expect(n.facts.actions[0]?.followUps).toEqual(["Search the door."]);
      expect(prompt.user).toContain("  not yet attempted: Search the door.");
      expect(prompt.user).not.toContain("dies in the mud");
      expect(n.withheld).toHaveLength(1);
      expect(n.withheld[0]?.detail).toMatch(
        /^withheld follow-up for act-lockpick: /,
      );
      expect(prompt.system).toContain(
        "A not-yet-attempted step has not happened, in this beat or an earlier one.",
      );
    });

    it("drops a monster line the state refutes and keeps a clean one (specs/081)", async () => {
      const base = await setup(["x"]);
      const fight = greyhollowFight();
      const snapshot = buildSnapshot(fight.projections, fight.seed);
      for (const a of snapshot.actors) {
        if (a.id === "goblin-3") a.lifeState = "dead";
      }
      const state = { snapshot, dmOnlyText: [] as string[] };
      const out = await narrate(base.ctx);
      if (!out.ok) throw new Error("narrate failed");
      const withSay = (say: string) => ({
        ...out.output.facts,
        npcTurn: {
          name: "Snag",
          rolls: [],
          outcomes: [],
          changes: [],
          plan: { intent: "talk", reasons: [], say, held: false },
        },
      });
      const bad = withholdRefusedInputs(
        withSay("Snag dies in the mud."),
        state,
      );
      expect(bad.facts.npcTurn?.plan?.say).toBeNull();
      expect(bad.withheld[0]?.detail).toMatch(/withheld monster line: /);
      const ok = withholdRefusedInputs(
        withSay("Hold your fire, friends!"),
        state,
      );
      expect(ok.facts.npcTurn?.plan?.say).toBe("Hold your fire, friends!");
      expect(ok.withheld).toEqual([]);
    });

    it("blanks a refused goalNote", async () => {
      const { n, prompt } = await withheldRun(
        "Two goblins are down; press the survivors.",
      );
      expect(n.facts.director.goalNote).toBe("");
      expect(prompt.user).toMatch(/Private note: (\n|$)/);
      expect(prompt.user).not.toContain("press the survivors");
      expect(n.withheld).toHaveLength(1);
      expect(n.withheld[0]?.detail).toMatch(/^withheld goalNote: /);
    });

    it("withholds a goalNote that states a true count (TASK-0214)", async () => {
      const base = await setup(["x"]);
      const out = await narrate(base.ctx);
      if (!out.ok) throw new Error("narrate failed");
      const fight = greyhollowFight();
      const snapshot = buildSnapshot(fight.projections, fight.seed);
      for (const a of snapshot.actors) {
        if (a.id === "goblin-2" || a.id === "goblin-3") a.lifeState = "dead";
      }
      const state = { snapshot, dmOnlyText: [] as string[] };
      const note = "Two goblins down; Snag eyes a bargain.";
      const r = withholdRefusedInputs(
        {
          ...out.output.facts,
          director: { ...out.output.facts.director, goalNote: note },
        },
        state,
      );
      expect(r.facts.director.goalNote).toBe("");
      expect(r.withheld).toHaveLength(1);
      expect(r.withheld[0]?.kind).toBe("dm-only-text");
      expect(r.withheld[0]?.detail).toMatch(
        /^withheld goalNote: it states a count/,
      );
    });

    it("passes a clean note unchanged", async () => {
      const { n } = await withheldRun("Keep the vault door in view.");
      expect(n.withheld).toEqual([]);
      expect(n.facts.director.goalNote).toBe("Keep the vault door in view.");
    });
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

  it("narrate prompt carries the turn lines and the v25 version", async () => {
    const { ctx } = await setup(["x"]);
    const out = await narrate(ctx);
    if (!out.ok) throw new Error("narrate failed");
    const fight = greyhollowFight();
    const snapshot = buildSnapshot(fight.projections, fight.seed);
    expect(NARRATE_VERSION).toBe("dm.narrate-v25");
    const turnFacts = {
      ...out.output.facts,
      turn: { actor: "Snag", next: "Kestrel" },
    };
    const narrateUser = buildNarratePrompt({
      seed: playerFacingSeed(ctx.seed),
      roster: rosterOf(fight.projections.party),
      assembled: (await setup(["x"])).assembled,
      snapshot,
      facts: turnFacts,
    }).user;
    expect(narrateUser).toContain("Turn: Snag acts in this beat.");
    expect(narrateUser).toContain(
      "Next: Kestrel acts after this beat and has not acted yet.",
    );
  });
});

describe("dropStockEnding (TASK-0214)", () => {
  it("drops a trailing What do you do? after a sentence end", () => {
    expect(dropStockEnding("The door groans open. What do you do?")).toBe(
      "The door groans open.",
    );
    expect(dropStockEnding('The door groans open. "What do you all do?"')).toBe(
      "The door groans open.",
    );
  });
  it("leaves prose with no earlier sentence, other endings and mid-prose phrases", () => {
    expect(dropStockEnding("What do you do?")).toBe("What do you do?");
    expect(dropStockEnding("The door opens. What does Tamsin do?")).toBe(
      "The door opens. What does Tamsin do?",
    );
    expect(dropStockEnding("What do you do? The door opens.")).toBe(
      "What do you do? The door opens.",
    );
  });
});
