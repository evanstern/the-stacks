import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { EngineCommandSchema, RefusalCodeSchema } from "../src/index.js";

const here = dirname(fileURLToPath(import.meta.url));
const commandsDir = join(here, "commands");
const sources = readdirSync(commandsDir)
  .filter((f) => f.endsWith(".test.ts"))
  .map((f) => readFileSync(join(commandsDir, f), "utf8"));
const executeSource = readFileSync(join(here, "execute.test.ts"), "utf8");
const allSources = [...sources, executeSource];

function commandTypes(): string[] {
  return EngineCommandSchema.options.map((option) => {
    const type = option.shape.type as unknown as { value: string };
    return type.value;
  });
}

/**
 * Codes the engine never returns: a caller outside `execute` refuses with
 * them, so no `expectRefusal` call can assert them. `REASON_CONTRADICTS_STATE`
 * is the DM plan gate's code (spec 058).
 */
const PLAN_GATE_ONLY = [
  "REASON_CONTRADICTS_STATE",
  "STEP_ACTOR_MISMATCH",
] as const;

describe("coverage meta-test", () => {
  it("every command type appears in a command test file", () => {
    const missing = commandTypes().filter(
      (t) => !sources.some((s) => s.includes(`type: "${t}"`)),
    );
    expect(missing, `commands without a test: ${missing.join(", ")}`).toEqual(
      [],
    );
  });

  it("every plan-gate-only code is in the refusal enum", () => {
    for (const code of PLAN_GATE_ONLY) {
      expect(RefusalCodeSchema.options).toContain(code);
    }
  });

  it("every refusal code is asserted by an expectRefusal call", () => {
    const missing = RefusalCodeSchema.options.filter((code) => {
      if ((PLAN_GATE_ONLY as readonly string[]).includes(code)) return false;
      const pattern = new RegExp(
        `(expectRefusal|expectRefusedBeforeDraw)\\([^;]*?"${code}"`,
        "s",
      );
      return !allSources.some((s) => pattern.test(s));
    });
    expect(
      missing,
      `refusal codes without a test: ${missing.join(", ")}`,
    ).toEqual([]);
  });
});
