import { eq } from "drizzle-orm";
import { users } from "../schema/auth.js";
import { hashPassword } from "./password.js";
import type { DbClient } from "./session.js";

/**
 * Operator provisioning (research D6, US3): the documented, no-default-
 * credential path to the first account (FR-011).
 */

export interface CreateOperatorInput {
  username: string;
  displayName?: string;
  password: string;
}

export type CreateOperatorResult =
  | { created: true; user: typeof users.$inferSelect }
  | { created: false };

/**
 * Creates the first operator account. Refuses — returns `{created: false}`
 * rather than throwing — when an operator already exists, so a second run
 * can't silently create a second operator or overwrite the first (US3
 * scenario 2). Single-tenant: one operator per install (spec Assumptions).
 *
 * Read-then-write, unlike invitation redemption (research D5): this runs
 * as a one-time, human-operated CLI command, not a concurrent web
 * endpoint, so nothing races it.
 */
export async function createOperator(
  db: DbClient,
  input: CreateOperatorInput,
): Promise<CreateOperatorResult> {
  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.role, "operator"))
    .limit(1);
  if (existing) {
    return { created: false };
  }

  const passwordHash = await hashPassword(input.password);
  const [user] = await db
    .insert(users)
    .values({
      username: input.username,
      displayName: input.displayName ?? input.username,
      role: "operator",
      passwordHash,
    })
    .returning();
  return { created: true, user };
}
