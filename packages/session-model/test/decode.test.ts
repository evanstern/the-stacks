import { describe, expect, it } from "vitest";
import { decodeEvent } from "../src/index.js";
import { engineExamples, envelope, row, sessionPayloads } from "./helpers.js";

const examples = engineExamples();

describe("decodeEvent", () => {
  it("decodes every valid session row as known with its kind", () => {
    const kinds: Record<string, string> = {
      talk: "talk",
      narration: "talk",
      "action.declared": "lifecycle",
      "table-mode.changed": "state-change",
      "journal.entry.added": "record",
    };
    for (const [type, payload] of Object.entries(sessionPayloads)) {
      const result = decodeEvent(row(type, payload));
      expect(result.status).toBe("known");
      if (result.status === "known" && kinds[type]) {
        expect(result.kind).toBe(kinds[type]);
        expect(result.event.type).toBe(type);
        expect(result.event.seq).toBe(1);
      }
    }
  });

  it("decodes mechanics rows as marker or state-change", () => {
    const dice = decodeEvent(
      row("dice.rolled", envelope(examples["dice.rolled"] as never)),
    );
    expect(dice).toMatchObject({ status: "known", kind: "marker" });
    const hp = decodeEvent(
      row("hp.changed", envelope(examples["hp.changed"] as never)),
    );
    expect(hp).toMatchObject({ status: "known", kind: "state-change" });
  });

  it("reports unknown-type and unknown-version", () => {
    expect(decodeEvent(row("x-test.future-type", {}))).toEqual({
      status: "unknown-type",
    });
    expect(
      decodeEvent(row("talk", sessionPayloads.talk, { payloadVersion: 2 })),
    ).toEqual({ status: "unknown-version" });
  });

  it("reports invalid for a bad payload", () => {
    const result = decodeEvent(
      row("talk", { text: "", channel: "ic", characterId: null }),
    );
    expect(result.status).toBe("invalid");
    if (result.status === "invalid")
      expect(result.issues.length).toBeGreaterThan(0);
  });

  it("reports invalid for a mechanics row whose type differs from the event type", () => {
    const result = decodeEvent(
      row("hp.changed", envelope(examples["dice.rolled"] as never)),
    );
    expect(result.status).toBe("invalid");
  });

  it("never throws on junk payloads", () => {
    let deep: unknown = "leaf";
    for (let i = 0; i < 200; i++) deep = { a: [deep] };
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    for (const payload of [null, undefined, 42, "text", [], deep, cyclic]) {
      for (const type of [
        "talk",
        "dice.rolled",
        "tracker.changed",
        "mystery",
      ]) {
        const result = decodeEvent(row(type, payload));
        expect(["invalid", "unknown-type"]).toContain(result.status);
      }
    }
  });
});
