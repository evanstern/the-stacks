# Contract: `isUniqueViolation` and redeem conflict

## `isUniqueViolation(err: unknown): boolean` — `apps/server/src/db.ts`

| Input | Result |
|---|---|
| `{ code: "23505" }` (raw pg error) | `true` |
| `{ cause: { code: "23505" } }` (drizzle `DrizzleQueryError`) | `true` |
| `{ code: "23503" }`, `{ cause: { code: "40001" } }` | `false` |
| `null`, `undefined`, `"23505"`, `42`, `{}`, `{ cause: null }` | `false` |

Invariants:

1. Never throws, for any input.
2. It is the only definition of the detector in `apps/server/src/`. The string `23505` appears
   in no other source file.
3. It inspects `err` and `err.cause` only (one level).

Callers: `auth/invitations.ts` (`redeemInvitation`), `library/store.ts` (`storeParsedBook`,
`attachEmbeddings`).

## `redeemInvitation` — behavior this task fixes

Given a valid, unspent invitation and a username that matches an existing account under
`lower(username)`:

- returns `{ ok: false, reason: "conflict" }`; does not throw;
- creates no account; leaves the invitation unspent (the transaction rolls back).

## `POST /auth/invitations/redeem` — unchanged mapping, now reachable

`reason: "conflict"` → HTTP 409, body
`{ "error": { "kind": "conflict", "message": "That username is already taken." } }`.
