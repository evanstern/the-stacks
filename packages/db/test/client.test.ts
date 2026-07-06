import { describe, expect, it } from "vitest";

import { createDbClient } from "../src/client";

describe("createDbClient", () => {
  it("attaches an error listener so a pool idle-client error does not crash the process", () => {
    const { pool } = createDbClient("postgresql://stacks_v3:stacks_v3@localhost:5442/stacks_v3");

    expect(pool.listenerCount("error")).toBeGreaterThan(0);

    // node-postgres crashes the process on an unhandled 'error' event; emitting
    // one here must not throw, proving the listener actually absorbs it.
    expect(() => pool.emit("error", new Error("simulated idle client error"))).not.toThrow();

    void pool.end();
  });
});
