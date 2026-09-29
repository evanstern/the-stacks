import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config.js";

const BASE_ENV = { DATABASE_URL: "postgres://u:p@localhost:5432/db" };

describe("loadConfig — uploadMaxBytes (specs/017-ingestion-pipeline T001)", () => {
  it("defaults to 1 GiB when UPLOAD_MAX_BYTES is unset", () => {
    expect(loadConfig(BASE_ENV).uploadMaxBytes).toBe(1073741824);
  });

  it("reads an override", () => {
    expect(
      loadConfig({ ...BASE_ENV, UPLOAD_MAX_BYTES: "500" }).uploadMaxBytes,
    ).toBe(500);
  });

  it.each(["0", "-1", "abc"])("rejects %s", (raw) => {
    expect(() => loadConfig({ ...BASE_ENV, UPLOAD_MAX_BYTES: raw })).toThrow(
      `UPLOAD_MAX_BYTES must be a positive integer, got "${raw}"`,
    );
  });
});
