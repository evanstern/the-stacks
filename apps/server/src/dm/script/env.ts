import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { type Rng, seededRng } from "@the-stacks/dnd5e-engine";
import { type AiConfig, loadAiConfig } from "../../ai/config.js";
import type { AdapterFactory } from "../../ai/types.js";
import { createScriptedDm, loadDmScript } from "./load.js";

export const DM_SCRIPT_ENV = "DM_FAKE_SCRIPT";
export const DENIED_STACKS_ENVS: readonly string[] = ["default", "main", "dev"];

const NAME_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/;

/** `apps/server/dm-scripts`, resolved from the module so the working directory is irrelevant. */
const DEFAULT_SCRIPT_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "..",
  "dm-scripts",
);

export class DmScriptEnvError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DmScriptEnvError";
  }
}

export interface AiRuntime {
  aiConfig: AiConfig;
  adapters?: Record<string, AdapterFactory>;
  gateRng?: () => Rng;
  /** null when script mode is off. */
  scriptName: string | null;
  /** Counts for the boot log line; set only in script mode. */
  scriptCalls?: number;
  scriptDice?: number;
}

/** Script dice in order, then seededRng(seed). A face outside 1..sides throws. */
export function facesThenSeed(faces: readonly number[], seed = 0): Rng {
  const tail = seededRng(seed);
  let used = 0;
  return {
    rollDie(sides: number): number {
      if (used < faces.length) {
        const face = faces[used] as number;
        if (!Number.isInteger(face) || face < 1 || face > sides) {
          throw new Error(
            `scripted face ${face} at position ${used} is outside 1..${sides}`,
          );
        }
        used += 1;
        return face;
      }
      return tail.rollDie(sides);
    },
  };
}

function availableNames(dir: string): string[] {
  try {
    return readdirSync(dir)
      .filter((f) => f.endsWith(".json"))
      .map((f) => f.slice(0, -".json".length))
      .sort();
  } catch {
    return [];
  }
}

/** Reads the env. Throws DmScriptEnvError on a refused or bad value. */
export function createAiRuntime(
  env: NodeJS.ProcessEnv,
  opts: { scriptDir?: string } = {},
): AiRuntime {
  const raw = env[DM_SCRIPT_ENV];
  if (raw === undefined || raw === "") {
    return { aiConfig: loadAiConfig(env), scriptName: null };
  }

  const stacksEnv = env.STACKS_ENV;
  if (
    stacksEnv === undefined ||
    stacksEnv === "" ||
    DENIED_STACKS_ENVS.includes(stacksEnv)
  ) {
    throw new DmScriptEnvError(
      `${DM_SCRIPT_ENV} is set but STACKS_ENV is ${JSON.stringify(stacksEnv ?? null)}: script mode runs only on a worktree stack`,
    );
  }

  const name = raw;
  if (!NAME_PATTERN.test(name)) {
    throw new DmScriptEnvError(
      `${DM_SCRIPT_ENV}=${JSON.stringify(name)} is not a valid script name (${NAME_PATTERN})`,
    );
  }

  const dir = opts.scriptDir ?? DEFAULT_SCRIPT_DIR;
  const file = join(dir, `${name}.json`);
  let text: string;
  try {
    text = readFileSync(file, "utf8");
  } catch {
    throw new DmScriptEnvError(
      `${DM_SCRIPT_ENV}=${name}: no script ${name}.json; available: ${availableNames(dir).join(", ") || "(none)"}`,
    );
  }

  let script: ReturnType<typeof loadDmScript>;
  try {
    script = loadDmScript(JSON.parse(text));
  } catch (error) {
    const issue =
      error instanceof Error && "issues" in error
        ? (error as { issues: { path: unknown[]; message: string }[] })
            .issues[0]
        : undefined;
    const reason = issue
      ? `${issue.path.join(".") || "(root)"}: ${issue.message}`
      : (error as Error).message;
    throw new DmScriptEnvError(
      `${DM_SCRIPT_ENV}=${name}: ${name}.json is invalid: ${reason}`,
    );
  }

  const scripted = createScriptedDm(script);
  const rng = facesThenSeed(script.dice, 0);
  return {
    aiConfig: scripted.aiConfig,
    adapters: { fake: () => scripted.provider },
    gateRng: () => rng,
    scriptName: name,
    scriptCalls: script.calls.length,
    scriptDice: script.dice.length,
  };
}
