import { sql } from "drizzle-orm";
import {
  check,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * Session auth (spec 005): who can sign in, their sessions, and invitations.
 *
 * **Never named `sessions`.** `events.session_id` (spec 004) is a *play*
 * session; `auth_sessions` here is a signed-in browser. An unqualified
 * `sessions` table would invite a later reader — or query — to join the
 * wrong one (data-model.md, "Naming").
 */

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    username: text("username").notNull(),
    displayName: text("display_name").notNull(),
    // "operator" | "player" (FR-002). A check-constrained text column
    // rather than a Postgres enum: adding a role later to an enum needs a
    // migration some tooling handles poorly (data-model.md).
    role: text("role").notNull(),
    // scrypt output plus its salt and parameters, encoded as one string
    // (research D1). Never the password itself.
    passwordHash: text("password_hash").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // Case-insensitive uniqueness: "Alice" and "alice" cannot both exist
    // (data-model.md) — two accounts differing only in case is a phishing
    // vector inside a table of people who trust each other.
    uniqueIndex("users_username_lower_idx").on(sql`lower(${table.username})`),
    check("users_role_valid", sql`${table.role} IN ('operator', 'player')`),
  ],
);

export const authSessions = pgTable(
  "auth_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    // SHA-256 of the token (research D2) — the token itself is never
    // stored, so a database leak is useless for impersonation.
    tokenHash: text("token_hash").notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // Absolute expiry, 30 days from creation (research D3). No
    // `last_used_at`: writing it on every validation would turn the
    // hottest read in the system into a write, and it is the seed of an
    // accidental sliding expiry, which FR-008 forbids.
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // The lookup key for every authenticated request; uniqueness states
    // the invariant that a token hash names exactly one session.
    uniqueIndex("auth_sessions_token_hash_idx").on(table.tokenHash),
    // Needed to end (or list) all of one user's sessions. Unlike spec
    // 004's deliberate no-extra-index rule, this table is read-heavy and
    // small.
    index("auth_sessions_user_id_idx").on(table.userId),
  ],
);

export const invitations = pgTable(
  "invitations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    // SHA-256 of the invitation token, same reasoning as auth_sessions.
    tokenHash: text("token_hash").notNull(),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    // Bounded; an unexpiring invitation is a permanent backdoor.
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    // Null means unredeemed. Set exactly once via a conditional UPDATE
    // (research D5) — never read-then-write.
    redeemedAt: timestamp("redeemed_at", { withTimezone: true }),
    redeemedBy: uuid("redeemed_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [uniqueIndex("invitations_token_hash_idx").on(table.tokenHash)],
);
