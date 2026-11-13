import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { InterpretOutput } from "../../src/dm/nodes/schemas.js";
import { stripFence } from "../../src/dm/pipeline/call.js";

const FIXTURE = new URL(
  "./fixtures/interpret-capture-20261026T152743Z-greyhollow-ford-provider.json",
  import.meta.url,
);

interface Capture {
  promptVersion: string;
  failure: {
    detail: {
      promptVersion: string;
      attempts: { attempt: number; excerpt: string }[];
    };
  };
}
const capture = JSON.parse(readFileSync(FIXTURE, "utf8")) as Capture;
const attempts = capture.failure.detail.attempts;

describe("captured interpret failure (reproduction)", () => {
  it("has two attempts from the v1 prompt", () => {
    expect(attempts).toHaveLength(2);
    expect(capture.promptVersion).toBe("dm.interpret-v1");
  });

  it("attempt 1 is not valid JSON (truncated)", () => {
    const excerpt = attempts[0]?.excerpt ?? "";
    expect(() => JSON.parse(stripFence(excerpt))).toThrow();
  });

  it("attempt 2 fails the strict parse (the capture is pre-Intent data)", () => {
    const excerpt = attempts[1]?.excerpt ?? "";
    const json = JSON.parse(stripFence(excerpt));
    expect(InterpretOutput.safeParse(json).success).toBe(false);
  });
});
