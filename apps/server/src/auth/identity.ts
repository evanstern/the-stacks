import type { PublicUser, Role } from "@the-stacks/shared";
import { eq } from "drizzle-orm";
import { users } from "../schema/auth.js";
import type { DbClient, ValidateSession } from "./session.js";

export interface CreateIdentityLookupOptions {
  db: DbClient;
  validateSession: ValidateSession;
}

/**
 * The single seam behind `/auth/me` and the web load context (plan D2), so
 * the two callers cannot drift. Returns `null` for no token, no live
 * session, or a session whose user row is gone — the same "who are you"
 * answer in every case. Does not catch a datastore error: it propagates,
 * exactly as `validateSession` propagates one (contracts/validate-session.md).
 */
export function createIdentityLookup({
  db,
  validateSession,
}: CreateIdentityLookupOptions) {
  return async function lookupIdentity(
    token: string | undefined,
  ): Promise<PublicUser | null> {
    if (!token) return null;

    const identity = await validateSession(token);
    if (!identity) return null;

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, identity.userId))
      .limit(1);
    if (!user) return null;

    return {
      id: user.id,
      displayName: user.displayName,
      role: user.role as Role,
    };
  };
}

export type IdentityLookup = ReturnType<typeof createIdentityLookup>;
