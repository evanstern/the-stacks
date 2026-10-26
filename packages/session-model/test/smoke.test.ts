import { describe, expect, it } from "vitest";
import { SESSION_MODEL_VERSION } from "../src/index.js";

describe("session-model scaffold", () => {
  it("exports its version", () => {
    expect(SESSION_MODEL_VERSION).toBe(1);
  });
});
