import { describe, expect, it } from "vitest";
import { z } from "zod";
import { ChronicleOutput } from "../../src/dm/chronicle.js";
import { CompanionOutput } from "../../src/dm/companion.js";
import { AuditModelOutput } from "../../src/dm/nodes/audit.js";
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
