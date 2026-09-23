---
name: password-hashing
description: Password hashing uses Node's stdlib scrypt (no dependency added — self-hostability), its N/r/p/maxmem parameters, the versioned encoded-hash format, and the maxmem trap that makes N=2^15 throw synchronously under Node's default 32MiB maxmem.
kind: component
sources:
  - apps/server/src/auth/password.ts
verified_against: e472b4777ed2db6debbaca8044b6b76e2af11ee3
---

# Password Hashing

`apps/server/src/auth/password.ts` hashes and verifies passwords using Node's built-in
`node:crypto` `scrypt` — no npm dependency, no native build step. That matters because
constitution IX requires this to run from `docker compose up` on whatever platform a
self-hoster has; a dependency with a native addon is exactly the kind of thing that breaks
that promise.

## How it works

Parameters: `N = 2**15` (32768), `r = 8`, `p = 1`, `maxmem = 64 * 1024 * 1024` (64 MiB),
output key length 64 bytes, salt 16 random bytes (`randomBytes`).

**The `maxmem` trap, worth knowing before touching these numbers**: Node's default `maxmem`
for `scrypt` is 32 MiB, and `N = 2**15` needs more memory than that — calling `scrypt` with
this `N` and no explicit `maxmem` **throws synchronously**
(`ERR_CRYPTO_INVALID_SCRYPT_PARAMS`), before any async work even starts. Passing
`maxmem: 64 * 1024 * 1024` explicitly is what makes it work at all; measured on this
project's Node build, `N = 2**15` with 64 MiB `maxmem` completes in roughly 63ms.

Because `util.promisify(scrypt)` resolves to the 3-argument overload's types (no options
object), `password.ts` hand-writes a thin `scryptAsync` wrapper that calls the 4-arg-plus-
callback overload directly, so it can pass `{ N, r, p, maxmem }`.

`hashPassword(password)` refuses (throws) any password over `MAX_PASSWORD_LENGTH` (256
characters) rather than truncating it, generates a random salt, hashes, and returns one
encoded string: `scrypt1$<N>$<r>$<p>$<salt-base64>$<hash-base64>`. Encoding the parameters
alongside the hash means `N`/`r`/`p` can be raised later without invalidating existing
passwords — `verifyPassword` decodes and reuses whatever parameters a given hash was
originally created with, not the current constants.

`verifyPassword(password, encoded)` decodes the stored string, re-derives a candidate hash
using the *stored* parameters and salt, and compares with `timingSafeEqual` — never `===`,
which short-circuits on the first mismatched byte and leaks timing information about how much
of the hash matched. It deliberately does **not** check the incoming password against
`MAX_PASSWORD_LENGTH`: that refusal belongs at the point a password is being *set*
(`hashPassword`), not at verification, where an over-length input should simply fail to match
like any other wrong password rather than get a distinguishable error.

## Connections

Used by [[session-auth]] (sign-in verification, via a fixed dummy hash for the
username-enumeration defence) and by [[invitations]] and [[operator-provisioning]] (both call
`hashPassword` when creating an account).

## Operational notes

`MAX_PASSWORD_LENGTH` is exported as `256`. The encoded hash's leading segment
(`ENCODING_VERSION = "scrypt1"`) is a version tag `decode` checks; a malformed or unrecognized
encoding throws rather than silently failing open.
