import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DirectorOutput } from "../../src/dm/nodes/schemas.js";

const FIXTURE = new URL(
  "./fixtures/director-capture-20261026T150925Z-greyhollow-ford-provider.json",
  import.meta.url,
);

interface Capture {
  failure: { detail: { attempts: { attempt: number; excerpt: string }[] } };
}
const capture = JSON.parse(readFileSync(FIXTURE, "utf8")) as Capture;
const attempts = capture.failure.detail.attempts;

describe("captured director failure (reproduction)", () => {
  it("has two attempts", () => {
    expect(attempts).toHaveLength(2);
  });

  it.each(attempts.map((a) => [a.attempt, a.excerpt] as const))(
    "attempt %i fails the strict parse at goalNote",
    (_n, excerpt) => {
      const parsed = DirectorOutput.safeParse(JSON.parse(excerpt));
      expect(parsed.success).toBe(false);
      if (parsed.success) return;
      expect(parsed.error.issues.map((i) => i.path.join("."))).toEqual([
        "goalNote",
      ]);
    },
  );
});
