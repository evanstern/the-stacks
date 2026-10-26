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
import { rosterOf } from "../../src/dm/prompts/common.js";
import { buildNarratePrompt } from "../../src/dm/prompts/narrate.js";
import { createScriptedDm, loadDmScript } from "../../src/dm/script/load.js";
import { playerFacingSeed } from "../../src/dm/seed/views.js";
import { freeEventsThrough, makeCtx, projectDm } from "./helpers.js";

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
  const ctx = {
    ...ctx0,
    results: {
      assemble: assembled.output,
      director,
      resolve: resolved,
    },
  };
  return { scripted, ctx, assembled: assembled.output };
}

describe("narrate", () => {
  it("ships prose plus the rendered dice lines, with facts and no command in the prompt", async () => {
    const { ctx, scripted, assembled } = await setup([
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
    const { ctx, assembled } = await setup(["x"]);
    const out = await narrate(ctx);
    if (!out.ok) throw new Error("narrate failed");
    const prompt = buildNarratePrompt({
      seed: playerFacingSeed(ctx.seed),
      roster: rosterOf(assembled.projections.party),
      assembled,
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
});
