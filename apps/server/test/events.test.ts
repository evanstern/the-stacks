import { describe, expect, it } from "vitest";
import type { AppendInput, DbClient } from "../src/events/log.js";
import { append } from "../src/events/log.js";

/**
 * Unit-level validation for the event log (T030) — no database required.
 * `append`'s seq/ts guard (data-model.md, Validation rules) throws before
 * ever touching its `db` argument, so a stub stands in for a real client.
 */

const unusedDb = undefined as unknown as DbClient;

const validInput: AppendInput = {
  sessionId: "11111111-1111-1111-1111-111111111111",
  actor: "test-actor",
  type: "narration",
  payload: { text: "hi" },
  payloadVersion: 1,
};

describe("append — input validation (no database)", () => {
  it("T030: rejects a caller-supplied seq", async () => {
    await expect(
      append(unusedDb, { ...validInput, seq: 5 } as AppendInput),
    ).rejects.toThrow(/seq and ts are assigned by the log/);
  });

  it("T030: rejects a caller-supplied ts", async () => {
    await expect(
      append(unusedDb, {
        ...validInput,
        ts: new Date().toISOString(),
      } as AppendInput),
    ).rejects.toThrow(/seq and ts are assigned by the log/);
  });
});
