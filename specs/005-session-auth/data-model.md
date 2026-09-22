# Phase 1 — Data model: users, auth sessions, invitations

Three tables. **None of them is named `sessions` unqualified** — see the naming note below;
that is a deliberate defence, not a style preference.

## `users`

| Column | Type | Null | Notes |
|---|---|---|---|
| `id` | `uuid` | no | Primary key. **This is the value written as the event log's `actor`** (spec 004 left `actor` opaque precisely so this feature could supply its meaning). |
| `username` | `text` | no | What someone types to sign in. Unique, case-insensitively. |
| `display_name` | `text` | no | Shown to other players. Not an identifier. |
| `role` | `text` | no | `operator` or `player` (FR-002). Constrained. |
| `password_hash` | `text` | no | scrypt output plus its salt and parameters (research D1). Never the password. |
| `created_at` | `timestamptz` | no | Defaulted. |

- **Unique on `lower(username)`** — a functional unique index, so `Alice` and `alice` cannot
  both exist. Two accounts differing only in case is a phishing vector inside a table of
  people who trust each other.
- `role` is a check-constrained text column rather than a Postgres enum: adding a role later
  to an enum requires a migration that some tooling handles poorly, and the check gives the
  same guarantee.

## `auth_sessions`

| Column | Type | Null | Notes |
|---|---|---|---|
| `id` | `uuid` | no | Primary key. Internal; never given to a client. |
| `token_hash` | `text` | no | **SHA-256 of the token** (research D2). The token itself is never stored. Unique. |
| `user_id` | `uuid` | no | References `users(id)`, cascading on delete: removing a user ends their sessions. |
| `expires_at` | `timestamptz` | no | Absolute expiry, 30 days from creation (research D3). |
| `created_at` | `timestamptz` | no | Defaulted. |

- **Unique index on `token_hash`** — it is the lookup key for every authenticated request,
  so it must be indexed anyway, and uniqueness states the invariant.
- **Index on `user_id`** — needed to end all of one user's sessions, and to list them.
  Unlike spec 004's deliberate no-extra-index rule, this table is read-heavy and small.
- **No `last_used_at`.** Deliberate: writing it on every validation turns the hottest read
  in the system into a write, and it is the seed of an accidental sliding expiry, which
  FR-008 forbids.

## `invitations`

| Column | Type | Null | Notes |
|---|---|---|---|
| `id` | `uuid` | no | Primary key. |
| `token_hash` | `text` | no | SHA-256 of the invitation token, same reasoning as sessions. Unique. |
| `created_by` | `uuid` | no | References `users(id)` — the operator who issued it. |
| `expires_at` | `timestamptz` | no | Bounded; an unexpiring invitation is a permanent backdoor. |
| `redeemed_at` | `timestamptz` | **yes** | Null means unredeemed. Set exactly once (research D5). |
| `redeemed_by` | `uuid` | yes | The user created by redemption. Null until then. |
| `created_at` | `timestamptz` | no | Defaulted. |

- `redeemed_at` being nullable is what makes the conditional update work: redemption is
  `UPDATE ... SET redeemed_at = now() WHERE id = $1 AND redeemed_at IS NULL`, and the row
  count reports who won.

## Naming: why not `sessions`

This product has **two** things called "session":

- a **play session** — spec 004's `events.session_id`, the game being played (architecture A4);
- an **auth session** — this table, one signed-in browser.

A table named `sessions` would silently invite a later reader — or a later query — to join
the wrong one. `auth_sessions` costs five characters and removes the ambiguity permanently.
Spec 004's Assumptions section names this collision from the other side.

## Validation rules

- Username is required, non-empty, unique case-insensitively, and trimmed of surrounding
  whitespace before comparison.
- Password has a stated maximum accepted length and is **never silently truncated**
  (FR-016). Over the bound is a refusal, not a shortened password that still authenticates.
- `role` is exactly `operator` or `player`.
- A session's `expires_at` is always in the future at creation.
- An invitation may be redeemed only while `redeemed_at IS NULL` and `expires_at` is in the
  future (FR-013).
- Only a user whose role is `operator` may create an invitation (FR-012).

## State transitions

- **User**: created (by provisioning, or by redeeming an invitation) → exists. No
  deactivation in M0; deleting the row cascades to their sessions.
- **Auth session**: created at sign-in → valid until `expires_at` → deleted at sign-out.
  Sign-out deletes rather than marks, since there is nothing to audit in M0 and a deleted
  row cannot be accidentally treated as live.
- **Invitation**: issued → (redeemed | expired). Redeemed is terminal and one-way.
