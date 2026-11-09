import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { ChronicleOutput } from "../../src/dm/chronicle.js";
import { CompanionOutput } from "../../src/dm/companion.js";
import { AuditModelOutput } from "../../src/dm/nodes/audit.js";
import {
  PURPOSE_MAX_TOKENS,
  unstructuredDmPurposes,
} from "../../src/dm/purposes.js";
import {
  AdjudicateModelOutput,
  DirectorOutput,
  InterpretOutput,
  ReactOutput,
} from "../../src/dm/nodes/schemas.js";

/** FR-015: every schema a DM `callJson` site passes converts to JSON Schema with callJson's options. */
describe("DM schemas convert to JSON Schema", () => {
  const schemas = {
    InterpretOutput,
    DirectorOutput,
    AdjudicateModelOutput,
    AuditModelOutput,
    ChronicleOutput,
    CompanionOutput,
    ReactOutput,
  };
  for (const [name, schema] of Object.entries(schemas)) {
    it(name, () => {
      const json = z.toJSONSchema(schema, {
        target: "draft-7",
        io: "input",
        unrepresentable: "any",
      });
      expect(json.type).toBe("object");
      const { $schema: _s, ...rest } = json;
      expect(rest).not.toHaveProperty("$schema");
    });
  }
});

describe("interpret cap and unstructured purposes (spec 093 OQ-3)", () => {
  it("pins the interpret cap in PURPOSE_MAX_TOKENS and .env.example", () => {
    expect(PURPOSE_MAX_TOKENS["dm.interpret"]).toBe(8000);
    const env = readFileSync(
      resolve(import.meta.dirname, "../../../../.env.example"),
      "utf8",
    );
    expect(env).toContain('"dm.interpret":{"provider":"hosted","model":"mid-model","structured":"tool","maxTokens":8000}');
  });
  it("lists configured dm.* purposes lacking structured, never dm.narrate", () => {
    expect(
      unstructuredDmPurposes({
        "dm.director": { structured: "tool" },
        "dm.interpret": {},
        "dm.narrate": {},
        other: {},
      }),
    ).toEqual(["dm.interpret"]);
  });
});
