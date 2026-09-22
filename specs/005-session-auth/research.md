# Phase 0 — Research: session auth for operator and invited players

The spec carries no `[NEEDS CLARIFICATION]` markers: the constitution's Architecture
Constraints table settles the approach ("Self-rolled session auth. Operator plus invited
players. No external IdP") and A1 fixes the stack. What remains is how to build it
correctly with the mandated pieces. Six decisions.

## D1 — Password hashing with Node's built-in `scrypt`, N=2^15, explicit `maxmem`

**Decision**: Hash passwords with `node:crypto`'s `scrypt` at `N=2^15, r=8, p=1`, 64-byte
derived key, a 16-byte random salt per password, **and an explicit `maxmem` of 64 MiB**.
Store salt and parameters alongside the hash so they can be raised later without
invalidating existing passwords. Compare with `timingSafeEqual`.

**Rationale**: scrypt is a memory-hard KDF designed for exactly this, and it is **in the
standard library** — no dependency, no native build step, nothing to audit or keep patched.
That matters more than usual here: constitution IX requires this to run on a self-hoster's
machine from `docker compose up`, and the leading alternative (`argon2`) is a native module
whose install can fail on platforms the project has not tested.

**The `maxmem` parameter is not optional, and this is the trap.** Measured on this project's
Node (v22.23.2):

| params | result |
|---|---|
| `N=2^14`, default maxmem | ok, 30 ms |
| `N=2^15`, default maxmem | **throws `ERR_CRYPTO_INVALID_SCRYPT_PARAMS`** |
| `N=2^15`, `maxmem=64 MiB` | ok, 63 ms |
| `N=2^16`, `maxmem=128 MiB` | ok, 132 ms |

Node's default `maxmem` is 32 MiB, and `N=2^15, r=8` needs more than that, so the call
**throws synchronously** — not an error passed to the callback, a `throw` that skips a
`try` placed around the callback instead of the call. An implementer who sets N without
maxmem gets a crash on first sign-in, not a slow hash.

`N=2^15` at ~63 ms is the choice: fast enough that a person signing in does not notice, slow
enough to make offline guessing expensive. `N=2^14` (30 ms) is defensible but cheaper to
attack; `N=2^16` (132 ms) is better against attackers and starts to be felt on a modest
self-hosted box.

**Alternatives considered**:

- **argon2id** — the stronger primitive and the usual first recommendation, rejected on
  deployability: it is a native dependency, it is not in the constraints table, and a
  failed native build on a self-hoster's platform is a broken install. Revisit if a pure-JS
  or bundled implementation becomes standard.
- **bcrypt** — rejected: also native, caps the password at 72 bytes (silently truncating
  beyond it, which FR-016 forbids), and is not memory-hard.
- **PBKDF2** (also stdlib) — rejected: not memory-hard, so it is far cheaper to attack with
  GPUs at equivalent CPU cost. Since scrypt is equally available, there is no reason to
  choose it.
- **A plain hash with a salt** — not a real option; named only to say it was not considered
  acceptable.

## D2 — Session tokens: random, stored hashed, looked up by hash

**Decision**: A session token is 32 bytes from `crypto.randomBytes`, base64url-encoded,
given to the client. The database stores **only the SHA-256 of the token**, and lookup
hashes the presented token to find the row. The token is never stored in recoverable form.

**Rationale**: The token is a bearer credential — whoever holds it is that user. Storing it
in plaintext means a database read (a backup, a log, a SQL-injection elsewhere, an operator
glancing at a table) hands over live sessions for every signed-in user. Hashing it makes a
stolen database useless for impersonation. SHA-256 rather than scrypt here **on purpose**:
the token already has 256 bits of entropy from a CSPRNG, so there is nothing to brute-force
and no reason to pay a memory-hard cost on every single request. Password hashing and token
hashing look similar and have opposite requirements — passwords are low-entropy and need
slowness; tokens are high-entropy and need speed.

**Alternatives considered**:

- **Store the token in plaintext** — rejected for the reason above. It is the common
  shortcut and it is what turns a read-only database leak into a full account takeover.
- **A signed self-contained token (JWT-style)** — rejected: FR-005 requires that signing out
  makes a session authenticate nothing *immediately*, which a self-contained token cannot do
  before expiry without a revocation list — server-side state anyway, so the supposed
  advantage evaporates and the complexity stays.
- **A database sequence or UUID as the token** — rejected: UUIDv4 has 122 bits from a source
  not guaranteed to be cryptographic, and a sequence is guessable outright.

## D3 — Session lifetime: 30 days absolute, no sliding renewal on validate

**Decision**: A session expires 30 days after creation. `validateSession` does **not**
extend it (FR-008). Expiry is checked on every validation, and an expired row is treated as
absent.

**Rationale**: 30 days suits the product — a self-hosted tool for a recurring game group,
where being signed out between sessions is friction with no security benefit for a
single-tenant install. The no-sliding rule is the load-bearing half: US2 scenario 4 and
SC-007 require that a continuously-polling WebSocket not keep a session alive forever, and a
sliding expiry implemented inside `validateSession` does exactly that, invisibly. If sliding
renewal is wanted later it belongs on an explicit refresh call the client makes
deliberately, not as a side effect of asking "who is this".

**Alternatives considered**:

- **Sliding expiry on every validation** — rejected: it makes sessions immortal for any
  active client, which for a WS connection means forever, and it turns a read into a write
  on the hottest path in the system.
- **A short lifetime (hours)** — rejected: it forces re-authentication mid-game for no
  threat this deployment faces.
- **No expiry at all** — rejected: a leaked token would be valid forever, and FR-006
  requires a bounded lifetime.

## D4 — Cookie flags: `HttpOnly`, `SameSite=Lax`, `Secure` in production, `Path=/`

**Decision**: The session cookie is `HttpOnly`, `SameSite=Lax`, `Path=/`, with `Secure` set
when the app is served over HTTPS and omitted for plain-HTTP local development. `Max-Age`
matches the session lifetime.

**Rationale**: `HttpOnly` is FR-010's requirement directly — script cannot read the cookie,
so an XSS bug cannot exfiltrate the session. `SameSite=Lax` blocks the cookie on
cross-site *sub-requests* (the CSRF vector) while still sending it on top-level navigation,
so a link to the app from elsewhere still works. `Secure` must be conditional, not
unconditional: a self-hoster's first run is `http://localhost:3000`, and an unconditional
`Secure` means the cookie is silently never stored — a login that "succeeds" and then does
not work, with nothing in the logs.

**Alternatives considered**:

- **`SameSite=Strict`** — rejected: it also suppresses the cookie on top-level navigation
  from outside, so following a link into the app shows a signed-out page. Poor fit for
  something people link each other to; `Lax` closes the same CSRF hole.
- **`SameSite=None; Secure`** — rejected: needed only for cross-site embedding, which this
  product does not do, and it re-opens CSRF.
- **Unconditional `Secure`** — rejected for the localhost failure above.
- **Storing the token in `localStorage`** — rejected outright: readable by any script,
  which is precisely what FR-010 forbids.

## D5 — Invitation single-use enforced by the database, not by a read-then-write

**Decision**: Redemption is a single conditional `UPDATE` that marks the invitation
redeemed **only if it is not yet redeemed**, and the account is created only when that
update reports it changed a row. A unique constraint backs it.

**Rationale**: SC-005 requires that simultaneous redemptions create exactly one account.
The natural implementation — read the invitation, check it is unredeemed, create the
account, mark it redeemed — has a window between the check and the mark where a second
request does the same thing, and both succeed. Making the check and the mark one atomic
statement removes the window entirely: the database arbitrates, and the loser sees zero rows
updated. **This is the same class of bug spec 004 solved with an advisory lock**, and worth
naming: read-then-write across a network round trip is a race by default, not by accident.

**Alternatives considered**:

- **Read, check, then write** — rejected: the race described above. It passes every test
  that does not run two redemptions concurrently, which is most tests.
- **An advisory lock per invitation** (spec 004's mechanism) — rejected as heavier than
  needed. A conditional update is atomic on its own; the lock is for computing a value from
  a prior read, which this is not.
- **A unique constraint alone, catching the violation** — rejected as the primary mechanism:
  it works, but it makes the normal concurrent path an exception, and the conditional update
  reports the outcome as data. The constraint stays as a backstop.

## D6 — Operator provisioning is a command, and refuses to clobber

**Decision**: The first operator is created by a documented command run against the
database, which reads a password from the environment or an interactive prompt, and
**refuses to run if an operator already exists** unless explicitly told otherwise. No
default account, no seeded credential, no bootstrap-token file.

**Rationale**: FR-011 forbids shipping any default credential — the single most common
self-hosted vulnerability is a shipped `admin/admin` nobody changed. A command gives the
operator a path with no credential existing beforehand. Refusing when an operator already
exists (US3 scenario 2) prevents a re-run from silently creating a second operator or
overwriting the first, which is how an install gets quietly taken over.

**Alternatives considered**:

- **A first-run web page that creates the operator** — rejected for M0: it is a
  race-to-claim, since anyone who reaches the install before the owner becomes the operator.
  Defensible with a setup token, which is more machinery than a command.
- **Seed an operator in a migration** — rejected outright: that is a shipped default
  credential, which FR-011 forbids and constitution VIII's spirit (the operator owns their
  install) argues against.
- **Environment variables read at every boot** — rejected: it keeps a plaintext password in
  the process environment forever, and makes "change the password" mean "edit the env and
  restart".
