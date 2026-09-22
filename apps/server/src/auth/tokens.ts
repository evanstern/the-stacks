import { createHash, randomBytes } from "node:crypto";

const TOKEN_BYTES = 32;

/**
 * Session/invitation tokens (research D2). Generated with `randomBytes` —
 * 32 bytes (256 bits) from a CSPRNG — and hashed with plain SHA-256, never
 * scrypt. This is the OPPOSITE choice from password.ts on purpose: a
 * password is low-entropy and needs a slow, memory-hard hash to make
 * guessing expensive; a token already has 256 bits of entropy, so there is
 * nothing to brute-force and a memory-hard hash on every request would tax
 * the hottest path in the system for no security benefit.
 */

/** Generates a new bearer token: 32 random bytes, base64url-encoded. */
export function generateToken(): string {
  return randomBytes(TOKEN_BYTES).toString("base64url");
}

/** SHA-256 of a token, hex-encoded — the only form ever stored (research D2). */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
