import { describe, expect, it } from "vitest";
import {
  hashPassword,
  MAX_PASSWORD_LENGTH,
  verifyPassword,
} from "../src/auth/password.js";

/** T009: password hashing — no database required. */
describe("password hashing", () => {
  it("round-trips: hash then verify succeeds for the correct password", async () => {
    const hash = await hashPassword("correct horse battery staple");
    await expect(
      verifyPassword("correct horse battery staple", hash),
    ).resolves.toBe(true);
  });

  it("rejects the wrong password", async () => {
    const hash = await hashPassword("correct horse battery staple");
    await expect(verifyPassword("wrong password", hash)).resolves.toBe(false);
  });

  it("hashes the same password differently each time (random salt)", async () => {
    const a = await hashPassword("same password");
    const b = await hashPassword("same password");
    expect(a).not.toBe(b);
    await expect(verifyPassword("same password", a)).resolves.toBe(true);
    await expect(verifyPassword("same password", b)).resolves.toBe(true);
  });

  it("refuses an over-length password rather than truncating it (FR-016)", async () => {
    const overLength = "a".repeat(MAX_PASSWORD_LENGTH + 1);
    await expect(hashPassword(overLength)).rejects.toThrow(
      /maximum accepted length/,
    );
  });

  it("accepts a password at exactly the maximum length", async () => {
    const atLimit = "a".repeat(MAX_PASSWORD_LENGTH);
    await expect(hashPassword(atLimit)).resolves.toEqual(expect.any(String));
  });
});
