import { describe, expect, it } from "vitest";
import { resolvePlaytestUrl } from "../../src/playtest/db.js";

describe("resolvePlaytestUrl", () => {
  it("suffixes the base database with _playtest", () => {
    const r = resolvePlaytestUrl({
      TEST_DATABASE_URL: "postgres://u:p@localhost:5432/app_test",
    });
    expect(r.playtestUrl).toBe(
      "postgres://u:p@localhost:5432/app_test_playtest",
    );
  });

  it("honours the override and refuses equal-to-base and non-loopback", () => {
    const base = "postgres://u:p@localhost:5432/app";
    expect(
      resolvePlaytestUrl({
        DATABASE_URL: base,
        PLAYTEST_DATABASE_URL: "postgres://u:p@127.0.0.1:5432/x",
      }).playtestUrl,
    ).toContain("/x");
    expect(() =>
      resolvePlaytestUrl({ DATABASE_URL: base, PLAYTEST_DATABASE_URL: base }),
    ).toThrow(/differ/);
    expect(() =>
      resolvePlaytestUrl({ DATABASE_URL: "postgres://u:p@db.example.com/app" }),
    ).toThrow(/not loopback/);
    expect(() => resolvePlaytestUrl({})).toThrow(/required/);
  });
});
