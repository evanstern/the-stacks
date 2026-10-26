import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { ChatEvent, ChatRequest } from "../../src/ai/types.js";
import {
  legalizeDirector,
  normalizeDirector,
} from "../../src/dm/nodes/director.js";
import { DirectorOutput } from "../../src/dm/nodes/schemas.js";
import { callJson } from "../../src/dm/pipeline/call.js";
import { freeEventsThrough, projectDm, testSeed } from "./helpers.js";

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

describe("captured director failure (fixed pipeline)", () => {
  const usage = { inputTokens: 1, outputTokens: 1 };
  function gatewayOf(texts: string[]) {
    const scripts = [...texts];
    return {
      chat: async function* (_req: ChatRequest): AsyncGenerator<ChatEvent> {
        yield { type: "text", text: scripts.shift() ?? "" };
        yield { type: "done", usage };
      },
    };
  }
  const request = {
    purpose: "dm.director" as const,
    promptVersion: "dm.director-v1",
    system: "sys",
    user: "usr",
    schema: DirectorOutput,
    signal: new AbortController().signal,
  };

  it.each(attempts.map((a) => [a.attempt, a.excerpt] as const))(
    "attempt %i passes callJson with the director normalizer and is legal",
    async (_n, excerpt) => {
      const strict = await callJson(
        { gateway: gatewayOf([excerpt, excerpt]) },
        request,
      );
      expect(strict.ok).toBe(false);

      const r = await callJson(
        { gateway: gatewayOf([excerpt]) },
        { ...request, normalize: normalizeDirector },
      );
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      expect(r.calls).toHaveLength(1);
      expect(r.value.goalNote.length).toBeLessThanOrEqual(300);
      const out = legalizeDirector(r.value, {
        trigger: "commit",
        forceResolve: false,
        projections: projectDm(freeEventsThrough("narration")),
        seed: testSeed(),
        beat: [],
      });
      expect(out.goalNote).toBe(r.value.goalNote);
      expect(out.beat).toEqual({ decision: "resolve" });
      expect(out.pacing).toEqual(r.value.pacing);
    },
  );
});
