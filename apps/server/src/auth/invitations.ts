import { and, eq, gt, isNull, sql } from "drizzle-orm";
import { invitations, users } from "../schema/auth.js";
import { hashPassword } from "./password.js";
import type { DbClient } from "./session.js";
import { generateToken, hashToken } from "./tokens.js";

/** Invitations (research D5, US4): operator-only, single-use. */

const POSTGRES_UNIQUE_VIOLATION = "23505";

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: unknown }).code === POSTGRES_UNIQUE_VIOLATION
  );
}

// No lifetime is pinned by the spec; seven days is a deliberate, documented
// default rather than an unbounded invitation (data-model.md: "an
// unexpiring invitation is a permanent backdoor").
const DEFAULT_INVITATION_LIFETIME_DAYS = 7;

export interface IssueInvitationOptions {
  expiresInDays?: number;
}

export interface IssuedInvitation {
  token: string;
  expiresAt: Date;
}

/**
 * Creates an invitation and returns its token **once** (contracts/http-auth.md)
 * — only the hash is stored (research D2), so this is the only moment it's
 * ever recoverable. Caller (the route) is responsible for the operator-only
 * check (FR-012); this function trusts `createdBy`.
 */
export async function issueInvitation(
  db: DbClient,
  createdBy: string,
  options: IssueInvitationOptions = {},
): Promise<IssuedInvitation> {
  const token = generateToken();
  const days = options.expiresInDays ?? DEFAULT_INVITATION_LIFETIME_DAYS;
  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  await db.insert(invitations).values({
    tokenHash: hashToken(token),
    createdBy,
    expiresAt,
  });
  return { token, expiresAt };
}

export interface RedeemInvitationInput {
  token: string;
  username: string;
  displayName: string;
  password: string;
}

export type RedeemInvitationResult =
  | { ok: true; user: typeof users.$inferSelect }
  | { ok: false; reason: "invalid" | "conflict" };

/** Rollback signal only — never escapes redeemInvitation (see below). */
class InvitationNotRedeemableError extends Error {}

/**
 * Redeems an invitation and creates the player account it grants, per
 * research D5: single-use enforced by the database, not by a
 * read-then-write.
 *
 * The account is created **inside the same transaction** as the guarded
 * `UPDATE ... WHERE token_hash = $1 AND redeemed_at IS NULL AND expires_at
 * > now()`, with the new user's id supplied as `redeemed_by` in that same
 * statement. If the UPDATE reports zero rows changed — already redeemed,
 * expired, or unknown, all indistinguishable on purpose — this function
 * throws to roll the transaction back, which undoes the account insert
 * too. Postgres serializes concurrent UPDATEs to the same row: the loser's
 * statement blocks until the winner commits, then re-evaluates
 * `redeemed_at IS NULL` and finds it false. Exactly one redemption can
 * ever win (SC-005) — this is what T035/T036 prove.
 */
export async function redeemInvitation(
  db: DbClient,
  input: RedeemInvitationInput,
): Promise<RedeemInvitationResult> {
  const tokenHash = hashToken(input.token);
  const passwordHash = await hashPassword(input.password);

  try {
    return await db.transaction(async (tx) => {
      const [user] = await tx
        .insert(users)
        .values({
          username: input.username,
          displayName: input.displayName,
          role: "player",
          passwordHash,
        })
        .returning();

      const updated = await tx
        .update(invitations)
        .set({ redeemedAt: sql`now()`, redeemedBy: user.id })
        .where(
          and(
            eq(invitations.tokenHash, tokenHash),
            isNull(invitations.redeemedAt),
            gt(invitations.expiresAt, sql`now()`),
          ),
        )
        .returning({ id: invitations.id });

      if (updated.length === 0) {
        throw new InvitationNotRedeemableError();
      }
      return { ok: true, user };
    });
  } catch (err) {
    if (err instanceof InvitationNotRedeemableError) {
      return { ok: false, reason: "invalid" };
    }
    if (isUniqueViolation(err)) {
      return { ok: false, reason: "conflict" };
    }
    throw err;
  }
}
