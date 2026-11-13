import { describe, expect, it } from "vitest";
import {
  type NarrationStreamFrame,
  parseInboundFrame,
} from "../src/ws/protocol.js";

/**
 * T003: frame parsing, no socket and no database (contracts/ws-protocol.md).
 */
describe("ws protocol — parseInboundFrame", () => {
  const sessionId = "123e4567-e89b-12d3-a456-426614174000";

  it("parses a valid subscribe frame", () => {
    const result = parseInboundFrame(
      JSON.stringify({ type: "subscribe", sessionId, afterSeq: 3 }),
    );
    expect(result).toEqual({
      ok: true,
      frame: { type: "subscribe", sessionId, afterSeq: 3 },
    });
  });

  it("parses the optional presence flag and strips nothing else (decision-0024)", () => {
    const on = parseInboundFrame(
      JSON.stringify({ type: "subscribe", sessionId, presence: true }),
    );
    expect(on).toEqual({
      ok: true,
      frame: { type: "subscribe", sessionId, presence: true },
    });
    const off = parseInboundFrame(
      JSON.stringify({ type: "subscribe", sessionId }),
    );
    expect(off).toEqual({ ok: true, frame: { type: "subscribe", sessionId } });
    expect(
      parseInboundFrame(
        JSON.stringify({ type: "subscribe", sessionId, presence: "yes" }),
      ).ok,
    ).toBe(false);
  });

  it("parses a valid send frame", () => {
    const result = parseInboundFrame(
      JSON.stringify({
        type: "send",
        sessionId,
        eventType: "chat",
        payload: { text: "hi" },
        payloadVersion: 1,
        visibility: "public",
      }),
    );
    expect(result.ok).toBe(true);
  });

  it("refuses malformed JSON", () => {
    const result = parseInboundFrame("{not json");
    expect(result.ok).toBe(false);
  });

  it("refuses an unknown type", () => {
    const result = parseInboundFrame(
      JSON.stringify({ type: "teleport", sessionId }),
    );
    expect(result.ok).toBe(false);
  });

  it("refuses a send frame missing required fields", () => {
    const result = parseInboundFrame(
      JSON.stringify({ type: "send", sessionId }),
    );
    expect(result.ok).toBe(false);
  });

  it("parses a send frame carrying actor/seq/ts, with those fields ignored (data-model.md)", () => {
    const result = parseInboundFrame(
      JSON.stringify({
        type: "send",
        sessionId,
        eventType: "chat",
        payload: {},
        payloadVersion: 1,
        actor: "someone-else",
        seq: 999,
        ts: "2020-01-01T00:00:00.000Z",
      }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.frame).not.toHaveProperty("actor");
      expect(result.frame).not.toHaveProperty("seq");
      expect(result.frame).not.toHaveProperty("ts");
    }
  });
});

describe("ws protocol — narration-stream frame (spec 108)", () => {
  it("is server-to-client only: an inbound narration-stream frame is refused", () => {
    expect(
      parseInboundFrame(
        JSON.stringify({
          type: "narration-stream",
          sessionId: "123e4567-e89b-12d3-a456-426614174000",
          jobId: "j",
          slot: "rows",
          text: "t",
        }),
      ).ok,
    ).toBe(false);
  });

  it("has the shape the contract names", () => {
    const frame: NarrationStreamFrame = {
      type: "narration-stream",
      sessionId: "s",
      jobId: "j",
      slot: "end",
      text: "",
    };
    expect(Object.keys(frame).sort()).toEqual(
      ["jobId", "sessionId", "slot", "text", "type"].sort(),
    );
  });
});
