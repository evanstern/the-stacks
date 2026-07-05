import { describe, expect, it } from "vitest";

import { DomainError } from "../src/errors";

describe("DomainError", () => {
  it("carries class, message, and optional seam/cause", () => {
    const cause = new Error("boom");
    const err = new DomainError({
      class: "dependency_down",
      seam: "inference",
      message: "sidecar unreachable",
      cause,
    });

    expect(err).toBeInstanceOf(Error);
    expect(err.class).toBe("dependency_down");
    expect(err.seam).toBe("inference");
    expect(err.message).toBe("sidecar unreachable");
    expect(err.cause).toBe(cause);
  });

  it("supports all four error classes", () => {
    const classes = [
      "unknown_thing",
      "unsupported_type",
      "dependency_down",
      "internal_fault",
    ] as const;

    for (const cls of classes) {
      const err = new DomainError({ class: cls, message: "x" });
      expect(err.class).toBe(cls);
    }
  });

  it("leaves seam undefined when not provided", () => {
    const err = new DomainError({ class: "internal_fault", message: "x" });
    expect(err.seam).toBeUndefined();
  });
});
