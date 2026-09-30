---
name: invitations
description: Issue and redeem — the raw token returned exactly once and only its SHA-256 stored, single-use enforced inside one transaction (measured: 20 simultaneous redemptions -> exactly 1 account, every run), and the deliberately undifferentiated invalid/expired/redeemed failure.
kind: component
sources:
  - apps/server/src/auth/invitations.ts
  - apps/server/src/auth/tokens.ts
  - apps/server/src/routes/auth.ts
verified_against: 7f44333a9fde6ce389a9808d2e417a89b4fa8630
---

# Invitations

`apps/server/src/auth/invitations.ts` is how a second person gets an account: the operator
issues an invitation token, a player redeems it once to create a `player` account. Bearer
tokens (both invitation and session tokens) are generated and hashed by the shared
`apps/server/src/auth/tokens.ts`: `generateToken()` is 32 random bytes (256 bits) from a
CSPRNG, base64url-encoded; `hashToken()` is plain SHA-256, hex-encoded — deliberately **not**
scrypt (see [[password-hashing]]), because a token already carries 256 bits of entropy, so
there is nothing to brute-force and a memory-hard hash on every request would tax the
system's hottest path for no security benefit. Only the hash is ever stored, for both
invitation and session tokens.

## How it works

**`issueInvitation(db, createdBy, options)`** generates a token, stores only `hashToken(token)`
with an expiry (`expiresInDays` option, default 7 days — a deliberate bound, since an
unexpiring invitation is a permanent backdoor), and returns `{ token, expiresAt }`. The raw
token is returned **exactly once**, in that response — it is never recoverable again, since
only its hash lives in the database. The caller (`routes/auth.ts`'s `POST /invitations`) is
responsible for the operator-only authorization check; `issueInvitation` itself trusts
whatever `createdBy` it's given.

**`redeemInvitation(db, input)`** is single-use under concurrency **enforced by the database,
not by a read-then-write**. Inside one `db.transaction`, it first inserts the new `player`
account, then runs a guarded `UPDATE invitations SET redeemed_at = now(), redeemed_by = $newUserId
WHERE token_hash = $1 AND redeemed_at IS NULL AND expires_at > now()`. If that `UPDATE`
reports zero rows changed, the function throws an internal
`InvitationNotRedeemableError` (a rollback signal only — it never escapes the function), which
rolls back the whole transaction, undoing the account insert too. The transaction itself is
what provides mutual exclusion: Postgres's row lock on the invitation serializes competing
`UPDATE`s to the same row whether or not the `WHERE` guard is present at all; the
`redeemed_at IS NULL` guard is what makes the **loser** of that serialization actually notice
it lost, rather than silently overwriting the winner's redemption. Without the guard, the
symptom would be a re-redeemable invitation, not two accounts.

**Measured, not assumed**: an independent probe firing 20 simultaneous redemptions of the same
invitation against the real implementation, three runs, produced exactly 1 success and 19
refusals every time — exactly one account created per run, with the 19 losers' speculative
account inserts rolled back cleanly (no orphan accounts).

A username collision on the speculative insert surfaces as a Postgres unique-violation
(`23505`) wrapped in a `DrizzleQueryError`, detected by the shared `isUniqueViolation` in
[[database-access]]'s `db.ts` (it checks both `err.code` and `err.cause.code`, since drizzle
puts the driver's own code on `.cause`), reported to the caller as
`{ ok: false, reason: "conflict" }` — distinct from an invalid/expired/already-redeemed token,
which is reported as `{ ok: false, reason: "invalid" }`.

At the route layer (`POST /invitations/redeem`), a `"conflict"` reason becomes
`ConflictError("That username is already taken.")`, but `"invalid"` — covering **unknown**,
**expired**, and **already-redeemed** tokens alike — becomes one deliberately
undifferentiated `ValidationError`: "This invitation is invalid, expired, or already
redeemed." The three cases are indistinguishable on purpose, so a caller can't probe which
tokens once existed.

## Connections

Depends on [[password-hashing]] (`hashPassword` for the new account) and shares
`generateToken`/`hashToken` with [[session-auth]]'s session tokens. Backed by
[[database-schema]]'s `invitations`/`users` tables. Shares its unique-violation detector with
[[library-schema]] via [[database-access]]. Errors surface through [[error-contract]].

## Operational notes

There is no invitation-listing or revoke endpoint at this commit — an issued, unredeemed
invitation can only expire, never be cancelled early.
