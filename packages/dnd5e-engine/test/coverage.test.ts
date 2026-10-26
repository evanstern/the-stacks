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

describe("coverage meta-test", () => {
  it("every command type appears in a command test file", () => {
    const missing = commandTypes().filter(
      (t) => !sources.some((s) => s.includes(`type: "${t}"`)),
    );
    expect(missing, `commands without a test: ${missing.join(", ")}`).toEqual(
      [],
    );
  });

  it("every refusal code is asserted by an expectRefusal call", () => {
    const missing = RefusalCodeSchema.options.filter((code) => {
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
