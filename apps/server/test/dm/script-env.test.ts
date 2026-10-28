import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { seededRng } from "@the-stacks/dnd5e-engine";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createGateway } from "../../src/ai/gateway.js";
import type { ChatEvent } from "../../src/ai/types.js";
import { memorySink } from "../../src/ai/usage.js";
import {
  createAiRuntime,
  DENIED_STACKS_ENVS,
  DM_SCRIPT_ENV,
  facesThenSeed,
} from "../../src/dm/script/env.js";

const VALID = {
  v: 1,
  name: "valid",
  dice: [3, 14],
  calls: [
    {
      purpose: "dm.director",
      respond: { type: "json", value: { pace: "slow" } },
    },
  ],
};

let dir: string;

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "dm-scripts-"));
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "valid.json"), JSON.stringify(VALID));
  writeFileSync(join(dir, "invalid.json"), JSON.stringify({ v: 2 }));
});

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

async function collect(it: AsyncIterable<ChatEvent>): Promise<ChatEvent[]> {
  const out: ChatEvent[] = [];
  for await (const e of it) out.push(e);
  return out;
}

const GOOD_AI = {
  AI_PROVIDERS: JSON.stringify({ p: { kind: "fake", baseUrl: "http://x" } }),
  AI_PURPOSES: JSON.stringify({
    embedding: { provider: "p", model: "m", op: "embed" },
  }),
};

describe("createAiRuntime", () => {
  it("returns the loadAiConfig result when the value is unset", () => {
    const rt = createAiRuntime({ ...GOOD_AI }, { scriptDir: dir });
    expect(rt.scriptName).toBeNull();
    expect(rt.adapters).toBeUndefined();
    expect(rt.gateRng).toBeUndefined();
    expect(Object.keys(rt.aiConfig.providers)).toEqual(["p"]);
  });

  it("treats an empty value as unset", () => {
    const rt = createAiRuntime(
      { ...GOOD_AI, [DM_SCRIPT_ENV]: "" },
      { scriptDir: dir },
    );
    expect(rt.scriptName).toBeNull();
    expect(rt.adapters).toBeUndefined();
  });

  it("denies the listed STACKS_ENV values", () => {
    expect([...DENIED_STACKS_ENVS]).toEqual(["default", "main", "dev"]);
  });

  for (const stacksEnv of [undefined, "", "default", "main", "dev"]) {
    it(`refuses script mode when STACKS_ENV is ${JSON.stringify(stacksEnv)}`, () => {
      const env: NodeJS.ProcessEnv = { [DM_SCRIPT_ENV]: "valid" };
      if (stacksEnv !== undefined) env.STACKS_ENV = stacksEnv;
      expect(() => createAiRuntime(env, { scriptDir: dir })).toThrow(
        /DM_FAKE_SCRIPT/,
      );
    });
  }

  it("returns the scripted config on a worktree stack", () => {
    const rt = createAiRuntime(
      { [DM_SCRIPT_ENV]: "valid", STACKS_ENV: "task-158" },
      { scriptDir: dir },
    );
    expect(rt.scriptName).toBe("valid");
    expect(rt.adapters).toBeDefined();
    expect(typeof rt.adapters?.fake).toBe("function");
    expect(rt.gateRng).toBeDefined();
    expect(rt.aiConfig.purposes["dm.director"]?.provider).toBe("scripted");
  });

  it("rejects a bad name", () => {
    for (const bad of ["../x", "X", "   "]) {
      expect(() =>
        createAiRuntime(
          { [DM_SCRIPT_ENV]: bad, STACKS_ENV: "task-158" },
          { scriptDir: dir },
        ),
      ).toThrow();
    }
  });

  it("rejects an unknown name and lists the available names", () => {
    expect(() =>
      createAiRuntime(
        { [DM_SCRIPT_ENV]: "nope", STACKS_ENV: "task-158" },
        { scriptDir: dir },
      ),
    ).toThrow(/valid/);
  });

  it("rejects a file that fails the schema, naming the file", () => {
    expect(() =>
      createAiRuntime(
        { [DM_SCRIPT_ENV]: "invalid", STACKS_ENV: "task-158" },
        { scriptDir: dir },
      ),
    ).toThrow(/invalid\.json/);
  });

  it("does not call loadAiConfig in script mode", () => {
    const rt = createAiRuntime(
      {
        [DM_SCRIPT_ENV]: "valid",
        STACKS_ENV: "task-158",
        AI_PROVIDERS: "{not json",
      },
      { scriptDir: dir },
    );
    expect(rt.scriptName).toBe("valid");
  });
});

describe("script-mode gateway", () => {
  it("serves the script, then fails loudly on an empty purpose, and embeds hash vectors", async () => {
    const rt = createAiRuntime(
      { [DM_SCRIPT_ENV]: "valid", STACKS_ENV: "task-158" },
      { scriptDir: dir },
    );
    const gateway = createGateway({
      config: rt.aiConfig,
      sink: memorySink(),
      adapters: rt.adapters,
    });
    const first = await collect(
      gateway.chat({
        purpose: "dm.director",
        messages: [{ role: "user", content: "go" }],
      }),
    );
    expect(first.find((e) => e.type === "text")).toMatchObject({
      text: JSON.stringify({ pace: "slow" }),
    });
    expect(first.at(-1)?.type).toBe("done");

    const second = await collect(
      gateway.chat({
        purpose: "dm.director",
        messages: [{ role: "user", content: "again" }],
      }),
    );
    const err = second.find((e) => e.type === "error");
    expect(err).toMatchObject({
      kind: "config",
      message: expect.stringContaining("unscripted call for dm.director"),
    });

    const emb = await gateway.embed({
      purpose: "embedding",
      texts: ["a", "b"],
    });
    expect(emb.vectors).toHaveLength(2);
    expect(emb.vectors[0]?.vector).toHaveLength(1024);
  });
});

describe("facesThenSeed", () => {
  it("serves faces in order, then matches seededRng(0)", () => {
    const rng = facesThenSeed([3, 14], 0);
    expect(rng.rollDie(6)).toBe(3);
    expect(rng.rollDie(20)).toBe(14);
    const ref = seededRng(0);
    for (let i = 0; i < 10; i++) {
      expect(rng.rollDie(20)).toBe(ref.rollDie(20));
    }
  });

  it("throws on a face outside 1..sides", () => {
    expect(() => facesThenSeed([21], 0).rollDie(20)).toThrow();
    expect(() => facesThenSeed([0], 0).rollDie(20)).toThrow();
  });

  it("shares one instance from gateRng()", () => {
    const rt = createAiRuntime(
      { [DM_SCRIPT_ENV]: "valid", STACKS_ENV: "task-158" },
      { scriptDir: dir },
    );
    const a = rt.gateRng?.();
    const b = rt.gateRng?.();
    expect(a).toBe(b);
    expect(a?.rollDie(6)).toBe(3);
    expect(b?.rollDie(20)).toBe(14);
  });
});
