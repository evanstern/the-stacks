import type { ScryptOptions } from "node:crypto";
import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

/**
 * `util.promisify(scrypt)` resolves to the 3-arg overload's types (no
 * options), so it can't be called with `{ N, r, p, maxmem }`. This thin
 * wrapper picks the 4-arg-plus-callback overload explicitly instead.
 */
function scryptAsync(
  password: string,
  salt: Buffer,
  keylen: number,
  options: ScryptOptions,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, keylen, options, (err, derivedKey) => {
      if (err) reject(err);
      else resolve(derivedKey);
    });
  });
}

/**
 * Password hashing (research D1). scrypt is memory-hard and in the
 * standard library — no dependency, no native build step, which matters
 * because constitution IX requires this to run from `docker compose up` on
 * whatever platform a self-hoster has.
 *
 * N=2^15 is the trap: Node's default `maxmem` is 32 MiB, and this N needs
 * more, so the call THROWS SYNCHRONOUSLY (`ERR_CRYPTO_INVALID_SCRYPT_PARAMS`)
 * without an explicit, larger `maxmem`. Measured on this project's Node
 * v22.23.2 (see research D1's table): N=2^15 with the default maxmem
 * throws; with maxmem=64 MiB it succeeds in ~63ms.
 */
const SCRYPT_N = 2 ** 15;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_MAXMEM = 64 * 1024 * 1024;
const KEY_LENGTH = 64;
const SALT_LENGTH = 16;

/** Refusal bound (FR-016): over this length the password is refused, never truncated. */
export const MAX_PASSWORD_LENGTH = 256;

const ENCODING_VERSION = "scrypt1";

/**
 * Encodes hash + salt + params as one string, so parameters can be raised
 * later without invalidating existing passwords (research D1).
 */
function encode(hash: Buffer, salt: Buffer): string {
  return [
    ENCODING_VERSION,
    SCRYPT_N,
    SCRYPT_R,
    SCRYPT_P,
    salt.toString("base64"),
    hash.toString("base64"),
  ].join("$");
}

function decode(encoded: string) {
  const [version, n, r, p, saltB64, hashB64] = encoded.split("$");
  if (version !== ENCODING_VERSION || !n || !r || !p || !saltB64 || !hashB64) {
    throw new Error("password.ts: malformed password hash encoding");
  }
  return {
    N: Number(n),
    r: Number(r),
    p: Number(p),
    salt: Buffer.from(saltB64, "base64"),
    hash: Buffer.from(hashB64, "base64"),
  };
}

/** Hashes a plaintext password. Throws if it exceeds MAX_PASSWORD_LENGTH (FR-016). */
export async function hashPassword(password: string): Promise<string> {
  if (password.length > MAX_PASSWORD_LENGTH) {
    throw new Error(
      `password exceeds maximum accepted length of ${MAX_PASSWORD_LENGTH}`,
    );
  }
  const salt = randomBytes(SALT_LENGTH);
  const hash = await scryptAsync(password, salt, KEY_LENGTH, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
    maxmem: SCRYPT_MAXMEM,
  });
  return encode(hash, salt);
}

/**
 * Verifies a plaintext password against an encoded hash, comparing with
 * `timingSafeEqual` (never `===`, which short-circuits on the first
 * mismatched byte and leaks timing information).
 *
 * Deliberately does not check password length against MAX_PASSWORD_LENGTH:
 * that refusal belongs at the point a password is being *set* (sign-up,
 * hashPassword), not at verification, where an over-length input should
 * just fail to match like any other wrong password.
 */
export async function verifyPassword(
  password: string,
  encoded: string,
): Promise<boolean> {
  const { N, r, p, salt, hash } = decode(encoded);
  const candidate = await scryptAsync(password, salt, hash.length, {
    N,
    r,
    p,
    maxmem: SCRYPT_MAXMEM,
  });
  return candidate.length === hash.length && timingSafeEqual(candidate, hash);
}
